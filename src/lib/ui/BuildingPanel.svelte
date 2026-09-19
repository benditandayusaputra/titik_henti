<script lang="ts">
	import {
		ACCESS_CLASS_COLOR,
		ACCESS_CLASS_LABEL,
		MATERIAL_CLASS_BY_CODE,
		MATERIAL_CLASS_LABEL
	} from '$lib/domain/constants';
	import { formatCoordinate, formatDecimal, formatMeters } from '$lib/format';
	import type { AccessClass, AlleyNetwork, BuildingTable } from '$lib/domain/types';
	import PanelSection from '$lib/ui/PanelSection.svelte';
	import ValueRow from '$lib/ui/ValueRow.svelte';
	import { ACCESS_CLASS_BY_CODE } from '$lib/domain/constants';

	interface Props {
		buildings: BuildingTable;
		network: AlleyNetwork;
		buildingIndex: number;
	}

	let { buildings, network, buildingIndex }: Props = $props();

	const nearestNode = $derived(buildings.nearestNodeId[buildingIndex]);
	const nearestAccessClass = $derived.by<AccessClass | null>(() => {
		if (nearestNode < 0) return null;
		let best = -1;
		for (
			let slot = network.adjacencyOffsets[nearestNode];
			slot < network.adjacencyOffsets[nearestNode + 1];
			slot += 1
		) {
			const edge = network.adjacencyEdgeIds[slot];
			if (network.edgeAccessClass[edge] > best) best = network.edgeAccessClass[edge];
		}
		return best < 0 ? null : ACCESS_CLASS_BY_CODE[best];
	});
	const nearestWidth = $derived.by(() => {
		if (nearestNode < 0) return null;
		let widest = 0;
		for (
			let slot = network.adjacencyOffsets[nearestNode];
			slot < network.adjacencyOffsets[nearestNode + 1];
			slot += 1
		) {
			const edge = network.adjacencyEdgeIds[slot];
			widest = Math.max(widest, network.edgeMinWidthMeters[edge]);
		}
		return widest;
	});
	const material = $derived(MATERIAL_CLASS_BY_CODE[buildings.materialClass[buildingIndex]]);
</script>

<PanelSection title="Detail bangunan">
	<div class="mb-2 flex items-baseline gap-2">
		<span class="field-label text-graphite">Indeks</span>
		<span class="readout-lg text-ink">{buildingIndex.toString().padStart(5, '0')}</span>
	</div>
	<ValueRow measured
		label="Tinggi"
		value={`${formatDecimal(buildings.heightMeters[buildingIndex], 1)} m`}
	/>
	<ValueRow measured
		label="Luas tapak"
		value={`${formatDecimal(buildings.areaSquareMeters[buildingIndex], 0)} m²`}
	/>
	<ValueRow label="Kelas material" value={MATERIAL_CLASS_LABEL[material]} />
	<ValueRow
		label="Sumber tinggi"
		value={buildings.heightIsMeasured[buildingIndex] === 1 ? 'Tag OSM' : 'Perkiraan'}
		tone={buildings.heightIsMeasured[buildingIndex] === 1 ? 'ink' : 'caution'}
	/>
	<ValueRow measured
		label="Koordinat"
		value={formatCoordinate(buildings.lon[buildingIndex], buildings.lat[buildingIndex])}
	/>

	<div class="bg-ink/15 my-2 h-px"></div>

	{#if nearestAccessClass}
		<div class="flex items-center gap-2 py-1">
			<span
				class="border-ink/40 h-[5px] w-7 shrink-0 border"
				style:background-color={ACCESS_CLASS_COLOR[nearestAccessClass]}
			></span>
			<span class="text-ink text-[12px]">{ACCESS_CLASS_LABEL[nearestAccessClass]}</span>
		</div>
		<ValueRow measured
			label="Lebar gang terdekat"
			value={nearestWidth === null ? '—' : formatMeters(nearestWidth, 1)}
		/>
		<ValueRow measured
			label="Jarak ke jaringan"
			value={formatMeters(buildings.nearestNodeDistanceMeters[buildingIndex], 1)}
		/>
	{:else}
		<p class="text-alarm text-[11.5px] leading-[1.5]">
			Bangunan ini tidak tersambung ke jaringan gang manapun dalam radius pencarian.
		</p>
	{/if}
</PanelSection>
