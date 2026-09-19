<script lang="ts">
	import {
		ACCESS_CLASS_COLOR,
		ACCESS_CLASS_LABEL,
		ACCESS_CLASS_WIDTH_NOTE,
		WIDTH_SOURCE_LABEL,
		WIDTH_SOURCE_NOTE
	} from '$lib/domain/constants';
	import { formatDecimal, formatMeters } from '$lib/format';
	import type { SegmentSummary } from '$lib/domain/types';
	import PanelSection from '$lib/ui/PanelSection.svelte';
	import RelatedArticles from '$lib/ui/RelatedArticles.svelte';
	import ValueRow from '$lib/ui/ValueRow.svelte';

	interface Props {
		segment: SegmentSummary;
	}

	let { segment }: Props = $props();
</script>

<PanelSection title="Segmen gang terpilih">
	<div class="mb-2 flex items-baseline gap-2">
		<span class="field-label text-graphite">Segmen</span>
		<span class="readout-lg text-ink">{segment.segmentId.toString().padStart(4, '0')}</span>
	</div>

	<div class="flex items-center gap-2 py-1">
		<span
			class="border-ink/40 h-[5px] w-7 shrink-0 border"
			style:background-color={ACCESS_CLASS_COLOR[segment.accessClass]}
		></span>
		<span class="text-ink text-[12px]">{ACCESS_CLASS_LABEL[segment.accessClass]}</span>
		<span class="readout text-graphite text-[10.5px]">
			{ACCESS_CLASS_WIDTH_NOTE[segment.accessClass]}
		</span>
	</div>

	<ValueRow measured label="Lebar minimum" value={formatMeters(segment.minWidthMeters, 2)} emphasis />
	<ValueRow measured
		label={segment.widthSource === 'field' ? 'Lebar rata rata, masih satelit' : 'Lebar rata rata'}
		value={formatMeters(segment.meanWidthMeters, 2)}
		tone={segment.widthSource === 'field' ? 'graphite' : 'ink'}
	/>
	<ValueRow measured label="Panjang segmen" value={formatMeters(segment.lengthMeters, 1)} />
	<ValueRow label="Ruas jaringan" value={formatDecimal(segment.edgeCount, 0)} />
	<ValueRow label="Jalan bernama" value={segment.isNamedRoad ? 'Ya' : 'Tidak'} />

	<div class="bg-ink/15 my-2 h-px"></div>

	<ValueRow
		label="Sumber nilai"
		value={WIDTH_SOURCE_LABEL[segment.widthSource]}
		tone={segment.widthSource === 'field' ? 'ink' : 'caution'}
	/>
	<p class="text-graphite mt-1.5 text-[11.5px] leading-[1.5]">
		{WIDTH_SOURCE_NOTE[segment.widthSource]}
	</p>

	{#if segment.accessClass === 'hoseOnly'}
		<RelatedArticles
			condition="gang_selang_saja"
			lead="Gang ini hanya bisa dilalui selang, jadi menit sebelum air datang lebih panjang. Panduan berikut ditulis untuk keadaan itu."
		/>
	{:else if segment.accessClass === 'smallUnit'}
		<RelatedArticles
			condition="gang_unit_kecil"
			lead="Gang ini hanya bisa dilalui unit kecil. Panduan berikut relevan untuk warga di sepanjang gang ini."
		/>
	{/if}
</PanelSection>
