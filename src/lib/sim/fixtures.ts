import { ACCESS_CLASS_CODE, METERS_PER_DEGREE_LATITUDE } from '$lib/domain/constants';
import { buildAlleyNetwork, type GraphDocument } from '$lib/data/graph';
import type { AccessClass, AdjacencyTable, AlleyNetwork, BuildingTable } from '$lib/domain/types';

const ORIGIN_LON = 106.7;
const ORIGIN_LAT = -6.15;

export function latitudeAfterMeters(meters: number): number {
	return ORIGIN_LAT + meters / METERS_PER_DEGREE_LATITUDE;
}

export function longitudeAfterMeters(meters: number): number {
	return ORIGIN_LON + meters / (METERS_PER_DEGREE_LATITUDE * Math.cos((ORIGIN_LAT * Math.PI) / 180));
}

export function buildChainNetwork(
	classesAlongChain: AccessClass[],
	spacingMeters: number
): AlleyNetwork {
	const nodeCount = classesAlongChain.length + 1;
	const document: GraphDocument = {
		nodeLon: Array.from({ length: nodeCount }, () => ORIGIN_LON),
		nodeLat: Array.from({ length: nodeCount }, (_, index) =>
			latitudeAfterMeters(index * spacingMeters)
		),
		edgeFrom: classesAlongChain.map((_, index) => index),
		edgeTo: classesAlongChain.map((_, index) => index + 1),
		edgeLengthMeters: classesAlongChain.map(() => spacingMeters),
		edgeAccessClass: classesAlongChain.map((accessClass) => ACCESS_CLASS_CODE[accessClass]),
		edgeMinWidthMeters: classesAlongChain.map(() => 3),
		edgeMeanWidthMeters: classesAlongChain.map(() => 3),
		edgeSegmentId: classesAlongChain.map((_, index) => index),
		edgeIsNamedRoad: classesAlongChain.map((accessClass) =>
			accessClass === 'largeUnit' ? 1 : 0
		),
		waterSources: []
	};
	return buildAlleyNetwork(document);
}

export interface BuildingSeed {
	lon: number;
	lat: number;
	areaSquareMeters: number;
	heightMeters: number;
	materialCode: number;
	nearestNodeId: number;
	nearestNodeDistanceMeters: number;
}

export function buildBuildingTable(seeds: BuildingSeed[]): BuildingTable {
	return {
		count: seeds.length,
		lon: Float64Array.from(seeds.map((seed) => seed.lon)),
		lat: Float64Array.from(seeds.map((seed) => seed.lat)),
		areaSquareMeters: Float32Array.from(seeds.map((seed) => seed.areaSquareMeters)),
		heightMeters: Float32Array.from(seeds.map((seed) => seed.heightMeters)),
		materialClass: Uint8Array.from(seeds.map((seed) => seed.materialCode)),
		heightIsMeasured: Uint8Array.from(seeds.map(() => 0)),
		nearestNodeId: Int32Array.from(seeds.map((seed) => seed.nearestNodeId)),
		nearestNodeDistanceMeters: Float32Array.from(
			seeds.map((seed) => seed.nearestNodeDistanceMeters)
		)
	};
}

export function buildAdjacencyTable(neighbourLists: number[][], distanceMeters: number[][]): AdjacencyTable {
	const offsets = new Int32Array(neighbourLists.length + 1);
	for (let index = 0; index < neighbourLists.length; index += 1) {
		offsets[index + 1] = offsets[index] + neighbourLists[index].length;
	}
	const pairCount = offsets[neighbourLists.length];
	const neighbourIndex = new Uint32Array(pairCount);
	const edgeDistanceMeters = new Float32Array(pairCount);
	let cursor = 0;
	for (let index = 0; index < neighbourLists.length; index += 1) {
		for (let slot = 0; slot < neighbourLists[index].length; slot += 1) {
			neighbourIndex[cursor] = neighbourLists[index][slot];
			edgeDistanceMeters[cursor] = distanceMeters[index][slot];
			cursor += 1;
		}
	}
	return { count: neighbourLists.length, offsets, neighbourIndex, edgeDistanceMeters };
}

export function buildRowOfBuildings(
	count: number,
	gapMeters: number,
	footprintMeters: number
): { buildings: BuildingTable; adjacency: AdjacencyTable } {
	const pitch = gapMeters + footprintMeters;
	const seeds: BuildingSeed[] = Array.from({ length: count }, (_, index) => ({
		lon: longitudeAfterMeters(index * pitch),
		lat: ORIGIN_LAT,
		areaSquareMeters: footprintMeters * footprintMeters,
		heightMeters: 4,
		materialCode: 2,
		nearestNodeId: -1,
		nearestNodeDistanceMeters: 0
	}));

	const neighbourLists: number[][] = [];
	const distances: number[][] = [];
	for (let index = 0; index < count; index += 1) {
		const neighbours: number[] = [];
		const spans: number[] = [];
		if (index > 0) {
			neighbours.push(index - 1);
			spans.push(gapMeters);
		}
		if (index < count - 1) {
			neighbours.push(index + 1);
			spans.push(gapMeters);
		}
		neighbourLists.push(neighbours);
		distances.push(spans);
	}

	return {
		buildings: buildBuildingTable(seeds),
		adjacency: buildAdjacencyTable(neighbourLists, distances)
	};
}
