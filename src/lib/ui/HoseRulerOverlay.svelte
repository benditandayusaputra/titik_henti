<script lang="ts">
	import type { Map as MapLibreMap } from 'maplibre-gl';
	import { HOSE_ROLL_LENGTH_METERS } from '$lib/domain/constants';
	import type { LonLat } from '$lib/domain/types';

	interface Props {
		map: MapLibreMap | null;
		tip: LonLat | null;
		meters: number;
		totalMeters: number;
	}

	let { map, tip, meters, totalMeters }: Props = $props();

	let screenX = $state(0);
	let screenY = $state(0);
	let visible = $state(false);

	function reproject(): void {
		if (!map || !tip) {
			visible = false;
			return;
		}
		const point = map.project([tip.lon, tip.lat]);
		screenX = point.x;
		screenY = point.y;
		visible = true;
	}

	$effect(() => {
		const activeMap = map;
		const activeTip = tip;
		if (!activeMap || !activeTip) {
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

	const rolls = $derived(Math.ceil(meters / HOSE_ROLL_LENGTH_METERS));
	const totalRolls = $derived(Math.ceil(totalMeters / HOSE_ROLL_LENGTH_METERS));
</script>

{#if visible}
	<div
		class="pointer-events-none absolute z-20"
		style:left={`${screenX}px`}
		style:top={`${screenY}px`}
		aria-hidden="true"
	>
		<div class="-translate-y-1/2 translate-x-3">
			<div class="bg-concrete border-water flex items-stretch border-l-[3px]">
				<div class="px-2 py-1.5">
					<span class="readout-lg text-ink block tabular-nums">
						{Math.round(meters)}<span class="text-graphite text-[13px]"> m</span>
					</span>
					<span class="stencil-sm text-graphite mt-1 block">
						Gulung {rolls}/{totalRolls}
					</span>
				</div>
			</div>
		</div>
	</div>
{/if}
