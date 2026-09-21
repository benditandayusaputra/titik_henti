<script lang="ts">
	import type { Map as MapLibreMap } from 'maplibre-gl';
	import type { LonLat } from '$lib/domain/types';

	interface Props {
		map: MapLibreMap | null;
		stopPoint: LonLat | null;
	}

	let { map, stopPoint }: Props = $props();

	let screenX = $state(0);
	let screenY = $state(0);
	let visible = $state(false);

	function reproject(): void {
		if (!map || !stopPoint) {
			visible = false;
			return;
		}
		const point = map.project([stopPoint.lon, stopPoint.lat]);
		screenX = point.x;
		screenY = point.y;
		visible = true;
	}

	$effect(() => {
		const activeMap = map;
		const activePoint = stopPoint;
		if (!activeMap || !activePoint) {
			visible = false;
			return;
		}
		reproject();
		activeMap.on('move', reproject);
		activeMap.on('zoom', reproject);
		return () => {
			activeMap.off('move', reproject);
			activeMap.off('zoom', reproject);
		};
	});
</script>

{#if visible}
	<div
		class="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
		style:left={`${screenX}px`}
		style:top={`${screenY}px`}
		aria-hidden="true"
		data-marker-titik-henti
	>
		<span class="bg-concrete border-ink text-ink flex h-8 w-8 items-center justify-center border">
			<svg
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
				<path d="M15 18H9" />
				<path
					d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"
				/>
				<circle cx="17" cy="18" r="2" />
				<circle cx="7" cy="18" r="2" />
			</svg>
		</span>
	</div>
{/if}
