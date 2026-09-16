<script lang="ts">
	import {
		HOSE_LENGTH_STEP_METERS,
		MAX_HOSE_LENGTH_METERS,
		MIN_HOSE_LENGTH_METERS,
		WATER_SOURCE_LABEL
	} from '$lib/domain/constants';
	import { formatCount, formatMeters } from '$lib/format';
	import type { HoseReachResult, WaterSource } from '$lib/domain/types';
	import PanelSection from '$lib/ui/PanelSection.svelte';
	import ValueRow from '$lib/ui/ValueRow.svelte';
	import { workspace } from '$lib/workspace.svelte';

	interface Props {
		reach: HoseReachResult | null;
		sources: WaterSource[];
		buildingCount: number;
	}

	let { reach, sources, buildingCount }: Props = $props();

	const sourceCounts = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const source of sources) {
			counts.set(source.kind, (counts.get(source.kind) ?? 0) + 1);
		}
		return [...counts.entries()];
	});
	const largestPocket = $derived(reach?.pockets[0] ?? null);
</script>

<PanelSection
	title="Jangkauan selang"
	note="Pencarian pada graf gang dengan batas jarak kumulatif dari tiap sumber air."
>
	<label class="block">
		<span class="flex items-baseline justify-between gap-2">
			<span class="field-label-sm text-graphite">Panjang selang maksimum</span>
			<span class="readout text-ink">{formatMeters(workspace.maximumHoseLengthMeters)}</span>
		</span>
		<input
			class="mt-1.5 w-full"
			type="range"
			min={MIN_HOSE_LENGTH_METERS}
			max={MAX_HOSE_LENGTH_METERS}
			step={HOSE_LENGTH_STEP_METERS}
			value={workspace.maximumHoseLengthMeters}
			oninput={(event) =>
				(workspace.maximumHoseLengthMeters = Number(event.currentTarget.value))}
		/>
	</label>

	{#if !reach}
		<p class="text-graphite mt-3 text-[12px] leading-[1.55]">
			Menyiapkan tabel ketetanggaan bangunan. Angka jangkauan muncul setelah berkas itu selesai
			dimuat.
		</p>
	{/if}

	{#if reach}
		<div class="mt-3 grid grid-cols-2 gap-px">
			<div class="hairline-box bg-paper px-3 py-2.5">
				<p class="field-label-sm text-graphite">Terjangkau</p>
				<p class="readout-lg text-water mt-1.5">{formatCount(reach.reachedBuildingCount)}</p>
			</div>
			<div class="hairline-box bg-paper px-3 py-2.5">
				<p class="field-label-sm text-graphite">Tak terjangkau</p>
				<p class="readout-lg text-alarm mt-1.5">{formatCount(reach.unreachedBuildingCount)}</p>
			</div>
		</div>
		<div class="mt-2">
			<ValueRow
				label="Pangsa terjangkau"
				value={`${((reach.reachedBuildingCount / Math.max(buildingCount, 1)) * 100).toFixed(1)} %`}
			/>
			<ValueRow label="Jumlah kantong" value={formatCount(reach.pockets.length)} />
			<ValueRow
				label="Kantong terbesar"
				value={largestPocket ? `${formatCount(largestPocket.buildingCount)} bangunan` : '—'}
				tone="alarm"
			/>
		</div>
	{/if}
</PanelSection>

<PanelSection
	title="Sumber air"
	note="Posisi unit pemadam adalah titik henti kandidat pada segmen kelas unit besar, bukan hidran terpasang."
>
	{#each sourceCounts as [kind, count] (kind)}
		<ValueRow
			label={WATER_SOURCE_LABEL[kind as keyof typeof WATER_SOURCE_LABEL] ?? kind}
			value={formatCount(count)}
		/>
	{/each}

	<div class="mt-3 flex flex-wrap gap-2">
		<button
			type="button"
			class={workspace.placingHydrant ? 'field-button-solid' : 'field-button'}
			onclick={() => (workspace.placingHydrant = !workspace.placingHydrant)}
		>
			{workspace.placingHydrant ? 'Mode taruh hidran aktif' : 'Taruh hidran hipotetis'}
		</button>
		<button
			type="button"
			class="field-button"
			disabled={workspace.hypotheticalSources.length === 0}
			onclick={() => workspace.clearHypotheticalSources()}
		>
			Hapus {workspace.hypotheticalSources.length} usulan
		</button>
	</div>
</PanelSection>

<PanelSection title="Kantong tak terjangkau">
	{#if !reach || reach.pockets.length === 0}
		<p class="text-graphite text-[11.5px] leading-[1.55]">
			Seluruh bangunan terjangkau pada panjang selang saat ini.
		</p>
	{:else}
		<ol class="flex flex-col">
			{#each reach.pockets.slice(0, 8) as pocket (pocket.id)}
				<li class="ledger-row">
					<span class="text-graphite text-[11.5px]">
						Kantong {(pocket.id + 1).toString().padStart(2, '0')}
					</span>
					<span class="rule-dotted mb-[3px] min-w-3 flex-1"></span>
					<span class="readout text-ink">{formatCount(pocket.buildingCount)}</span>
				</li>
			{/each}
		</ol>
		{#if reach.pockets.length > 8}
			<p class="field-label-sm text-graphite mt-2">
				dan {reach.pockets.length - 8} kantong lain
			</p>
		{/if}
	{/if}
</PanelSection>
