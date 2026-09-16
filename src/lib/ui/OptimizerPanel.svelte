<script lang="ts">
	import {
		BATCH_PROBE_RUN_COUNT,
		OPTIMIZER_MAX_BUDGET_RUPIAH,
		OPTIMIZER_MIN_BUDGET_RUPIAH
	} from '$lib/domain/constants';
	import { formatCount, formatDecimal, formatRupiah } from '$lib/format';
	import type { FireBatchStatistics, InterventionKind } from '$lib/domain/types';
	import PanelSection from '$lib/ui/PanelSection.svelte';
	import ValueRow from '$lib/ui/ValueRow.svelte';
	import { workspace } from '$lib/workspace.svelte';

	interface Props {
		budgetRupiah: number;
		batchStatistics: FireBatchStatistics | null;
		batchRunning: boolean;
		onbudgetchange: (value: number) => void;
		onrun: () => void;
		onapply: () => void;
		onprobe: () => void;
	}

	let {
		budgetRupiah,
		batchStatistics,
		batchRunning,
		onbudgetchange,
		onrun,
		onapply,
		onprobe
	}: Props = $props();

	const kindLabel: Record<InterventionKind, string> = {
		extinguisher: 'APAR',
		waterSource: 'Sumber air',
		wideningSegment: 'Pelebaran'
	};

	const outcome = $derived(workspace.optimizerOutcome);
	const progressShare = $derived(
		workspace.optimizerProgress.total === 0
			? 0
			: workspace.optimizerProgress.completed / workspace.optimizerProgress.total
	);
	const applied = $derived(
		workspace.appliedInterventionNodeIds.length + workspace.appliedInterventionSegmentIds.length
	);
</script>

<PanelSection
	title="Optimizer intervensi"
	note="Maksimalisasi submodular serakah. Tiap putaran memilih kandidat dengan kenaikan ekspektasi bangunan selamat per rupiah tertinggi, sampai anggaran habis."
>
	<label class="block">
		<span class="flex items-baseline justify-between gap-2">
			<span class="field-label-sm text-graphite">Anggaran</span>
			<span class="readout text-ink">{formatRupiah(budgetRupiah)}</span>
		</span>
		<input
			class="mt-1.5 w-full"
			type="range"
			min={OPTIMIZER_MIN_BUDGET_RUPIAH}
			max={OPTIMIZER_MAX_BUDGET_RUPIAH}
			step={OPTIMIZER_MIN_BUDGET_RUPIAH}
			value={budgetRupiah}
			oninput={(event) => onbudgetchange(Number(event.currentTarget.value))}
		/>
	</label>

	<div class="mt-3 flex flex-wrap gap-2">
		<button
			type="button"
			class="field-button-solid"
			disabled={workspace.optimizerRunning}
			onclick={onrun}
		>
			{workspace.optimizerRunning ? 'Mencari…' : 'Jalankan optimizer'}
		</button>
		<button
			type="button"
			class="field-button"
			disabled={!outcome || outcome.selected.length === 0}
			onclick={onapply}
		>
			Pasang hasil ke simulasi
		</button>
	</div>

	{#if workspace.optimizerRunning}
		<div class="mt-3">
			<div class="hairline-box h-[10px] w-full">
				<div class="bg-ink h-full" style:width={`${Math.round(progressShare * 100)}%`}></div>
			</div>
			<p class="field-label-sm text-graphite mt-1.5">{workspace.optimizerProgress.note}</p>
		</div>
	{/if}

	{#if applied > 0}
		<p class="field-label-sm text-water mt-3">{applied} intervensi terpasang di simulasi</p>
	{/if}
</PanelSection>

{#if outcome}
	<PanelSection title="Hasil peringkat">
		<div class="mb-3 grid grid-cols-2 gap-px">
			<div class="hairline-box bg-paper px-3 py-2.5">
				<p class="field-label-sm text-graphite">Terbakar tanpa intervensi</p>
				<p class="readout-lg text-alarm mt-1.5">
					{formatDecimal(outcome.baselineExpectedBurnt, 1)}
				</p>
			</div>
			<div class="hairline-box bg-paper px-3 py-2.5">
				<p class="field-label-sm text-graphite">Terbakar setelah</p>
				<p class="readout-lg text-water mt-1.5">
					{formatDecimal(outcome.improvedExpectedBurnt, 1)}
				</p>
			</div>
		</div>
		<ValueRow label="Anggaran terpakai" value={formatRupiah(outcome.spentRupiah)} />
		<ValueRow
			label="Ekspektasi bangunan terselamatkan"
			value={formatDecimal(outcome.baselineExpectedBurnt - outcome.improvedExpectedBurnt, 1)}
			tone="water"
			emphasis
		/>

		<div class="bg-ink/15 my-2 h-px"></div>

		{#if outcome.selected.length === 0}
			<p class="text-graphite text-[11.5px] leading-[1.55]">
				Tidak ada kandidat yang memberi kenaikan positif pada anggaran ini. Naikkan anggaran atau
				perluas daftar kandidat.
			</p>
		{:else}
			<ol class="flex flex-col">
				{#each outcome.selected as item (item.id)}
					<li class="hairline-b flex items-baseline gap-2 py-2 last:border-b-0">
						<span class="readout text-graphite w-6 shrink-0 text-[11px]">
							{item.rank.toString().padStart(2, '0')}
						</span>
						<span class="min-w-0 flex-1">
							<span class="field-label-sm text-ink block">{kindLabel[item.kind]}</span>
							<span class="text-graphite block text-[10.5px] leading-tight">{item.label}</span>
						</span>
						<span class="shrink-0 text-right">
							<span class="readout text-ink block">{formatRupiah(item.costRupiah)}</span>
							<span class="readout text-water block text-[10px]">
								+{formatDecimal(item.expectedSavedGain, 1)}
							</span>
						</span>
					</li>
				{/each}
			</ol>
		{/if}
	</PanelSection>
{/if}

<PanelSection
	title="Uji cepat sebaran risiko"
	note="Mode batch pada worker menjalankan banyak lari simulasi dengan titik api dan arah angin acak, lalu mengembalikan statistik agregat saja."
>
	<button type="button" class="field-button" disabled={batchRunning} onclick={onprobe}>
		{batchRunning ? 'Menjalankan…' : `Jalankan ${BATCH_PROBE_RUN_COUNT} lari acak`}
	</button>
	{#if batchStatistics}
		<div class="mt-3">
			<ValueRow label="Jumlah lari" value={formatCount(batchStatistics.runCount)} />
			<ValueRow
				label="Rata-rata bangunan terbakar"
				value={formatDecimal(batchStatistics.meanAffectedCount, 1)}
				tone="alarm"
			/>
			<ValueRow
				label="Rata-rata terselamatkan"
				value={formatDecimal(batchStatistics.meanSavedCount, 1)}
				tone="water"
			/>
			<ValueRow
				label="Kejadian terburuk"
				value={formatCount(batchStatistics.worstAffectedCount)}
			/>
		</div>
	{/if}
</PanelSection>

<PanelSection title="Catatan biaya">
	<p class="text-graphite text-[11px] leading-[1.55]">
		Biaya satuan disimpan di constants.ts dan bersifat perkiraan kasar untuk membandingkan
		alternatif, bukan rencana anggaran biaya. Ekspektasi bangunan terbakar dihitung dari rata-rata
		banyak lari simulasi dengan titik api dan arah angin acak.
	</p>
	<ValueRow
		label="Kandidat dievaluasi"
		value={formatCount(outcome?.selected.length ?? 0)}
		tone="graphite"
	/>
</PanelSection>
