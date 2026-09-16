<script lang="ts">
	interface Props {
		label: string;
		rows?: number;
	}

	let { label, rows = 4 }: Props = $props();

	const barisKerangka = $derived(Array.from({ length: rows }, (_, index) => index));
</script>

<section class="hairline-b last:border-b-0" aria-busy="true">
	<p class="sr-only" role="status">{label}</p>
	<div aria-hidden="true">
		<header class="flex items-baseline gap-2 px-4 pt-4 pb-3">
			<span class="bg-ink/15 block h-[13px] w-28"></span>
			<span class="bg-ink/10 h-px flex-1"></span>
		</header>
		<div class="px-4 pb-4">
			{#each barisKerangka as baris (baris)}
				<div class="flex items-center justify-between gap-3 py-[9px]">
					<span class="bg-ink/10 block h-[10px] w-24"></span>
					<span class="bg-ink/10 h-px flex-1"></span>
					<span class="bg-ink/15 block h-[12px] w-14"></span>
				</div>
			{/each}
		</div>
	</div>
</section>
