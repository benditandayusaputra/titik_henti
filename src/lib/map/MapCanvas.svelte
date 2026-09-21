<script lang="ts">
	import { DATA_URL } from '$lib/data/sources';
	import type { MapboxOverlay } from '@deck.gl/mapbox';
	import type { Layer } from '@deck.gl/core';
	import maplibregl, { type MapGeoJSONFeature } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { Protocol } from 'pmtiles';
	import { onMount } from 'svelte';
	import {
		BASEMAP_SOURCE_ID,
		BASEMAP_STYLE_URL,
		BASEMAP_UPSTREAM_SOURCE,
		MAP_CANVAS_LABEL,
		MAP_MAX_ZOOM,
		MAP_MIN_ZOOM,
		SEGMENT_PICK_TOLERANCE_PIXELS
	} from '$lib/domain/constants';
	import type { BoundingBox, LonLat } from '$lib/domain/types';
	import {
		ALLEY_LINE_LAYER_ID,
		ALLEY_SOURCE_ID,
		ALLEY_SOURCE_LAYER,
		BUILDING_FILL_LAYER_ID,
		BUILDING_SOURCE_ID,
		BUILDING_SOURCE_LAYER,
		alleyColorExpression,
		buildMapStyle,
		splitBasemapLayers
	} from '$lib/map/mapStyle';

	interface Props {
		bounds: BoundingBox;
		layers?: Layer[];
		upgradedAlleys?: boolean;
		mutedAlleyClasses?: boolean;
		selectedBuildingIndex?: number | null;
		selectedSegmentId?: number | null;
		correctedSegmentIds?: Set<number>;
		ignitionBuildingIndices?: number[];
		onbuildingpick?: (buildingIndex: number, position: LonLat) => void;
		onsegmentpick?: (segmentId: number, position: LonLat) => void;
		onmappick?: (position: LonLat) => void;
		onready?: (map: maplibregl.Map) => void;
	}

	let {
		bounds,
		layers = [],
		upgradedAlleys = false,
		mutedAlleyClasses = false,
		selectedBuildingIndex = null,
		selectedSegmentId = null,
		correctedSegmentIds = new Set<number>(),
		ignitionBuildingIndices = [],
		onbuildingpick,
		onsegmentpick,
		onmappick,
		onready
	}: Props = $props();

	let container: HTMLDivElement;
	let map: maplibregl.Map | null = $state(null);
	let overlay = $state.raw<MapboxOverlay | null>(null);
	let overlayCanvasWatcher: MutationObserver | null = null;
	let styleReady = $state(false);
	let previousSelected: number | null = null;
	let previousSelectedSegment: number | null = null;
	let previousCorrectedSegments: number[] = [];
	let previousIgnitions: number[] = [];

	function readBuildingIndex(feature: MapGeoJSONFeature): number | null {
		if (typeof feature.id === 'number') return feature.id;
		const raw = feature.properties?.buildingIndex;
		return typeof raw === 'number' ? raw : null;
	}

	function applyFeatureState(buildingIndex: number, state: Record<string, boolean>): void {
		map?.setFeatureState(
			{ source: BUILDING_SOURCE_ID, sourceLayer: BUILDING_SOURCE_LAYER, id: buildingIndex },
			state
		);
	}

	function applySegmentState(segmentId: number, state: Record<string, boolean>): void {
		map?.setFeatureState(
			{ source: ALLEY_SOURCE_ID, sourceLayer: ALLEY_SOURCE_LAYER, id: segmentId },
			state
		);
	}

	function keepOverlayCanvasOutOfTabOrder(root: HTMLDivElement): MutationObserver | null {
		const overlayCanvas = root.querySelector('#deckgl-overlay');
		if (!(overlayCanvas instanceof HTMLElement)) return null;

		const apply = (): void => {
			if (overlayCanvas.getAttribute('tabindex') !== '-1') {
				overlayCanvas.setAttribute('tabindex', '-1');
			}
			if (overlayCanvas.getAttribute('aria-hidden') !== 'true') {
				overlayCanvas.setAttribute('aria-hidden', 'true');
			}
		};

		apply();
		const watcher = new MutationObserver(apply);
		watcher.observe(overlayCanvas, { attributes: true, attributeFilter: ['tabindex', 'aria-hidden'] });
		return watcher;
	}

	function describeMapCanvas(map: maplibregl.Map): void {
		map.getCanvas().setAttribute('aria-label', MAP_CANVAS_LABEL);
	}

	function readSegmentId(feature: MapGeoJSONFeature): number | null {
		if (typeof feature.id === 'number') return feature.id;
		const raw = feature.properties?.segmentId;
		return typeof raw === 'number' ? raw : null;
	}

	onMount(() => {
		const protocol = new Protocol();
		maplibregl.addProtocol('pmtiles', protocol.tile);

		const created = new maplibregl.Map({
			container,
			style: buildMapStyle(
				new URL(DATA_URL.buildingTiles, window.location.href).href,
				new URL(DATA_URL.alleyTiles, window.location.href).href,
				bounds
			),
			bounds: [
				[bounds.west, bounds.south],
				[bounds.east, bounds.north]
			],
			fitBoundsOptions: { padding: 44 },
			minZoom: MAP_MIN_ZOOM,
			maxZoom: MAP_MAX_ZOOM,
			maxPitch: 0,
			dragRotate: false,
			attributionControl: false
		});

		created.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
		created.addControl(
			new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }),
			'bottom-right'
		);

		created.on('load', () => {
			void pasangLapisanDeck(created);
			void pasangBasemap(created);
			created.resize();
			created.fitBounds(
				[
					[bounds.west, bounds.south],
					[bounds.east, bounds.north]
				],
				{ padding: 44, animate: false }
			);
			styleReady = true;
			describeMapCanvas(created);
			onready?.(created);
		});

		const observer = new ResizeObserver(() => created.resize());
		observer.observe(container);

		created.on('click', (event) => {
			const position = { lon: event.lngLat.lng, lat: event.lngLat.lat };
			const buildingHit = created.queryRenderedFeatures(event.point, {
				layers: [BUILDING_FILL_LAYER_ID]
			})[0];
			if (buildingHit) {
				const index = readBuildingIndex(buildingHit);
				if (index !== null) {
					onbuildingpick?.(index, position);
					return;
				}
			}

			const tolerance = SEGMENT_PICK_TOLERANCE_PIXELS;
			const segmentHit = created.queryRenderedFeatures(
				[
					[event.point.x - tolerance, event.point.y - tolerance],
					[event.point.x + tolerance, event.point.y + tolerance]
				],
				{ layers: [ALLEY_LINE_LAYER_ID] }
			)[0];
			if (segmentHit) {
				const segmentId = readSegmentId(segmentHit);
				if (segmentId !== null) {
					onsegmentpick?.(segmentId, position);
					return;
				}
			}

			onmappick?.(position);
		});

		created.on('mouseenter', BUILDING_FILL_LAYER_ID, () => {
			created.getCanvas().style.cursor = 'crosshair';
		});
		created.on('mouseleave', BUILDING_FILL_LAYER_ID, () => {
			created.getCanvas().style.cursor = '';
		});

		map = created;

		return () => {
			observer.disconnect();
			overlayCanvasWatcher?.disconnect();
			overlayCanvasWatcher = null;
			overlay = null;
			created.remove();
			maplibregl.removeProtocol('pmtiles');
		};
	});

	async function pasangBasemap(created: maplibregl.Map): Promise<void> {
		try {
			const jawaban = await fetch(BASEMAP_STYLE_URL);
			if (!jawaban.ok) return;
			const gaya = (await jawaban.json()) as maplibregl.StyleSpecification;
			if (map !== created && map !== null) return;
			if (gaya.glyphs) created.setGlyphs(gaya.glyphs);
			if (typeof gaya.sprite === 'string') created.setSprite(gaya.sprite);
			const sumber = gaya.sources[BASEMAP_UPSTREAM_SOURCE];
			if (!sumber) return;
			created.addSource(BASEMAP_SOURCE_ID, sumber);
			const { bawah, atas } = splitBasemapLayers(gaya.layers, BASEMAP_SOURCE_ID);
			for (const lapisan of bawah) created.addLayer(lapisan, BUILDING_FILL_LAYER_ID);
			for (const lapisan of atas) created.addLayer(lapisan);
		} catch {
			return;
		}
	}

	async function pasangLapisanDeck(created: maplibregl.Map): Promise<void> {
		const { MapboxOverlay } = await import('@deck.gl/mapbox');
		if (map !== created && map !== null) return;
		const dibuat = new MapboxOverlay({ interleaved: false });
		created.addControl(dibuat);
		overlay = dibuat;
		overlayCanvasWatcher = keepOverlayCanvasOutOfTabOrder(container);
	}

	$effect(() => {
		const activeLayers = layers;
		const activeOverlay = overlay;
		const ready = styleReady;
		if (activeOverlay && ready) {
			activeOverlay.setProps({ layers: activeLayers });
		}
	});

	$effect(() => {
		const upgraded = upgradedAlleys;
		const muted = mutedAlleyClasses;
		if (map && styleReady) {
			map.setPaintProperty(
				ALLEY_LINE_LAYER_ID,
				'line-color',
				alleyColorExpression(upgraded, muted) as never
			);
		}
	});

	$effect(() => {
		const selected = selectedBuildingIndex;
		if (!map || !styleReady) return;
		if (previousSelected !== null && previousSelected !== selected) {
			applyFeatureState(previousSelected, { selected: false });
		}
		if (selected !== null) {
			applyFeatureState(selected, { selected: true });
		}
		previousSelected = selected;
	});

	$effect(() => {
		const segmentId = selectedSegmentId;
		if (!map || !styleReady) return;
		if (previousSelectedSegment !== null && previousSelectedSegment !== segmentId) {
			applySegmentState(previousSelectedSegment, { selected: false });
		}
		if (segmentId !== null) {
			applySegmentState(segmentId, { selected: true });
		}
		previousSelectedSegment = segmentId;
	});

	$effect(() => {
		const corrected = correctedSegmentIds;
		if (!map || !styleReady) return;
		for (const segmentId of previousCorrectedSegments) {
			applySegmentState(segmentId, { corrected: false });
		}
		for (const segmentId of corrected) {
			applySegmentState(segmentId, { corrected: true });
		}
		previousCorrectedSegments = [...corrected];
	});

	$effect(() => {
		const ignitions = ignitionBuildingIndices;
		if (!map || !styleReady) return;
		for (const index of previousIgnitions) {
			applyFeatureState(index, { ignition: false });
		}
		for (const index of ignitions) {
			applyFeatureState(index, { ignition: true });
		}
		previousIgnitions = [...ignitions];
	});
</script>

<div class="absolute inset-0">
	<div class="h-full w-full" bind:this={container} data-map-canvas></div>
</div>
