<script lang="ts">
	interface Props {
		label: string;
		value: string;
		tone?: 'ink' | 'alarm' | 'water' | 'caution' | 'graphite';
		emphasis?: boolean;
	}

	let { label, value, tone = 'ink', emphasis = false }: Props = $props();

	const toneClass: Record<string, string> = {
		ink: 'text-ink',
		alarm: 'text-alarm',
		water: 'text-water',
		caution: 'text-caution',
		graphite: 'text-graphite'
	};
</script>

<div class="ledger-row">
	<span class="text-graphite shrink-0 text-[11.5px] leading-tight">{label}</span>
	<span class="rule-dotted mb-[3px] min-w-3 flex-1"></span>
	<span
		class="{toneClass[tone]} shrink-0 {emphasis ? 'readout-lg' : 'readout'}"
		class:tracking-tight={emphasis}
	>
		{value}
	</span>
</div>
