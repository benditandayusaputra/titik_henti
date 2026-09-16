<script lang="ts">
	import { formatCount, formatSeconds } from '$lib/format';
	import type { ComparisonSummary } from '$lib/domain/types';
	import PanelSection from '$lib/ui/PanelSection.svelte';
	import { workspace } from '$lib/workspace.svelte';

	interface Props {
		oncompare: () => void;
		running: boolean;
	}

	let { oncompare, running }: Props = $props();

	const rows = $derived<ComparisonSummary[]>(workspace.comparison);
	const baseline = $derived(rows[0] ?? null);
	const widened = $derived(rows[1] ?? null);
	const burntDelta = $derived(
		baseline && widened ? baseline.burntCount - widened.burntCount : 0
	);
	const arrivalDelta = $derived(
		baseline && widened
			? baseline.meanWaterArrivalSeconds - widened.meanWaterArrivalSeconds
			: 0
	);
</script>

<PanelSection
	index="E1"
	title="Naikkan semua gang satu kelas"
	note="Menaikkan kelas akses seluruh segmen satu tingkat, menghitung ulang titik henti, panjang selang, waktu air sampai, lalu menjalankan simulasi dengan seed yang sama persis."
>
	<div class="flex flex-wrap gap-2">
		<button type="button" class="field-button-solid" disabled={running} onclick={oncompare}>
			{running ? 'Menghitung dua skenario…' : 'Bandingkan sebelum dan sesudah'}
		</button>
		<button
			type="button"
			class={workspace.wideningScenarioActive ? 'field-button-solid' : 'field-button'}
			onclick={() => (workspace.wideningScenarioActive = !workspace.wideningScenarioActive)}
		>
			{workspace.wideningScenarioActive ? 'Tampilkan jaringan asli' : 'Tampilkan jaringan lebar'}
		</button>
	</div>

	{#if baseline && widened}
		<div class="mt-4 grid grid-cols-2 gap-px">
			{#each rows as row, index (row.label)}
				<div
					class="hairline-box px-3 py-3"
					class:bg-concrete-tint={index === 0}
					class:bg-ink={index === 1}
				>
					<p class="stencil-sm" class:text-graphite={index === 0} class:text-concrete={index === 1}>
						{row.label}
					</p>
					<p
						class="readout-xl mt-2"
						class:text-alarm={index === 0}
						class:text-concrete={index === 1}
					>
						{formatCount(row.burntCount)}
					</p>
					<p
						class="stencil-sm mt-1"
						class:text-graphite={index === 0}
						class:text-graphite-pale={index === 1}
					>
						bangunan terbakar
					</p>
					<dl class="mt-3 flex flex-col gap-1">
						<div class="flex items-baseline justify-between gap-2">
							<dt
								class="text-[10.5px]"
								class:text-graphite={index === 0}
								class:text-graphite-pale={index === 1}
							>
								Terselamatkan
							</dt>
							<dd
								class="readout text-[11px]"
								class:text-water={index === 0}
								class:text-concrete={index === 1}
							>
								{formatCount(row.savedCount)}
							</dd>
						</div>
						<div class="flex items-baseline justify-between gap-2">
							<dt
								class="text-[10.5px]"
								class:text-graphite={index === 0}
								class:text-graphite-pale={index === 1}
							>
								Air rata-rata
							</dt>
							<dd
								class="readout text-[11px]"
								class:text-ink={index === 0}
								class:text-concrete={index === 1}
							>
								{formatSeconds(row.meanWaterArrivalSeconds)}
							</dd>
						</div>
						<div class="flex items-baseline justify-between gap-2">
							<dt
								class="text-[10.5px]"
								class:text-graphite={index === 0}
								class:text-graphite-pale={index === 1}
							>
								Air terburuk
							</dt>
							<dd
								class="readout text-[11px]"
								class:text-ink={index === 0}
								class:text-concrete={index === 1}
							>
								{formatSeconds(row.worstWaterArrivalSeconds)}
							</dd>
						</div>
						<div class="flex items-baseline justify-between gap-2">
							<dt
								class="text-[10.5px]"
								class:text-graphite={index === 0}
								class:text-graphite-pale={index === 1}
							>
								Tak terjangkau
							</dt>
							<dd
								class="readout text-[11px]"
								class:text-ink={index === 0}
								class:text-concrete={index === 1}
							>
								{formatCount(row.unreachableBuildingCount)}
							</dd>
						</div>
					</dl>
				</div>
			{/each}
		</div>

		<div class="hairline-box bg-concrete-tint mt-3 px-3 py-3">
			<p class="stencil-sm text-graphite">Selisih akibat pelebaran gang</p>
			<p class="readout-xl mt-2" class:text-water={burntDelta > 0} class:text-ink={burntDelta <= 0}>
				{burntDelta > 0 ? '−' : burntDelta < 0 ? '+' : ''}{formatCount(Math.abs(burntDelta))}
			</p>
			<p class="text-graphite mt-1 text-[11px] leading-[1.5]">
				bangunan terbakar, dengan titik api, arah angin, dan seed acak yang identik. Air sampai
				lebih cepat {formatSeconds(Math.abs(arrivalDelta))} rata-rata.
			</p>
		</div>
	{:else}
		<p class="text-graphite mt-3 text-[11.5px] leading-[1.55]">
			Rantai sebab akibat yang diuji: lebar gang → kelas akses → posisi titik henti → panjang selang
			→ waktu air sampai → kapan pemadaman mulai → berapa bangunan terbakar.
		</p>
	{/if}
</PanelSection>
