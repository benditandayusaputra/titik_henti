<script lang="ts">
	import { formatDate } from '$lib/format';
	import type { PipelineMeta } from '$lib/domain/types';

	interface Props {
		meta: PipelineMeta;
	}

	let { meta }: Props = $props();
</script>

<div class="bg-paper hairline-t px-4 py-3">
	<div class="flex items-start gap-2">
		<span
			class="border-ink text-ink mt-[1px] flex h-[15px] w-[15px] shrink-0 items-center justify-center border font-mono text-[10px] leading-none font-bold"
		>
			!
		</span>
		<p class="text-ink text-[10.5px] leading-[1.5]">
			Lebar gang di lembar ini adalah <strong class="font-semibold">estimasi citra satelit</strong>
			pada grid {meta.rasterResolutionMeters} m, bukan hasil ukur lapangan. Verifikasi sebelum dipakai
			sebagai dasar keputusan operasional.
		</p>
	</div>
	<dl class="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
		{#each meta.provenance as source (source.label)}
			<div class="flex items-baseline gap-1.5">
				<dt class="field-label-sm text-graphite">{source.label}</dt>
				<dd class="readout text-graphite text-[10px]">{source.licence}</dd>
			</div>
		{/each}
		<div class="flex items-baseline gap-1.5">
			<dt class="field-label-sm text-graphite">Olah</dt>
			<dd class="readout text-graphite text-[10px]">
				Diolah {formatDate(meta.processedAt)}, pipeline versi {meta.pipelineVersion}
			</dd>
		</div>
	</dl>
</div>
