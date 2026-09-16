import type {
	AdjacencyTable,
	AlleyNetwork,
	BuildingTable,
	HoseReachResult,
	UnreachedPocket
} from '$lib/domain/types';
import { MinHeap } from '$lib/sim/heap';
import { estimateHoseDeploySeconds } from '$lib/sim/stopPoint';

const UNREACHED_POCKET = -1;

export interface HoseReachInput {
	network: AlleyNetwork;
	buildings: BuildingTable;
	adjacency: AdjacencyTable;
	sourceNodeIds: number[];
	maximumHoseLengthMeters: number;
}

export function computeReachedNodeDistances(
	network: AlleyNetwork,
	sourceNodeIds: number[],
	maximumHoseLengthMeters: number
): Float32Array {
	const distanceMeters = new Float32Array(network.nodeCount).fill(Infinity);
	const settled = new Uint8Array(network.nodeCount);
	const queue = new MinHeap(network.nodeCount + sourceNodeIds.length);

	for (const node of sourceNodeIds) {
		if (node < 0 || node >= network.nodeCount) continue;
		distanceMeters[node] = 0;
		queue.push(node, 0);
	}

	while (queue.length > 0) {
		const node = queue.pop();
		if (settled[node] === 1) continue;
		settled[node] = 1;
		const base = distanceMeters[node];
		if (base > maximumHoseLengthMeters) continue;
		for (let slot = network.adjacencyOffsets[node]; slot < network.adjacencyOffsets[node + 1]; slot += 1) {
			const neighbour = network.adjacencyTargets[slot];
			if (settled[neighbour] === 1) continue;
			const edge = network.adjacencyEdgeIds[slot];
			const candidate = base + network.edgeLengthMeters[edge];
			if (candidate > maximumHoseLengthMeters) continue;
			if (candidate < distanceMeters[neighbour]) {
				distanceMeters[neighbour] = candidate;
				queue.push(neighbour, candidate);
			}
		}
	}

	return distanceMeters;
}

export function groupUnreachedIntoPockets(
	buildings: BuildingTable,
	adjacency: AdjacencyTable,
	buildingReached: Uint8Array
): { pocketOfBuilding: Int32Array; pockets: UnreachedPocket[] } {
	const pocketOfBuilding = new Int32Array(buildings.count).fill(UNREACHED_POCKET);
	const pockets: UnreachedPocket[] = [];
	const stack: number[] = [];

	for (let seed = 0; seed < buildings.count; seed += 1) {
		if (buildingReached[seed] === 1 || pocketOfBuilding[seed] !== UNREACHED_POCKET) continue;
		const pocketId = pockets.length;
		const members: number[] = [];
		stack.push(seed);
		pocketOfBuilding[seed] = pocketId;

		while (stack.length > 0) {
			const current = stack.pop() as number;
			members.push(current);
			for (let slot = adjacency.offsets[current]; slot < adjacency.offsets[current + 1]; slot += 1) {
				const neighbour = adjacency.neighbourIndex[slot];
				if (buildingReached[neighbour] === 1) continue;
				if (pocketOfBuilding[neighbour] !== UNREACHED_POCKET) continue;
				pocketOfBuilding[neighbour] = pocketId;
				stack.push(neighbour);
			}
		}

		let sumLon = 0;
		let sumLat = 0;
		for (const member of members) {
			sumLon += buildings.lon[member];
			sumLat += buildings.lat[member];
		}
		pockets.push({
			id: pocketId,
			buildingIndices: members,
			centroid: { lon: sumLon / members.length, lat: sumLat / members.length },
			buildingCount: members.length
		});
	}

	pockets.sort((first, second) => second.buildingCount - first.buildingCount);
	for (let rank = 0; rank < pockets.length; rank += 1) {
		for (const member of pockets[rank].buildingIndices) {
			pocketOfBuilding[member] = rank;
		}
		pockets[rank].id = rank;
	}

	return { pocketOfBuilding, pockets };
}

export function computeHoseReach(input: HoseReachInput): HoseReachResult {
	const { network, buildings, adjacency, sourceNodeIds, maximumHoseLengthMeters } = input;
	const reachedNodeDistanceMeters = computeReachedNodeDistances(
		network,
		sourceNodeIds,
		maximumHoseLengthMeters
	);

	const buildingReached = new Uint8Array(buildings.count);
	const buildingWaterDelaySeconds = new Float32Array(buildings.count).fill(Infinity);
	let reachedBuildingCount = 0;

	for (let index = 0; index < buildings.count; index += 1) {
		const entryNode = buildings.nearestNodeId[index];
		if (entryNode < 0) continue;
		const nodeDistance = reachedNodeDistanceMeters[entryNode];
		if (!Number.isFinite(nodeDistance)) continue;
		const totalMeters = nodeDistance + buildings.nearestNodeDistanceMeters[index];
		if (totalMeters > maximumHoseLengthMeters) continue;
		buildingReached[index] = 1;
		buildingWaterDelaySeconds[index] = estimateHoseDeploySeconds(totalMeters);
		reachedBuildingCount += 1;
	}

	const { pocketOfBuilding, pockets } = groupUnreachedIntoPockets(
		buildings,
		adjacency,
		buildingReached
	);

	return {
		reachedNodeDistanceMeters,
		buildingReached,
		buildingWaterDelaySeconds,
		unreachedPocketOfBuilding: pocketOfBuilding,
		pockets,
		reachedBuildingCount,
		unreachedBuildingCount: buildings.count - reachedBuildingCount
	};
}
