import {
	ACCESS_CLASS_BY_CODE,
	ACCESS_CLASS_CODE,
	APPLIANCE_TURNOUT_SECONDS,
	CREW_APPROACH_SPEED_METERS_PER_SECOND,
	HOSE_COUPLING_SECONDS_PER_JOINT,
	HOSE_DEPLOY_SECONDS_PER_ROLL,
	HOSE_ROLL_LENGTH_METERS
} from '$lib/domain/constants';
import type {
	AccessClass,
	AlleyNetwork,
	BuildingTable,
	LonLat,
	StopPointSolution,
	WaterArrivalField
} from '$lib/domain/types';
import { MinHeap } from '$lib/sim/heap';

export interface StopPointField {
	distanceMeters: Float32Array;
	stopNodeOfNode: Int32Array;
	nextHopNode: Int32Array;
	nextHopEdge: Int32Array;
}

const UNREACHED = -1;

export function collectStopPointCandidates(network: AlleyNetwork): number[] {
	const largeUnitCode = ACCESS_CLASS_CODE.largeUnit;
	const componentOfNode = new Int32Array(network.nodeCount).fill(UNREACHED);
	const componentHasNamedRoad: boolean[] = [];
	const stack: number[] = [];

	for (let seed = 0; seed < network.nodeCount; seed += 1) {
		if (componentOfNode[seed] !== UNREACHED) continue;
		let touchesLargeUnit = false;
		for (let slot = network.adjacencyOffsets[seed]; slot < network.adjacencyOffsets[seed + 1]; slot += 1) {
			if (network.edgeAccessClass[network.adjacencyEdgeIds[slot]] === largeUnitCode) {
				touchesLargeUnit = true;
				break;
			}
		}
		if (!touchesLargeUnit) continue;

		const componentId = componentHasNamedRoad.length;
		componentHasNamedRoad.push(false);
		componentOfNode[seed] = componentId;
		stack.push(seed);

		while (stack.length > 0) {
			const node = stack.pop() as number;
			for (let slot = network.adjacencyOffsets[node]; slot < network.adjacencyOffsets[node + 1]; slot += 1) {
				const edge = network.adjacencyEdgeIds[slot];
				if (network.edgeAccessClass[edge] !== largeUnitCode) continue;
				if (network.edgeIsNamedRoad[edge] === 1) componentHasNamedRoad[componentId] = true;
				const neighbour = network.adjacencyTargets[slot];
				if (componentOfNode[neighbour] !== UNREACHED) continue;
				componentOfNode[neighbour] = componentId;
				stack.push(neighbour);
			}
		}
	}

	const anyNamedRoad = componentHasNamedRoad.some((hasNamedRoad) => hasNamedRoad);
	const candidates: number[] = [];
	for (let node = 0; node < network.nodeCount; node += 1) {
		const componentId = componentOfNode[node];
		if (componentId === UNREACHED) continue;
		if (anyNamedRoad && !componentHasNamedRoad[componentId]) continue;
		candidates.push(node);
	}
	return candidates;
}

export function computeStopPointField(
	network: AlleyNetwork,
	candidateNodes: number[]
): StopPointField {
	const distanceMeters = new Float32Array(network.nodeCount).fill(Infinity);
	const stopNodeOfNode = new Int32Array(network.nodeCount).fill(UNREACHED);
	const nextHopNode = new Int32Array(network.nodeCount).fill(UNREACHED);
	const nextHopEdge = new Int32Array(network.nodeCount).fill(UNREACHED);
	const settled = new Uint8Array(network.nodeCount);
	const queue = new MinHeap(network.nodeCount + candidateNodes.length);

	for (const node of candidateNodes) {
		distanceMeters[node] = 0;
		stopNodeOfNode[node] = node;
		queue.push(node, 0);
	}

	while (queue.length > 0) {
		const node = queue.pop();
		if (settled[node] === 1) continue;
		settled[node] = 1;
		const start = network.adjacencyOffsets[node];
		const end = network.adjacencyOffsets[node + 1];
		for (let slot = start; slot < end; slot += 1) {
			const neighbour = network.adjacencyTargets[slot];
			if (settled[neighbour] === 1) continue;
			const edge = network.adjacencyEdgeIds[slot];
			const candidate = distanceMeters[node] + network.edgeLengthMeters[edge];
			if (candidate < distanceMeters[neighbour]) {
				distanceMeters[neighbour] = candidate;
				stopNodeOfNode[neighbour] = stopNodeOfNode[node];
				nextHopNode[neighbour] = node;
				nextHopEdge[neighbour] = edge;
				queue.push(neighbour, candidate);
			}
		}
	}

	return { distanceMeters, stopNodeOfNode, nextHopNode, nextHopEdge };
}

export function countHoseRolls(hoseLengthMeters: number): number {
	return Math.max(1, Math.ceil(hoseLengthMeters / HOSE_ROLL_LENGTH_METERS));
}

export function estimateHoseDeploySeconds(hoseLengthMeters: number): number {
	const rolls = countHoseRolls(hoseLengthMeters);
	const joints = Math.max(0, rolls - 1);
	return (
		APPLIANCE_TURNOUT_SECONDS +
		rolls * HOSE_DEPLOY_SECONDS_PER_ROLL +
		joints * HOSE_COUPLING_SECONDS_PER_JOINT +
		hoseLengthMeters / CREW_APPROACH_SPEED_METERS_PER_SECOND / 2
	);
}

export function solveStopPoint(
	network: AlleyNetwork,
	field: StopPointField,
	buildings: BuildingTable,
	buildingIndex: number
): StopPointSolution {
	const buildingPosition: LonLat = {
		lon: buildings.lon[buildingIndex],
		lat: buildings.lat[buildingIndex]
	};
	const entryNode = buildings.nearestNodeId[buildingIndex];
	const connectionMeters = buildings.nearestNodeDistanceMeters[buildingIndex];

	if (entryNode < 0 || field.stopNodeOfNode[entryNode] === UNREACHED) {
		return {
			buildingIndex,
			stopNodeId: UNREACHED,
			stopPoint: buildingPosition,
			hosePath: [buildingPosition],
			hoseLengthMeters: Infinity,
			hoseRollCount: 0,
			extraDelaySeconds: Infinity,
			reachable: false,
			blockingAccessClass: null
		};
	}

	const hosePath: LonLat[] = [buildingPosition];
	let narrowestCode = ACCESS_CLASS_CODE.largeUnit;
	let node = entryNode;
	hosePath.push({ lon: network.nodeLon[node], lat: network.nodeLat[node] });

	let guard = network.nodeCount;
	while (field.nextHopNode[node] !== UNREACHED && guard > 0) {
		const edge = field.nextHopEdge[node];
		if (edge >= 0) {
			narrowestCode = Math.min(narrowestCode, network.edgeAccessClass[edge]);
		}
		node = field.nextHopNode[node];
		hosePath.push({ lon: network.nodeLon[node], lat: network.nodeLat[node] });
		guard -= 1;
	}

	const hoseLengthMeters = field.distanceMeters[entryNode] + connectionMeters;
	const blockingAccessClass: AccessClass | null =
		narrowestCode === ACCESS_CLASS_CODE.largeUnit ? null : ACCESS_CLASS_BY_CODE[narrowestCode];

	return {
		buildingIndex,
		stopNodeId: node,
		stopPoint: { lon: network.nodeLon[node], lat: network.nodeLat[node] },
		hosePath: hosePath.reverse(),
		hoseLengthMeters,
		hoseRollCount: countHoseRolls(hoseLengthMeters),
		extraDelaySeconds: estimateHoseDeploySeconds(hoseLengthMeters),
		reachable: true,
		blockingAccessClass
	};
}

export function computeWaterArrivalField(
	field: StopPointField,
	buildings: BuildingTable
): WaterArrivalField {
	const secondsPerBuilding = new Float32Array(buildings.count);
	let reachableCount = 0;
	let totalSeconds = 0;
	let worstSeconds = 0;

	for (let index = 0; index < buildings.count; index += 1) {
		const entryNode = buildings.nearestNodeId[index];
		if (entryNode < 0 || !Number.isFinite(field.distanceMeters[entryNode])) {
			secondsPerBuilding[index] = Infinity;
			continue;
		}
		const hoseLengthMeters =
			field.distanceMeters[entryNode] + buildings.nearestNodeDistanceMeters[index];
		const seconds = estimateHoseDeploySeconds(hoseLengthMeters);
		secondsPerBuilding[index] = seconds;
		reachableCount += 1;
		totalSeconds += seconds;
		if (seconds > worstSeconds) worstSeconds = seconds;
	}

	return {
		secondsPerBuilding,
		reachableCount,
		meanSecondsReachable: reachableCount === 0 ? 0 : totalSeconds / reachableCount,
		worstSecondsReachable: worstSeconds
	};
}

export function upgradeAccessClasses(network: AlleyNetwork): AlleyNetwork {
	const upgraded = new Uint8Array(network.edgeAccessClass.length);
	const highestCode = ACCESS_CLASS_CODE.largeUnit;
	for (let edge = 0; edge < network.edgeCount; edge += 1) {
		upgraded[edge] = Math.min(highestCode, network.edgeAccessClass[edge] + 1);
	}
	return { ...network, edgeAccessClass: upgraded };
}

export function widenSegment(network: AlleyNetwork, segmentId: number): AlleyNetwork {
	const upgraded = Uint8Array.from(network.edgeAccessClass);
	const highestCode = ACCESS_CLASS_CODE.largeUnit;
	for (let edge = 0; edge < network.edgeCount; edge += 1) {
		if (network.edgeSegmentId[edge] === segmentId) {
			upgraded[edge] = Math.min(highestCode, upgraded[edge] + 1);
		}
	}
	return { ...network, edgeAccessClass: upgraded };
}

export function collectApplianceStandNodes(
	network: AlleyNetwork,
	spacingMeters: number
): number[] {
	const largeUnitCode = ACCESS_CLASS_CODE.largeUnit;
	const kandidat: number[] = [];
	const terlihat = new Set<number>();
	for (let edge = 0; edge < network.edgeCount; edge += 1) {
		if (network.edgeAccessClass[edge] !== largeUnitCode) continue;
		for (const node of [network.edgeFrom[edge], network.edgeTo[edge]]) {
			if (terlihat.has(node)) continue;
			terlihat.add(node);
			kandidat.push(node);
		}
	}
	if (kandidat.length === 0) return [];

	const terpilih: number[] = [];
	const posisi: [number, number][] = [];
	const meterPerDerajat = 111320;
	for (const node of kandidat) {
		const lat = network.nodeLat[node];
		const x = network.nodeLon[node] * meterPerDerajat * Math.cos((lat * Math.PI) / 180);
		const y = lat * meterPerDerajat;
		let cukupJauh = true;
		for (const [lainX, lainY] of posisi) {
			if (Math.hypot(x - lainX, y - lainY) < spacingMeters) {
				cukupJauh = false;
				break;
			}
		}
		if (!cukupJauh) continue;
		terpilih.push(node);
		posisi.push([x, y]);
	}
	return terpilih;
}
