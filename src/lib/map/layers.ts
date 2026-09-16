import type { Layer } from '@deck.gl/core';
import { PathStyleExtension, type PathStyleExtensionProps } from '@deck.gl/extensions';
import { PathLayer, PolygonLayer, ScatterplotLayer } from '@deck.gl/layers';
import {
	BUILDING_STATE_INTACT,
	BUILDING_STATE_RGB,
	BUILDING_STATE_BURNT_OUT,
	HOSE_ROLL_LENGTH_METERS,
	METERS_PER_DEGREE_LATITUDE
} from '$lib/domain/constants';
import type {
	BuildingTable,
	HoseReachResult,
	LonLat,
	StopPointSolution,
	UnreachedPocket,
	WaterSource
} from '$lib/domain/types';
import { clipPathToLength, interpolateAlongPath } from '$lib/sim/geo';

const TICK_HALF_LENGTH_METERS = 3.2;
const WATER_RGB: [number, number, number] = [15, 124, 138];
const ALARM_RGB: [number, number, number] = [214, 32, 42];
const CONCRETE_RGB: [number, number, number] = [232, 230, 225];
const INK_RGB: [number, number, number] = [26, 26, 28];
const MAX_POCKETS_DRAWN = 40;

interface PathDatum {
	path: [number, number][];
}

function toPositions(path: LonLat[]): [number, number][] {
	return path.map((point) => [point.lon, point.lat]);
}

export function buildHosePathLayer(
	solution: StopPointSolution,
	drawnMeters: number
): Layer[] {
	if (!solution.reachable || solution.hosePath.length < 2) return [];
	const clipped = clipPathToLength(solution.hosePath, Math.max(drawnMeters, 0.5));
	const full: PathDatum[] = [{ path: toPositions(solution.hosePath) }];
	const drawn: PathDatum[] = [{ path: toPositions(clipped) }];

	return [
		new PathLayer<PathDatum, PathStyleExtensionProps<PathDatum>>({
			id: 'hose-path-ghost',
			data: full,
			getPath: (datum) => datum.path,
			getColor: [...WATER_RGB, 70],
			getWidth: 2,
			widthUnits: 'pixels',
			widthMinPixels: 2,
			capRounded: true,
			jointRounded: true,
			getDashArray: [6, 4],
			dashJustified: true,
			extensions: [new PathStyleExtension({ dash: true })]
		}),
		new PathLayer<PathDatum>({
			id: 'hose-path-drawn',
			data: drawn,
			getPath: (datum) => datum.path,
			getColor: [...WATER_RGB, 255],
			getWidth: 4,
			widthUnits: 'pixels',
			widthMinPixels: 3,
			capRounded: true,
			jointRounded: true
		})
	];
}

export function buildHoseTickLayer(
	solution: StopPointSolution,
	drawnMeters: number
): Layer[] {
	if (!solution.reachable || solution.hosePath.length < 2) return [];
	const ticks: PathDatum[] = [];
	const latitudeScale = METERS_PER_DEGREE_LATITUDE;
	const longitudeScale =
		METERS_PER_DEGREE_LATITUDE * Math.cos((solution.hosePath[0].lat * Math.PI) / 180);

	for (
		let marker = HOSE_ROLL_LENGTH_METERS;
		marker <= Math.min(drawnMeters, solution.hoseLengthMeters);
		marker += HOSE_ROLL_LENGTH_METERS
	) {
		const at = interpolateAlongPath(solution.hosePath, marker);
		const ahead = interpolateAlongPath(solution.hosePath, marker + 1);
		const deltaLon = (ahead.lon - at.lon) * longitudeScale;
		const deltaLat = (ahead.lat - at.lat) * latitudeScale;
		const length = Math.hypot(deltaLon, deltaLat) || 1;
		const normalLon = (-deltaLat / length) * TICK_HALF_LENGTH_METERS;
		const normalLat = (deltaLon / length) * TICK_HALF_LENGTH_METERS;
		ticks.push({
			path: [
				[at.lon + normalLon / longitudeScale, at.lat + normalLat / latitudeScale],
				[at.lon - normalLon / longitudeScale, at.lat - normalLat / latitudeScale]
			]
		});
	}

	if (ticks.length === 0) return [];

	return [
		new PathLayer<PathDatum>({
			id: 'hose-ticks',
			data: ticks,
			getPath: (datum) => datum.path,
			getColor: [...CONCRETE_RGB, 235],
			getWidth: 2,
			widthUnits: 'pixels',
			widthMinPixels: 2
		})
	];
}

interface PointDatum {
	position: [number, number];
}

export function buildStopPointLayer(solution: StopPointSolution): Layer[] {
	if (!solution.reachable) return [];
	const data: PointDatum[] = [{ position: [solution.stopPoint.lon, solution.stopPoint.lat] }];
	return [
		new ScatterplotLayer<PointDatum>({
			id: 'stop-point-halo',
			data,
			getPosition: (datum) => datum.position,
			getRadius: 11,
			radiusUnits: 'pixels',
			getFillColor: [...CONCRETE_RGB, 235],
			stroked: false
		}),
		new ScatterplotLayer<PointDatum>({
			id: 'stop-point-core',
			data,
			getPosition: (datum) => datum.position,
			getRadius: 5,
			radiusUnits: 'pixels',
			getFillColor: [...INK_RGB, 255],
			stroked: false
		})
	];
}

interface FireDatum {
	position: [number, number];
	state: number;
	radius: number;
}

export function buildFireStateLayer(
	buildings: BuildingTable,
	state: Uint8Array
): Layer[] {
	const data: FireDatum[] = [];
	for (let index = 0; index < buildings.count; index += 1) {
		if (state[index] === BUILDING_STATE_INTACT) continue;
		data.push({
			position: [buildings.lon[index], buildings.lat[index]],
			state: state[index],
			radius: Math.max(2.6, Math.sqrt(buildings.areaSquareMeters[index]) * 0.45)
		});
	}
	if (data.length === 0) return [];
	return [
		new ScatterplotLayer<FireDatum>({
			id: 'fire-state',
			data,
			getPosition: (datum) => datum.position,
			getRadius: (datum) => datum.radius,
			radiusUnits: 'meters',
			radiusMinPixels: 2,
			getFillColor: (datum) => {
				const rgb = BUILDING_STATE_RGB[datum.state] ?? [126, 126, 132];
				return [rgb[0], rgb[1], rgb[2], datum.state === BUILDING_STATE_BURNT_OUT ? 200 : 235];
			},
			stroked: false,
			updateTriggers: { getFillColor: state }
		})
	];
}

export function buildReachedBuildingsLayer(
	buildings: BuildingTable,
	reach: HoseReachResult
): Layer[] {
	const data: PointDatum[] = [];
	for (let index = 0; index < buildings.count; index += 1) {
		if (reach.buildingReached[index] !== 1) continue;
		data.push({ position: [buildings.lon[index], buildings.lat[index]] });
	}
	if (data.length === 0) return [];
	return [
		new ScatterplotLayer<PointDatum>({
			id: 'hose-reach-cover',
			data,
			getPosition: (datum) => datum.position,
			getRadius: 9,
			radiusUnits: 'meters',
			radiusMinPixels: 2,
			getFillColor: [...WATER_RGB, 55],
			stroked: false
		})
	];
}

interface PolygonDatum {
	polygon: [number, number][];
	buildingCount: number;
}

function buildConvexHull(points: [number, number][]): [number, number][] {
	if (points.length < 3) return points;
	const sorted = [...points].sort((first, second) =>
		first[0] === second[0] ? first[1] - second[1] : first[0] - second[0]
	);
	const cross = (
		origin: [number, number],
		first: [number, number],
		second: [number, number]
	): number =>
		(first[0] - origin[0]) * (second[1] - origin[1]) -
		(first[1] - origin[1]) * (second[0] - origin[0]);

	const lower: [number, number][] = [];
	for (const point of sorted) {
		while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
			lower.pop();
		}
		lower.push(point);
	}
	const upper: [number, number][] = [];
	for (let index = sorted.length - 1; index >= 0; index -= 1) {
		const point = sorted[index];
		while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
			upper.pop();
		}
		upper.push(point);
	}
	lower.pop();
	upper.pop();
	return [...lower, ...upper];
}

export function buildPocketLayer(
	buildings: BuildingTable,
	pockets: UnreachedPocket[]
): Layer[] {
	const data: PolygonDatum[] = [];
	for (const pocket of pockets.slice(0, MAX_POCKETS_DRAWN)) {
		if (pocket.buildingCount < 3) continue;
		const points = pocket.buildingIndices.map(
			(index) => [buildings.lon[index], buildings.lat[index]] as [number, number]
		);
		const hull = buildConvexHull(points);
		if (hull.length < 3) continue;
		data.push({ polygon: hull, buildingCount: pocket.buildingCount });
	}
	if (data.length === 0) return [];
	return [
		new PolygonLayer<PolygonDatum, PathStyleExtensionProps<PolygonDatum>>({
			id: 'unreached-pockets',
			data,
			getPolygon: (datum) => datum.polygon,
			filled: true,
			getFillColor: [...ALARM_RGB, 26],
			stroked: true,
			getLineColor: [...ALARM_RGB, 220],
			getLineWidth: 2,
			lineWidthUnits: 'pixels',
			lineWidthMinPixels: 1.5,
			getDashArray: [7, 5],
			dashJustified: true,
			extensions: [new PathStyleExtension({ dash: true })]
		})
	];
}

interface WaterDatum {
	position: [number, number];
	hypothetical: boolean;
}

export function buildWaterSourceLayer(sources: WaterSource[]): Layer[] {
	const data: WaterDatum[] = sources
		.filter((source) => source.kind !== 'applianceStand')
		.map((source) => ({
			position: [source.lon, source.lat],
			hypothetical: source.kind === 'hypothetical'
		}));
	if (data.length === 0) return [];
	return [
		new ScatterplotLayer<WaterDatum>({
			id: 'water-sources',
			data,
			getPosition: (datum) => datum.position,
			getRadius: 6,
			radiusUnits: 'pixels',
			getFillColor: (datum) => (datum.hypothetical ? [...CONCRETE_RGB, 245] : [...WATER_RGB, 245]),
			stroked: true,
			getLineColor: (datum) => (datum.hypothetical ? [...WATER_RGB, 255] : [...CONCRETE_RGB, 220]),
			getLineWidth: 2,
			lineWidthUnits: 'pixels'
		})
	];
}

export function buildInterventionLayer(positions: LonLat[]): Layer[] {
	if (positions.length === 0) return [];
	const data: PointDatum[] = positions.map((position) => ({
		position: [position.lon, position.lat]
	}));
	return [
		new ScatterplotLayer<PointDatum>({
			id: 'intervention-markers',
			data,
			getPosition: (datum) => datum.position,
			getRadius: 8,
			radiusUnits: 'pixels',
			getFillColor: [...CONCRETE_RGB, 0],
			stroked: true,
			getLineColor: [...CONCRETE_RGB, 255],
			getLineWidth: 2,
			lineWidthUnits: 'pixels'
		})
	];
}

export function measureSolutionTip(solution: StopPointSolution, drawnMeters: number): LonLat {
	return interpolateAlongPath(solution.hosePath, drawnMeters);
}
