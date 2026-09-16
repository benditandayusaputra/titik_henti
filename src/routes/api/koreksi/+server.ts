import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { json, type Cookies, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import {
	ACCESS_CLASS_LABEL,
	ACCESS_CLASS_WIDTH_NOTE,
	CORRECTION_MAX_OUTPUT_TOKENS,
	CORRECTION_MAX_WIDTH_METERS,
	CORRECTION_MIN_WIDTH_METERS,
	CORRECTION_MODEL_ID,
	CORRECTION_RATE_LIMIT_COUNT,
	CORRECTION_RATE_LIMIT_WINDOW_SECONDS,
	CORRECTION_SESSION_COOKIE,
	CORRECTION_SESSION_MAX_AGE_SECONDS
} from '$lib/domain/constants';
import {
	correctionProposalSchema,
	correctionRequestSchema,
	isProposalForSegment
} from '$lib/domain/correctionSchema';

export const prerender = false;

const requestTimestampsBySession = new Map<string, number[]>();

function readSessionId(cookies: Cookies): string {
	const existing = cookies.get(CORRECTION_SESSION_COOKIE);
	if (existing) return existing;
	const created = crypto.randomUUID();
	cookies.set(CORRECTION_SESSION_COOKIE, created, {
		path: '/',
		httpOnly: true,
		sameSite: 'strict',
		maxAge: CORRECTION_SESSION_MAX_AGE_SECONDS
	});
	return created;
}

function exceedsRateLimit(sessionId: string): boolean {
	const now = Date.now();
	const windowStart = now - CORRECTION_RATE_LIMIT_WINDOW_SECONDS * 1000;
	const recent = (requestTimestampsBySession.get(sessionId) ?? []).filter(
		(timestamp) => timestamp > windowStart
	);
	if (recent.length >= CORRECTION_RATE_LIMIT_COUNT) {
		requestTimestampsBySession.set(sessionId, recent);
		return true;
	}
	recent.push(now);
	requestTimestampsBySession.set(sessionId, recent);
	return false;
}

function buildInstruction(): string {
	return [
		'Anda membantu petugas lapangan mengoreksi data lebar gang di permukiman padat Jakarta.',
		'Pengguna sedang berdiri di lokasi dan menulis satu kalimat bebas tentang segmen gang yang sedang dipilih.',
		'Tugas Anda menerjemahkan kalimat itu menjadi usulan koreksi lebar minimum segmen tersebut dalam meter.',
		'',
		'Aturan:',
		`Isi segmentId persis dengan nilai segmentId segmen terpilih yang diberikan, jangan menebak nomor lain.`,
		`Isi proposedWidthMeters dengan lebar minimum baru dalam meter, antara ${CORRECTION_MIN_WIDTH_METERS} dan ${CORRECTION_MAX_WIDTH_METERS}.`,
		'Kalau kalimat menyebut angka lebar secara langsung, pakai angka itu.',
		'Kalau kalimat hanya menyebut penghalang tanpa angka, perkirakan lebar sisa yang masih dapat dilalui dan turunkan tingkat keyakinan.',
		'Isi reason dengan satu kalimat bahasa Indonesia yang menyebut dasar usulan dari kalimat pengguna.',
		'Isi confidence antara 0 dan 1, rendah bila kalimat tidak menyebut angka atau tidak jelas merujuk lebar gang.',
		'Jangan mengarang informasi yang tidak ada di kalimat pengguna.'
	].join('\n');
}

function buildUserMessage(
	sentence: string,
	segment: {
		segmentId: number;
		accessClass: 'largeUnit' | 'smallUnit' | 'hoseOnly';
		minWidthMeters: number;
		meanWidthMeters: number;
		lengthMeters: number;
	}
): string {
	return [
		'Segmen terpilih:',
		`segmentId: ${segment.segmentId}`,
		`lebar minimum sekarang: ${segment.minWidthMeters.toFixed(2)} m`,
		`lebar rata rata sekarang: ${segment.meanWidthMeters.toFixed(2)} m`,
		`panjang segmen: ${segment.lengthMeters.toFixed(1)} m`,
		`kelas sekarang: ${ACCESS_CLASS_LABEL[segment.accessClass]} (${ACCESS_CLASS_WIDTH_NOTE[segment.accessClass]})`,
		'',
		'Kalimat pengguna di lapangan:',
		sentence
	].join('\n');
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		return json(
			{ ok: false, message: 'Layanan koreksi belum dikonfigurasi di server ini.' },
			{ status: 503 }
		);
	}

	const sessionId = readSessionId(cookies);
	if (exceedsRateLimit(sessionId)) {
		return json(
			{
				ok: false,
				message: `Batas ${CORRECTION_RATE_LIMIT_COUNT} koreksi per ${Math.round(CORRECTION_RATE_LIMIT_WINDOW_SECONDS / 60)} menit tercapai. Tunggu sebentar sebelum mengirim lagi.`
			},
			{ status: 429 }
		);
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return json({ ok: false, message: 'Isi permintaan bukan JSON yang sah.' }, { status: 400 });
	}

	const parsedRequest = correctionRequestSchema.safeParse(payload);
	if (!parsedRequest.success) {
		return json(
			{ ok: false, message: 'Kalimat koreksi atau konteks segmen tidak lengkap.' },
			{ status: 400 }
		);
	}

	const { sentence, segment } = parsedRequest.data;
	const client = new Anthropic({ apiKey });

	let response;
	try {
		response = await client.messages.parse({
			model: CORRECTION_MODEL_ID,
			max_tokens: CORRECTION_MAX_OUTPUT_TOKENS,
			system: buildInstruction(),
			messages: [{ role: 'user', content: buildUserMessage(sentence, segment) }],
			output_config: {
				effort: 'low',
				format: zodOutputFormat(correctionProposalSchema)
			}
		});
	} catch (failure) {
		if (failure instanceof Anthropic.RateLimitError) {
			return json(
				{ ok: false, message: 'Layanan sedang padat. Coba lagi beberapa saat lagi.' },
				{ status: 429 }
			);
		}
		if (failure instanceof Anthropic.APIConnectionError) {
			return json(
				{ ok: false, message: 'Tidak dapat menghubungi layanan koreksi.' },
				{ status: 502 }
			);
		}
		return json({ ok: false, message: 'Layanan koreksi gagal merespons.' }, { status: 502 });
	}

	if (response.stop_reason === 'refusal') {
		return json(
			{ ok: false, message: 'Kalimat ini tidak dapat diproses menjadi usulan koreksi.' },
			{ status: 422 }
		);
	}

	const proposal = correctionProposalSchema.safeParse(response.parsed_output);
	if (!proposal.success) {
		return json(
			{ ok: false, message: 'Usulan yang dihasilkan tidak sesuai skema dan ditolak.' },
			{ status: 422 }
		);
	}

	if (!isProposalForSegment(proposal.data, segment.segmentId)) {
		return json(
			{ ok: false, message: 'Usulan merujuk segmen yang berbeda dan ditolak.' },
			{ status: 422 }
		);
	}

	return json({ ok: true, proposal: proposal.data });
};
