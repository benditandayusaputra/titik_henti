<script lang="ts">
	import {
		ACCESS_CLASS_LABEL,
		ACCESS_CLASS_SURFACE_COLOR,
		MATERIAL_CLASS_LABEL,
		STACKED_BAR_LABEL_MIN_SHARE
	} from '$lib/domain/constants';
	import { formatCount, formatDecimal, formatKilometers, formatShare } from '$lib/format';
	import type { AccessClass, PipelineMeta } from '$lib/domain/types';
	import PanelSection from '$lib/ui/PanelSection.svelte';
	import ValueRow from '$lib/ui/ValueRow.svelte';

	interface Props {
		meta: PipelineMeta;
	}

	let { meta }: Props = $props();

	const classes: AccessClass[] = ['largeUnit', 'smallUnit', 'hoseOnly'];
	const totalLength = $derived(
		meta.alleyLengthMetersByClass.largeUnit +
			meta.alleyLengthMetersByClass.smallUnit +
			meta.alleyLengthMetersByClass.hoseOnly
	);
	const density = $derived(meta.buildingCount / Math.max(meta.areaSquareKilometres, 0.001));
</script>

<PanelSection index="A1" title="Wilayah kerja">
	<div class="mb-3">
		<p class="font-display text-ink text-[27px] leading-[0.95] font-bold uppercase">
			{meta.villageName}
		</p>
		<p class="stencil text-graphite mt-1.5">
			Kec. {meta.districtName} · {meta.cityName}
		</p>
	</div>
	<ValueRow label="Luas kelurahan" value={`${formatDecimal(meta.areaSquareKilometres, 2)} km²`} />
	<ValueRow label="Penduduk ({meta.populationYear})" value={formatCount(meta.populationCount)} />
	<ValueRow label="Bangunan terpetakan" value={formatCount(meta.buildingCount)} />
	<ValueRow label="Kepadatan bangunan" value={`${formatCount(Math.round(density))} /km²`} />
</PanelSection>

<PanelSection
	index="A2"
	title="Klasifikasi gang"
	note="Panjang jaringan gang menurut lebar minimum sepanjang segmen."
>
	<div class="mb-3 flex h-[26px] w-full overflow-hidden">
		{#each classes as accessClass (accessClass)}
			{@const share = meta.alleyLengthMetersByClass[accessClass] / Math.max(totalLength, 1)}
			<div
				class="hairline-box flex items-center justify-center border-l-0 first:border-l"
				style:width={`${share * 100}%`}
				style:background-color={ACCESS_CLASS_SURFACE_COLOR[accessClass]}
				title={ACCESS_CLASS_LABEL[accessClass]}
			>
				{#if share > STACKED_BAR_LABEL_MIN_SHARE}
					<span
						class="readout text-[10px]"
						style:color={accessClass === 'largeUnit' ? '#1A1A1C' : '#F2F0EC'}
					>
						{Math.round(share * 100)}%
					</span>
				{/if}
			</div>
		{/each}
	</div>
	{#each classes as accessClass (accessClass)}
		<ValueRow
			label={ACCESS_CLASS_LABEL[accessClass]}
			value={formatKilometers(meta.alleyLengthMetersByClass[accessClass])}
		/>
	{/each}
	<div class="bg-ink/15 my-2 h-px"></div>
	<ValueRow
		label="Tak terlalui kendaraan"
		value={formatShare(meta.inaccessibleLengthShare)}
		tone="alarm"
		emphasis
	/>
	<ValueRow label="Segmen gang" value={formatCount(meta.alleySegmentCount)} />
	<ValueRow label="Simpul jaringan" value={formatCount(meta.alleyNodeCount)} />
</PanelSection>

<PanelSection
	index="A3"
	title="Bahan bangunan"
	note="Kelas material diperkirakan dari luas tapak dan tinggi, bukan survei lapangan."
>
	<ValueRow label={MATERIAL_CLASS_LABEL.masonry} value={formatCount(meta.materialMix.masonry)} />
	<ValueRow label={MATERIAL_CLASS_LABEL.mixed} value={formatCount(meta.materialMix.mixed)} />
	<ValueRow
		label={MATERIAL_CLASS_LABEL.lightweight}
		value={formatCount(meta.materialMix.lightweight)}
		tone="caution"
	/>
	<ValueRow label="Tinggi terukur OSM" value={formatCount(meta.measuredHeightCount)} tone="graphite" />
</PanelSection>
