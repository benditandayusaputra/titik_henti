import { json, type Cookies, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { env } from '$env/dynamic/private';
import {
	ACCESS_CLASS_LABEL,
	ACCESS_CLASS_WIDTH_NOTE,
	CORRECTION_MAX_OUTPUT_TOKENS,
	CORRECTION_MAX_WIDTH_METERS,
	CORRECTION_MIN_WIDTH_METERS,
	CORRECTION_RATE_LIMIT_COUNT,
	CORRECTION_RATE_LIMIT_WINDOW_SECONDS,
	CORRECTION_REQUEST_TIMEOUT_MS,
	CORRECTION_SESSION_COOKIE,
	CORRECTION_SESSION_MAX_AGE_SECONDS,
	SUPPORTED_LLM_PROVIDER
} from '$lib/domain/constants';
import {
	correctionProposalSchema,
	correctionRequestSchema,
	isProposalForSegment
} from '$lib/domain/correctionSchema';

export const prerender = false;

const requestTimestampsBySession = new Map<string, number[]>();

const chatCompletionSchema = z.object({
	choices: z
		.array(z.object({ message: z.object({ content: z.string().nullable() }) }))
		.min(1)
});

interface LanguageModelSettings {
	baseUrl: string;
	apiKey: string;
	model: string;
}

function readLanguageModelSettings(): LanguageModelSettings | null {
	const provider = env.AI_LLM_PROVIDER ?? SUPPORTED_LLM_PROVIDER;
	if (provider !== SUPPORTED_LLM_PROVIDER) return null;
	const baseUrl = env.AI_LLM_BASE_URL;
	const apiKey = env.AI_LLM_API_KEY;
	const model = env.AI_LLM_MODEL;
	if (!baseUrl || !apiKey || !model) return null;
	return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey, model };
}

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

function listRecentRequests(sessionId: string): number[] {
	const windowStart = Date.now() - CORRECTION_RATE_LIMIT_WINDOW_SECONDS * 1000;
	const recent = (requestTimestampsBySession.get(sessionId) ?? []).filter(
		(timestamp) => timestamp > windowStart
	);
	requestTimestampsBySession.set(sessionId, recent);
	return recent;
}

function exceedsRateLimit(sessionId: string): boolean {
	return listRecentRequests(sessionId).length >= CORRECTION_RATE_LIMIT_COUNT;
}

function recordModelUse(sessionId: string): void {
	requestTimestampsBySession.set(sessionId, [...listRecentRequests(sessionId), Date.now()]);
}

function buildProposalJsonSchema(): Record<string, unknown> {
	const schema = z.toJSONSchema(correctionProposalSchema) as Record<string, unknown>;
	delete schema.$schema;
	return schema;
}

function buildInstruction(): string {
	return [
		'Anda membantu petugas lapangan mengoreksi data lebar gang di permukiman padat Jakarta.',
		'Pengguna sedang berdiri di lokasi dan menulis satu kalimat bebas tentang segmen gang yang sedang dipilih.',
		'Tugas Anda menerjemahkan kalimat itu menjadi usulan koreksi lebar minimum segmen tersebut dalam meter.',
		'',
		'Aturan:',
		'Isi segmentId persis dengan nilai segmentId segmen terpilih yang diberikan, jangan menebak nomor lain.',
		`Isi proposedWidthMeters dengan lebar minimum baru dalam meter, antara ${CORRECTION_MIN_WIDTH_METERS} dan ${CORRECTION_MAX_WIDTH_METERS}.`,
		'Kalau kalimat menyebut angka lebar secara langsung, pakai angka itu.',
		'Kalau kalimat hanya menyebut penghalang tanpa angka, perkirakan lebar sisa yang masih dapat dilalui dan turunkan tingkat keyakinan.',
		'Isi reason dengan satu kalimat bahasa Indonesia yang menyebut dasar usulan dari kalimat pengguna.',
		'Isi confidence antara 0 dan 1, rendah bila kalimat tidak menyebut angka atau tidak jelas merujuk lebar gang.',
		'Jangan mengarang informasi yang tidak ada di kalimat pengguna.',
		'Balas hanya dengan satu objek JSON tanpa penjelasan tambahan.'
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

function stripCodeFence(text: string): string {
	const trimmed = text.trim();
	if (!trimmed.startsWith('```')) return trimmed;
	const withoutOpening = trimmed.replace(/^```[a-zA-Z]*\s*/, '');
	const closingIndex = withoutOpening.lastIndexOf('```');
	return closingIndex === -1 ? withoutOpening.trim() : withoutOpening.slice(0, closingIndex).trim();
}

function parseFirstJsonObject(text: string): unknown {
	const cleaned = stripCodeFence(text);
	try {
		return JSON.parse(cleaned);
	} catch {
		const start = cleaned.indexOf('{');
		const end = cleaned.lastIndexOf('}');
		if (start === -1 || end <= start) return null;
		try {
			return JSON.parse(cleaned.slice(start, end + 1));
		} catch {
			return null;
		}
	}
}

async function requestProposalText(
	settings: LanguageModelSettings,
	sentence: string,
	segment: {
		segmentId: number;
		accessClass: 'largeUnit' | 'smallUnit' | 'hoseOnly';
		minWidthMeters: number;
		meanWidthMeters: number;
		lengthMeters: number;
	}
): Promise<{ ok: true; content: string } | { ok: false; status: number; message: string }> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), CORRECTION_REQUEST_TIMEOUT_MS);
	try {
		const response = await fetch(`${settings.baseUrl}/chat/completions`, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${settings.apiKey}`,
				'content-type': 'application/json'
			},
			signal: controller.signal,
			body: JSON.stringify({
				model: settings.model,
				temperature: 0,
				max_tokens: CORRECTION_MAX_OUTPUT_TOKENS,
				messages: [
					{ role: 'system', content: buildInstruction() },
					{ role: 'user', content: buildUserMessage(sentence, segment) }
				],
				response_format: {
					type: 'json_schema',
					json_schema: { name: 'usulan_koreksi', schema: buildProposalJsonSchema() }
				}
			})
		});

		if (response.status === 429) {
			return { ok: false, status: 429, message: 'Layanan sedang padat. Coba lagi beberapa saat lagi.' };
		}
		if (!response.ok) {
			return { ok: false, status: 502, message: 'Layanan koreksi gagal merespons.' };
		}

		const payload = chatCompletionSchema.safeParse(await response.json());
		if (!payload.success) {
			return { ok: false, status: 502, message: 'Bentuk jawaban layanan koreksi tidak dikenali.' };
		}
		const content = payload.data.choices[0].message.content;
		if (!content) {
			return { ok: false, status: 422, message: 'Kalimat ini tidak dapat diproses menjadi usulan koreksi.' };
		}
		return { ok: true, content };
	} catch (failure) {
		if (failure instanceof Error && failure.name === 'AbortError') {
			return { ok: false, status: 504, message: 'Layanan koreksi tidak menjawab tepat waktu.' };
		}
		return { ok: false, status: 502, message: 'Tidak dapat menghubungi layanan koreksi.' };
	} finally {
		clearTimeout(timeout);
	}
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	const settings = readLanguageModelSettings();
	if (!settings) {
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
	const completion = await requestProposalText(settings, sentence, segment);
	if (!completion.ok) {
		if (completion.status === 429) recordModelUse(sessionId);
		return json({ ok: false, message: completion.message }, { status: completion.status });
	}
	recordModelUse(sessionId);

	const proposal = correctionProposalSchema.safeParse(parseFirstJsonObject(completion.content));
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
