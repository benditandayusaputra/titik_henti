import { ACCESS_CLASS_BY_CODE } from '$lib/domain/constants';
import type { AlleyEdge, AlleyNetwork, WaterSource, WaterSourceKind } from '$lib/domain/types';

export interface GraphDocument {
	nodeLon: number[];
	nodeLat: number[];
	edgeFrom: number[];
	edgeTo: number[];
	edgeLengthMeters: number[];
	edgeAccessClass: number[];
	edgeMinWidthMeters: number[];
	edgeMeanWidthMeters: number[];
	edgeSegmentId: number[];
	edgeIsNamedRoad: number[];
	waterSources: {
		id: number;
		lon: number;
		lat: number;
		kind: string;
		label: string;
		nearestNodeId: number;
		nearestNodeDistanceMeters: number;
	}[];
}

export function buildAlleyNetwork(document: GraphDocument): AlleyNetwork {
	const nodeCount = document.nodeLon.length;
	const edgeCount = document.edgeFrom.length;

	const edgeFrom = Int32Array.from(document.edgeFrom);
	const edgeTo = Int32Array.from(document.edgeTo);
	const edgeLengthMeters = Float32Array.from(document.edgeLengthMeters);
	const edgeAccessClass = Uint8Array.from(document.edgeAccessClass);
	const edgeSegmentId = Int32Array.from(document.edgeSegmentId);
	const edgeMinWidthMeters = Float32Array.from(document.edgeMinWidthMeters);
	const edgeMeanWidthMeters = Float32Array.from(document.edgeMeanWidthMeters);
	const edgeIsNamedRoad = Uint8Array.from(document.edgeIsNamedRoad);

	const degrees = new Int32Array(nodeCount);
	for (let edge = 0; edge < edgeCount; edge += 1) {
		degrees[edgeFrom[edge]] += 1;
		degrees[edgeTo[edge]] += 1;
	}

	const adjacencyOffsets = new Int32Array(nodeCount + 1);
	for (let node = 0; node < nodeCount; node += 1) {
		adjacencyOffsets[node + 1] = adjacencyOffsets[node] + degrees[node];
	}

	const cursor = adjacencyOffsets.slice(0, nodeCount);
	const adjacencyTargets = new Int32Array(edgeCount * 2);
	const adjacencyEdgeIds = new Int32Array(edgeCount * 2);
	for (let edge = 0; edge < edgeCount; edge += 1) {
		const from = edgeFrom[edge];
		const to = edgeTo[edge];
		adjacencyTargets[cursor[from]] = to;
		adjacencyEdgeIds[cursor[from]] = edge;
		cursor[from] += 1;
		adjacencyTargets[cursor[to]] = from;
		adjacencyEdgeIds[cursor[to]] = edge;
		cursor[to] += 1;
	}

	return {
		nodeCount,
		nodeLon: Float64Array.from(document.nodeLon),
		nodeLat: Float64Array.from(document.nodeLat),
		adjacencyOffsets,
		adjacencyTargets,
		adjacencyEdgeIds,
		edgeFrom,
		edgeTo,
		edgeLengthMeters,
		edgeAccessClass,
		edgeSegmentId,
		edgeMinWidthMeters,
		edgeMeanWidthMeters,
		edgeIsNamedRoad,
		edgeCount
	};
}

export function listAlleyEdges(network: AlleyNetwork): AlleyEdge[] {
	const edges: AlleyEdge[] = [];
	for (let edge = 0; edge < network.edgeCount; edge += 1) {
		edges.push({
			id: edge,
			segmentId: network.edgeSegmentId[edge],
			fromNodeId: network.edgeFrom[edge],
			toNodeId: network.edgeTo[edge],
			lengthMeters: network.edgeLengthMeters[edge],
			minWidthMeters: network.edgeMinWidthMeters[edge],
			meanWidthMeters: network.edgeMeanWidthMeters[edge],
			accessClass: ACCESS_CLASS_BY_CODE[network.edgeAccessClass[edge]],
			isNamedRoad: network.edgeIsNamedRoad[edge] === 1
		});
	}
	return edges;
}

export function listWaterSources(document: GraphDocument): WaterSource[] {
	return document.waterSources.map((source) => ({
		id: source.id,
		lon: source.lon,
		lat: source.lat,
		kind: source.kind as WaterSourceKind,
		label: source.label,
		nearestNodeId: source.nearestNodeId,
		nearestNodeDistanceMeters: source.nearestNodeDistanceMeters
	}));
}
