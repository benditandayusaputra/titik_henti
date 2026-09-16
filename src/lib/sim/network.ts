import type { AlleyNetwork, LonLat } from '$lib/domain/types';
import { metersBetween } from '$lib/sim/geo';

export function findNearestNode(network: AlleyNetwork, position: LonLat): number {
	let bestNode = -1;
	let bestDistance = Infinity;
	for (let node = 0; node < network.nodeCount; node += 1) {
		const candidate = metersBetween(position, {
			lon: network.nodeLon[node],
			lat: network.nodeLat[node]
		});
		if (candidate < bestDistance) {
			bestDistance = candidate;
			bestNode = node;
		}
	}
	return bestNode;
}

export function listEdgeCoordinates(network: AlleyNetwork, edgeId: number): LonLat[] {
	return [
		{ lon: network.nodeLon[network.edgeFrom[edgeId]], lat: network.nodeLat[network.edgeFrom[edgeId]] },
		{ lon: network.nodeLon[network.edgeTo[edgeId]], lat: network.nodeLat[network.edgeTo[edgeId]] }
	];
}

export function rankSlowestBuildings(
	secondsPerBuilding: Float32Array,
	limit: number
): number[] {
	const indices: number[] = [];
	for (let index = 0; index < secondsPerBuilding.length; index += 1) {
		if (Number.isFinite(secondsPerBuilding[index])) indices.push(index);
	}
	indices.sort((first, second) => secondsPerBuilding[second] - secondsPerBuilding[first]);
	return indices.slice(0, limit);
}
