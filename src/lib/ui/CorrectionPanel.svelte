<script lang="ts">
	import {
		CORRECTION_LOW_CONFIDENCE_THRESHOLD,
		CORRECTION_SENTENCE_MAX_LENGTH,
		CORRECTION_SENTENCE_MIN_LENGTH,
		CORRECTION_STATUS_LABEL
	} from '$lib/domain/constants';
	import { formatMeters, formatShare } from '$lib/format';
	import type { CorrectionRecord, SegmentSummary } from '$lib/domain/types';
	import PanelSection from '$lib/ui/PanelSection.svelte';
	import ValueRow from '$lib/ui/ValueRow.svelte';

	interface Props {
		segment: SegmentSummary | null;
		records: CorrectionRecord[];
		submitting: boolean;
		errorMessage: string;
		onsubmit: (sentence: string) => void;
		ondecide: (id: number, approved: boolean) => void;
	}

	let { segment, records, submitting, errorMessage, onsubmit, ondecide }: Props = $props();

	let sentence = $state('');

	const trimmed = $derived(sentence.trim());
	const canSubmit = $derived(
		segment !== null && !submitting && trimmed.length >= CORRECTION_SENTENCE_MIN_LENGTH
	);
	const pending = $derived(records.filter((record) => record.status === 'pending'));
	const decided = $derived(records.filter((record) => record.status !== 'pending'));

	function submit(event: SubmitEvent): void {
		event.preventDefault();
		if (!canSubmit) return;
		onsubmit(trimmed);
		sentence = '';
	}
</script>

<PanelSection
	index="A5"
	title="Koreksi dari lapangan"
	note="Kalimat bebas dari lapangan diubah menjadi usulan terstruktur. Usulan tidak pernah langsung mengubah data, dan baru berlaku setelah Anda setujui."
>
	{#if segment === null}
		<p class="text-graphite text-[12px] leading-[1.55]">
			Pilih satu segmen gang di peta lebih dulu, lalu tulis apa yang Anda lihat di lokasi.
		</p>
	{:else}
		<form onsubmit={submit}>
			<label class="stencil-sm text-graphite mb-1.5 block" for="kalimat-koreksi">
				Apa yang Anda lihat di segmen {segment.segmentId.toString().padStart(4, '0')}
			</label>
			<textarea
				id="kalimat-koreksi"
				class="field-input"
				rows="3"
				maxlength={CORRECTION_SENTENCE_MAX_LENGTH}
				placeholder="Contoh: gang ini sebenarnya cuma dua meter karena ada warung permanen di ujungnya"
				bind:value={sentence}
				disabled={submitting}
			></textarea>
			<div class="mt-2 flex items-center justify-between gap-3">
				<span class="readout text-graphite-pale text-[10.5px]">
					{trimmed.length}/{CORRECTION_SENTENCE_MAX_LENGTH}
				</span>
				<button type="submit" class="field-button-solid" disabled={!canSubmit}>
					{submitting ? 'Mengirim' : 'Buat usulan'}
				</button>
			</div>
		</form>

		{#if errorMessage}
			<p class="text-alarm mt-2.5 text-[11.5px] leading-[1.5]" role="status">{errorMessage}</p>
		{/if}
	{/if}

	{#if pending.length > 0}
		<div class="bg-ink/15 my-3 h-px"></div>
		<p class="stencil-sm text-graphite mb-2">Menunggu tinjauan Anda</p>
		{#each pending as record (record.id)}
			<article class="hairline-box bg-concrete-tint mb-2 px-3 py-3">
				<p class="quoted-line text-ink text-[12px] leading-[1.55]">{record.originalSentence}</p>
				<div class="mt-2.5">
					<ValueRow
						label="Lebar minimum sekarang"
						value={formatMeters(record.previousMinWidthMeters, 2)}
					/>
					<ValueRow
						label="Lebar usulan"
						value={formatMeters(record.proposal.proposedWidthMeters, 2)}
						emphasis
					/>
					<ValueRow
						label="Tingkat keyakinan"
						value={formatShare(record.proposal.confidence)}
						tone={record.proposal.confidence < CORRECTION_LOW_CONFIDENCE_THRESHOLD
							? 'caution'
							: 'ink'}
					/>
				</div>
				<p class="text-graphite mt-1.5 text-[11.5px] leading-[1.5]">{record.proposal.reason}</p>
				<div class="mt-2.5 flex flex-wrap gap-2">
					<button type="button" class="field-button-solid" onclick={() => ondecide(record.id, true)}>
						Setujui
					</button>
					<button type="button" class="field-button" onclick={() => ondecide(record.id, false)}>
						Tolak
					</button>
				</div>
			</article>
		{/each}
	{/if}

	{#if decided.length > 0}
		<div class="bg-ink/15 my-3 h-px"></div>
		<p class="stencil-sm text-graphite mb-2">Riwayat koreksi</p>
		{#each decided as record (record.id)}
			<div class="ledger-row">
				<span class="text-graphite shrink-0 text-[11.5px]">
					Segmen {record.segmentId.toString().padStart(4, '0')}
				</span>
				<span class="rule-dotted mb-[3px] min-w-3 flex-1"></span>
				<span class="readout text-ink shrink-0 text-[11px]">
					{record.status === 'approved'
						? formatMeters(record.proposal.proposedWidthMeters, 2)
						: formatMeters(record.previousMinWidthMeters, 2)}
				</span>
				<span class="stencil-sm text-graphite-pale shrink-0">
					{CORRECTION_STATUS_LABEL[record.status]}
				</span>
			</div>
		{/each}
	{/if}
</PanelSection>
