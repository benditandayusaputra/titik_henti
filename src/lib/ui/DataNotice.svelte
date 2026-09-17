<script lang="ts">
	import { formatDate } from '$lib/format';
	import type { PipelineMeta } from '$lib/domain/types';

	interface Props {
		meta: PipelineMeta;
	}

	let { meta }: Props = $props();
</script>

<div class="bg-paper hairline-t px-4 py-3">
	<p class="text-ink text-[10.5px] leading-[1.5]">
		Lebar gang di lembar ini adalah <strong class="font-semibold">estimasi citra satelit</strong>
		pada grid {meta.rasterResolutionMeters} m, bukan hasil ukur lapangan. Verifikasi sebelum dipakai
		sebagai dasar keputusan operasional.
	</p>
	<dl class="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
		{#each meta.provenance as source (source.label)}
			<div class="flex items-baseline gap-1.5">
				<dt class="field-label-sm text-graphite">{source.label}</dt>
				<dd class="text-graphite text-[10px] leading-none">{source.licence}</dd>
			</div>
		{/each}
		<div class="flex items-baseline gap-1.5">
			<dt class="field-label-sm text-graphite">Olah</dt>
			<dd class="text-graphite text-[10px] leading-none">
				Diolah {formatDate(meta.processedAt)}, pipeline versi {meta.pipelineVersion}
			</dd>
		</div>
	</dl>
</div>
