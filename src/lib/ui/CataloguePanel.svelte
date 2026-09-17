<script lang="ts">
	import {
		ACCESS_CLASS_COLOR,
		ACCESS_CLASS_LABEL,
		CATALOGUE_ROW_LIMIT
	} from '$lib/domain/constants';
	import { formatCount, formatDecimal, formatMeters, formatSeconds } from '$lib/format';
	import type { AccessClass } from '$lib/domain/types';
	import { filterSegmentRows, type BuildingRow, type SegmentRow } from '$lib/sim/catalogue';
	import PanelSection from '$lib/ui/PanelSection.svelte';

	interface Props {
		segmentRows: SegmentRow[];
		buildingRows: BuildingRow[];
		selectedSegmentId: number | null;
		selectedBuildingIndex: number | null;
		onsegmentpick: (segmentId: number) => void;
		onbuildingpick: (buildingIndex: number) => void;
	}

	let {
		segmentRows,
		buildingRows,
		selectedSegmentId,
		selectedBuildingIndex,
		onsegmentpick,
		onbuildingpick
	}: Props = $props();

	const saringan: { id: AccessClass | 'semua'; label: string }[] = [
		{ id: 'hoseOnly', label: 'Selang saja' },
		{ id: 'smallUnit', label: 'Unit kecil' },
		{ id: 'largeUnit', label: 'Unit besar' },
		{ id: 'semua', label: 'Semua' }
	];

	let kelasTerpilih = $state<AccessClass | 'semua'>('hoseOnly');

	const segmenTampil = $derived(filterSegmentRows(segmentRows, kelasTerpilih, CATALOGUE_ROW_LIMIT));
</script>

<PanelSection
	title="Daftar segmen gang"
	note="Padanan tabel dari peta. Memilih baris di sini sama dengan mengklik segmen di peta, dan dapat dijangkau seluruhnya dengan papan ketik."
>
	<div class="mb-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Saring menurut kelas akses">
		{#each saringan as pilihan (pilihan.id)}
			<button
				type="button"
				class="field-button px-2 py-1"
				class:bg-ink={kelasTerpilih === pilihan.id}
				class:text-concrete={kelasTerpilih === pilihan.id}
				aria-pressed={kelasTerpilih === pilihan.id}
				onclick={() => (kelasTerpilih = pilihan.id)}
			>
				{pilihan.label}
			</button>
		{/each}
	</div>

	{#if segmenTampil.length === 0}
		<p class="text-graphite text-[12px] leading-[1.55]">
			Tidak ada segmen pada kelas ini di wilayah uji.
		</p>
	{:else}
		<table class="w-full">
			<caption class="field-label-sm text-graphite mb-1.5 text-left">
				{formatCount(segmenTampil.length)} segmen terpanjang pada kelas terpilih
			</caption>
			<thead>
				<tr class="border-ink/30 border-b">
					<th scope="col" class="field-label-sm text-graphite py-1 text-left">Segmen</th>
					<th scope="col" class="field-label-sm text-graphite py-1 text-right">Lebar minimum</th>
					<th scope="col" class="field-label-sm text-graphite py-1 text-right">Panjang</th>
				</tr>
			</thead>
			<tbody>
				{#each segmenTampil as baris (baris.segmentId)}
					<tr class="hairline-b" class:bg-concrete-shade={selectedSegmentId === baris.segmentId}>
						<th scope="row" class="py-1 text-left font-normal">
							<button
								type="button"
								class="readout text-ink flex min-h-6 w-full items-center gap-2 text-left text-[11.5px] underline-offset-2 hover:underline"
								aria-current={selectedSegmentId === baris.segmentId ? 'true' : undefined}
								onclick={() => onsegmentpick(baris.segmentId)}
							>
								<span
									class="border-ink/40 h-[5px] w-4 shrink-0 border"
									style:background-color={ACCESS_CLASS_COLOR[baris.accessClass]}
								></span>
								{baris.segmentId.toString().padStart(4, '0')}
								<span class="sr-only">
									kelas {ACCESS_CLASS_LABEL[baris.accessClass]}, pilih segmen ini
								</span>
							</button>
						</th>
						<td class="readout text-ink py-1 text-right text-[11.5px]">
							{formatMeters(baris.minWidthMeters, 2)}
						</td>
						<td class="readout text-ink py-1 text-right text-[11.5px]">
							{formatMeters(baris.lengthMeters, 1)}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</PanelSection>

<PanelSection
	title="Daftar bangunan terjauh dari air"
	note="Diurutkan dari bangunan yang tidak terjangkau sama sekali, lalu dari waktu air sampai terlama."
>
	{#if buildingRows.length === 0}
		<p class="text-graphite text-[12px] leading-[1.55]">Data bangunan belum siap.</p>
	{:else}
		<table class="w-full">
			<caption class="field-label-sm text-graphite mb-1.5 text-left">
				{formatCount(buildingRows.length)} bangunan dengan waktu air sampai terburuk
			</caption>
			<thead>
				<tr class="border-ink/30 border-b">
					<th scope="col" class="field-label-sm text-graphite py-1 text-left">Bangunan</th>
					<th scope="col" class="field-label-sm text-graphite py-1 text-right">Luas tapak</th>
					<th scope="col" class="field-label-sm text-graphite py-1 text-right">Air sampai</th>
				</tr>
			</thead>
			<tbody>
				{#each buildingRows as baris (baris.buildingIndex)}
					<tr
						class="hairline-b"
						class:bg-concrete-shade={selectedBuildingIndex === baris.buildingIndex}
					>
						<th scope="row" class="py-1 text-left font-normal">
							<button
								type="button"
								class="readout text-ink flex min-h-6 w-full items-center text-left text-[11.5px] underline-offset-2 hover:underline"
								aria-current={selectedBuildingIndex === baris.buildingIndex ? 'true' : undefined}
								onclick={() => onbuildingpick(baris.buildingIndex)}
							>
								{baris.buildingIndex.toString().padStart(5, '0')}
								<span class="sr-only">pilih bangunan ini</span>
							</button>
						</th>
						<td class="readout text-ink py-1 text-right text-[11.5px]">
							{formatDecimal(baris.areaSquareMeters, 0)} m²
						</td>
						<td
							class="readout py-1 text-right text-[11.5px]"
							class:text-alarm={!baris.reachable}
							class:text-ink={baris.reachable}
						>
							{baris.reachable ? formatSeconds(baris.waterArrivalSeconds) : 'Tak terjangkau'}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</PanelSection>
