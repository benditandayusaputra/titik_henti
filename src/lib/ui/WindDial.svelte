<script lang="ts">
	import { MAX_WIND_SPEED_METERS_PER_SECOND } from '$lib/domain/constants';

	interface Props {
		directionDegrees: number;
		speedMetersPerSecond: number;
	}

	let { directionDegrees, speedMetersPerSecond }: Props = $props();

	const arrowLength = $derived(
		12 + (speedMetersPerSecond / MAX_WIND_SPEED_METERS_PER_SECOND) * 16
	);
	const tipX = $derived(32 + Math.sin((directionDegrees * Math.PI) / 180) * arrowLength);
	const tipY = $derived(32 - Math.cos((directionDegrees * Math.PI) / 180) * arrowLength);
	const tailX = $derived(32 - Math.sin((directionDegrees * Math.PI) / 180) * 10);
	const tailY = $derived(32 + Math.cos((directionDegrees * Math.PI) / 180) * 10);
</script>

<svg viewBox="0 0 64 64" class="h-16 w-16 shrink-0" role="img" aria-label="Arah dan kecepatan angin">
	<rect x="0.5" y="0.5" width="63" height="63" fill="none" stroke="#1A1A1C" stroke-opacity="0.25" />
	<circle cx="32" cy="32" r="27" fill="none" stroke="#1A1A1C" stroke-opacity="0.18" />
	<circle cx="32" cy="32" r="15" fill="none" stroke="#1A1A1C" stroke-opacity="0.12" />
	{#each [0, 90, 180, 270] as tick (tick)}
		<line
			x1={32 + Math.sin((tick * Math.PI) / 180) * 24}
			y1={32 - Math.cos((tick * Math.PI) / 180) * 24}
			x2={32 + Math.sin((tick * Math.PI) / 180) * 28}
			y2={32 - Math.cos((tick * Math.PI) / 180) * 28}
			stroke="#1A1A1C"
			stroke-opacity="0.4"
			stroke-width="1"
		/>
	{/each}
	<line x1={tailX} y1={tailY} x2={tipX} y2={tipY} stroke="#1A1A1C" stroke-width="2.4" />
	<circle cx={tipX} cy={tipY} r="3" fill="#1A1A1C" />
	<circle cx="32" cy="32" r="2" fill="none" stroke="#1A1A1C" stroke-width="1.4" />
	<text
		x="32"
		y="10"
		text-anchor="middle"
		font-family="IBM Plex Mono, monospace"
		font-size="7"
		fill="#6E6E73"
	>
		U
	</text>
</svg>
