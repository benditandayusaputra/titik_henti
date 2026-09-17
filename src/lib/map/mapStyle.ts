import type { StyleSpecification } from 'maplibre-gl';
import {
	ACCESS_CLASS_MAP_COLOR,
	ACCESS_CLASS_MUTED_MAP_COLOR,
	MAP_MAX_ZOOM,
	MAP_MIN_ZOOM
} from '$lib/domain/constants';
import type { AccessClass, BoundingBox } from '$lib/domain/types';

export const BUILDING_SOURCE_ID = 'buildings';
export const ALLEY_SOURCE_ID = 'gangs';
export const BUILDING_SOURCE_LAYER = 'buildings';
export const ALLEY_SOURCE_LAYER = 'gangs';
export const BUILDING_FILL_LAYER_ID = 'building-fill';
export const ALLEY_LINE_LAYER_ID = 'alley-line';
export const ALLEY_CASING_LAYER_ID = 'alley-casing';
export const ALLEY_SELECTED_LAYER_ID = 'alley-selected';
export const ALLEY_CORRECTED_LAYER_ID = 'alley-corrected';

const BACKGROUND_COLOR = '#1a1a1c';
const BUILDING_FILL_COLOR = '#2c2c34';
const BUILDING_OUTLINE_COLOR = '#43434e';
const BUILDING_SELECTED_COLOR = '#e8e6e1';
const BUILDING_IGNITION_COLOR = '#d6202a';
const ALLEY_SELECTED_COLOR = '#f2f0ec';
const ALLEY_CORRECTED_COLOR = '#e8e6e1';

const UPGRADED_CLASS: Record<AccessClass, AccessClass> = {
	hoseOnly: 'smallUnit',
	smallUnit: 'largeUnit',
	largeUnit: 'largeUnit'
};

function buildClassColorExpression(upgraded: boolean, muted: boolean): unknown[] {
	const palette = muted ? ACCESS_CLASS_MUTED_MAP_COLOR : ACCESS_CLASS_MAP_COLOR;
	const pick = (accessClass: AccessClass): string =>
		palette[upgraded ? UPGRADED_CLASS[accessClass] : accessClass];
	return [
		'match',
		['get', 'accessClass'],
		'largeUnit',
		pick('largeUnit'),
		'smallUnit',
		pick('smallUnit'),
		pick('hoseOnly')
	];
}

function buildClassWidthExpression(): unknown[] {
	return [
		'interpolate',
		['exponential', 1.6],
		['zoom'],
		13,
		['match', ['get', 'accessClass'], 'largeUnit', 0.6, 'smallUnit', 0.4, 0.3],
		16,
		['match', ['get', 'accessClass'], 'largeUnit', 2, 'smallUnit', 1.3, 0.95],
		19,
		['match', ['get', 'accessClass'], 'largeUnit', 8, 'smallUnit', 5, 3.4]
	];
}

export function buildMapStyle(
	buildingTilesUrl: string,
	alleyTilesUrl: string,
	bounds: BoundingBox
): StyleSpecification {
	return {
		version: 8,
		name: 'titik-henti-lapangan',
		sources: {
			[BUILDING_SOURCE_ID]: {
				type: 'vector',
				url: `pmtiles://${buildingTilesUrl}`,
				attribution: 'Google Open Buildings V3 (CC BY 4.0)',
				bounds: [bounds.west, bounds.south, bounds.east, bounds.north]
			},
			[ALLEY_SOURCE_ID]: {
				type: 'vector',
				url: `pmtiles://${alleyTilesUrl}`,
				attribution: 'OpenStreetMap (ODbL) · turunan Titik Henti',
				bounds: [bounds.west, bounds.south, bounds.east, bounds.north]
			}
		},
		layers: [
			{
				id: 'background',
				type: 'background',
				paint: { 'background-color': BACKGROUND_COLOR }
			},
			{
				id: BUILDING_FILL_LAYER_ID,
				type: 'fill',
				source: BUILDING_SOURCE_ID,
				'source-layer': BUILDING_SOURCE_LAYER,
				paint: {
					'fill-color': [
						'case',
						['boolean', ['feature-state', 'ignition'], false],
						BUILDING_IGNITION_COLOR,
						['boolean', ['feature-state', 'selected'], false],
						BUILDING_SELECTED_COLOR,
						BUILDING_FILL_COLOR
					],
					'fill-opacity': [
						'case',
						['boolean', ['feature-state', 'selected'], false],
						0.95,
						['boolean', ['feature-state', 'ignition'], false],
						0.95,
						0.85
					]
				}
			},
			{
				id: 'building-outline',
				type: 'line',
				source: BUILDING_SOURCE_ID,
				'source-layer': BUILDING_SOURCE_LAYER,
				minzoom: 15,
				paint: {
					'line-color': BUILDING_OUTLINE_COLOR,
					'line-width': ['interpolate', ['linear'], ['zoom'], 15, 0.2, 19, 0.8]
				}
			},
			{
				id: ALLEY_CASING_LAYER_ID,
				type: 'line',
				source: ALLEY_SOURCE_ID,
				'source-layer': ALLEY_SOURCE_LAYER,
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: {
					'line-color': BACKGROUND_COLOR,
					'line-opacity': 0.85,
					'line-width': [
						'interpolate',
						['exponential', 1.6],
						['zoom'],
						13,
						1.3,
						16,
						3.4,
						19,
						11
					]
				}
			},
			{
				id: ALLEY_SELECTED_LAYER_ID,
				type: 'line',
				source: ALLEY_SOURCE_ID,
				'source-layer': ALLEY_SOURCE_LAYER,
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: {
					'line-color': ALLEY_SELECTED_COLOR,
					'line-opacity': [
						'case',
						['boolean', ['feature-state', 'selected'], false],
						0.55,
						0
					],
					'line-width': [
						'interpolate',
						['exponential', 1.6],
						['zoom'],
						13,
						3.2,
						16,
						8,
						19,
						22
					]
				}
			},
			{
				id: ALLEY_LINE_LAYER_ID,
				type: 'line',
				source: ALLEY_SOURCE_ID,
				'source-layer': ALLEY_SOURCE_LAYER,
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: {
					'line-color': buildClassColorExpression(false, false) as never,
					'line-width': buildClassWidthExpression() as never,
					'line-opacity': 0.92
				}
			},
			{
				id: ALLEY_CORRECTED_LAYER_ID,
				type: 'line',
				source: ALLEY_SOURCE_ID,
				'source-layer': ALLEY_SOURCE_LAYER,
				layout: { 'line-cap': 'butt', 'line-join': 'round' },
				paint: {
					'line-color': ALLEY_CORRECTED_COLOR,
					'line-dasharray': [1, 1.6],
					'line-opacity': [
						'case',
						['boolean', ['feature-state', 'corrected'], false],
						1,
						0
					],
					'line-width': [
						'interpolate',
						['exponential', 1.6],
						['zoom'],
						13,
						1.1,
						16,
						2.6,
						19,
						6
					]
				}
			}
		],
		minzoom: MAP_MIN_ZOOM,
		maxzoom: MAP_MAX_ZOOM
	} as StyleSpecification;
}

export function alleyColorExpression(upgraded: boolean, muted: boolean): unknown[] {
	return buildClassColorExpression(upgraded, muted);
}
