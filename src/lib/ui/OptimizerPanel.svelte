<script lang="ts">
	import {
		BATCH_PROBE_RUN_COUNT,
		OPTIMIZER_MAX_BUDGET_RUPIAH,
		OPTIMIZER_MIN_BUDGET_RUPIAH
	} from '$lib/domain/constants';
	import { formatCount, formatDecimal, formatRupiah } from '$lib/format';
	import type {
		FireBatchStatistics,
		InterventionKind,
		SelectedIntervention
	} from '$lib/domain/types';
	import PanelSection from '$lib/ui/PanelSection.svelte';
	import ValueRow from '$lib/ui/ValueRow.svelte';
	import { PESAN_GAGAL_SIMULASI } from '$lib/ui/istilah';
	import { workspace } from '$lib/workspace.svelte';

	interface Props {
		onfocus: (item: SelectedIntervention) => void;
		budgetRupiah: number;
		batchStatistics: FireBatchStatistics | null;
		batchRunning: boolean;
		onbudgetchange: (value: number) => void;
		onrun: () => void;
		onapply: () => void;
		onprobe: () => void;
	}

	let {
		onfocus,
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

	const failure = $derived(workspace.simulationFailure);
</script>

<PanelSection
	title="Pencarian intervensi"
	note="Tiap putaran memilih intervensi yang paling banyak menambah bangunan selamat untuk setiap rupiah, lalu mengulanginya sampai anggaran habis."
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
			{workspace.optimizerRunning ? 'Mencari…' : 'Cari intervensi'}
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

	{#if failure && failure.task === 'optimize'}
		<div class="border-alarm mt-3 border-l-4 py-1 pl-3" role="alert">
			<p class="text-ink text-[12px] leading-[1.55]">{PESAN_GAGAL_SIMULASI[failure.cause]}</p>
		</div>
	{/if}

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
					<li class="hairline-b last:border-b-0">
						<button
							type="button"
							class="flex w-full items-baseline gap-2 py-2 text-left hover:underline"
							onclick={() => onfocus(item)}
						>
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
						</button>
					</li>
				{/each}
			</ol>
		{/if}
	</PanelSection>
{/if}

<PanelSection
	title="Uji cepat sebaran risiko"
	note="Menjalankan banyak simulasi sekaligus dengan titik api dan arah angin acak, lalu menampilkan ringkasannya saja."
>
	<button type="button" class="field-button" disabled={batchRunning} onclick={onprobe}>
		{batchRunning ? 'Menjalankan…' : `Jalankan ${BATCH_PROBE_RUN_COUNT} simulasi acak`}
	</button>
	{#if failure && failure.task === 'batch'}
		<div class="border-alarm mt-3 border-l-4 py-1 pl-3" role="alert">
			<p class="text-ink text-[12px] leading-[1.55]">{PESAN_GAGAL_SIMULASI[failure.cause]}</p>
		</div>
	{/if}
	{#if batchStatistics}
		<div class="mt-3">
			<ValueRow label="Jumlah simulasi" value={formatCount(batchStatistics.runCount)} />
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
		Biaya satuan adalah perkiraan kasar untuk membandingkan pilihan, bukan rencana anggaran biaya.
		Perkiraan jumlah bangunan terbakar dihitung dari rata-rata banyak simulasi dengan titik api dan
		arah angin acak.
	</p>
	<ValueRow
		label="Intervensi terpilih"
		value={formatCount(outcome?.selected.length ?? 0)}
		tone="graphite"
	/>
</PanelSection>
