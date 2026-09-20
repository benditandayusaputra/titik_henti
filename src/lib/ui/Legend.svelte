<script lang="ts">
	import {
		ACCESS_CLASS_LABEL,
		ACCESS_CLASS_MAP_COLOR,
		ACCESS_CLASS_MUTED_MAP_COLOR,
		ACCESS_CLASS_WIDTH_NOTE
	} from '$lib/domain/constants';
	import type { AccessClass } from '$lib/domain/types';

	interface Props {
		upgraded?: boolean;
		muted?: boolean;
	}

	let { upgraded = false, muted = false }: Props = $props();

	const palette = $derived(muted ? ACCESS_CLASS_MUTED_MAP_COLOR : ACCESS_CLASS_MAP_COLOR);

	const rows: AccessClass[] = ['largeUnit', 'smallUnit', 'hoseOnly'];

	let layarLebar = $state(true);

	$effect(() => {
		const kueri = window.matchMedia('(min-width: 1024px)');
		const perbarui = () => (layarLebar = kueri.matches);
		perbarui();
		kueri.addEventListener('change', perbarui);
		return () => kueri.removeEventListener('change', perbarui);
	});
</script>

<details class="bg-concrete/95 hairline-box w-[196px] px-3 py-2.5" open={layarLebar}>
	<summary
		class="map-label text-graphite cursor-pointer list-none focus-visible:[outline-offset:-2px]"
	>Kelas akses gang</summary>
	<ul class="mt-2 flex flex-col gap-[7px]">
		{#each rows as accessClass (accessClass)}
			<li class="flex items-center gap-2">
				<span
					class="border-ink/45 h-[5px] w-6 shrink-0 border"
					style:background-color={palette[accessClass]}
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
		<p class="field-label-sm text-ink mt-2.5 leading-[1.4]">Skenario pelebaran aktif</p>
	{/if}
	{#if muted}
		<p class="field-label-sm text-graphite mt-2.5 leading-[1.4]">
			Warna kelas diredam supaya merah hanya menandai api
		</p>
	{/if}
</details>
