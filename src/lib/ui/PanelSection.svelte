<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		index: string;
		title: string;
		note?: string;
		children: Snippet;
		trailing?: Snippet;
	}

	let { index, title, note, children, trailing }: Props = $props();
</script>

<section class="hairline-b last:border-b-0">
	<header class="flex items-center gap-2 px-4 pt-4 pb-2">
		<span class="readout text-graphite-pale text-[11px]">{index}</span>
		<span class="bg-ink/25 h-px flex-1"></span>
		<h2 class="stencil text-ink">{title}</h2>
		{#if trailing}
			{@render trailing()}
		{/if}
	</header>
	{#if note}
		<p class="text-graphite px-4 pb-2 text-[11px] leading-[1.5]">{note}</p>
	{/if}
	<div class="px-4 pb-4">
		{@render children()}
	</div>
</section>
