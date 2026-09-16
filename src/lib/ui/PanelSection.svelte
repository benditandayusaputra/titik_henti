<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		note?: string;
		children: Snippet;
		trailing?: Snippet;
	}

	let { title, note, children, trailing }: Props = $props();
</script>

<section class="hairline-b last:border-b-0">
	<header class="flex items-baseline gap-2 px-4 pt-4 pb-2">
		<h2 class="font-display text-ink text-[14px] leading-none font-semibold">{title}</h2>
		<span class="bg-ink/20 h-px flex-1"></span>
		{#if trailing}
			{@render trailing()}
		{/if}
	</header>
	{#if note}
		<p class="text-graphite px-4 pb-2 text-[11.5px] leading-[1.5]">{note}</p>
	{/if}
	<div class="px-4 pb-4">
		{@render children()}
	</div>
</section>
