<script lang="ts">
	import '../app.css';
	import Masthead from '$lib/ui/Masthead.svelte';

	let { children } = $props();
</script>

<div class="flex min-h-full flex-col lg:has-[[data-lembar-kerja]]:h-full print:block print:h-auto">
	<Masthead />
	<main class="flex min-h-0 flex-1 flex-col print:block">
		{@render children()}
	</main>
</div>
