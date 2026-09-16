<script lang="ts">
	import {
		ACCESS_CLASS_LABEL,
		ACCESS_CLASS_MAP_COLOR,
		ACCESS_CLASS_WIDTH_NOTE
	} from '$lib/domain/constants';
	import type { AccessClass } from '$lib/domain/types';

	interface Props {
		upgraded?: boolean;
	}

	let { upgraded = false }: Props = $props();

	const rows: AccessClass[] = ['largeUnit', 'smallUnit', 'hoseOnly'];
</script>

<div class="bg-concrete/95 hairline-box crop-mark pointer-events-none w-[196px] px-3 py-2.5">
	<p class="stencil-sm text-graphite mb-2">Kelas akses gang</p>
	<ul class="flex flex-col gap-[7px]">
		{#each rows as accessClass (accessClass)}
			<li class="flex items-center gap-2">
				<span
					class="border-ink/45 h-[5px] w-6 shrink-0 border"
					style:background-color={ACCESS_CLASS_MAP_COLOR[accessClass]}
				></span>
				<span class="text-ink flex-1 text-[11px] leading-none">
					{ACCESS_CLASS_LABEL[accessClass]}
				</span>
				<span class="readout text-graphite text-[10.5px]">
					{ACCESS_CLASS_WIDTH_NOTE[accessClass]}
				</span>
			</li>
		{/each}
	</ul>
	{#if upgraded}
		<p class="stencil-sm text-alarm mt-2.5 leading-[1.4]">Skenario pelebaran aktif</p>
	{/if}
</div>
