import {
	ACCESS_CLASS_CODE,
	MAX_WIND_SPEED_METERS_PER_SECOND,
	OPTIMIZER_CANDIDATE_LIMIT,
	OPTIMIZER_EARLY_RUN_COUNT,
	OPTIMIZER_EXTINGUISHER_COST_RUPIAH,
	OPTIMIZER_EXTINGUISHER_EFFECTIVENESS,
	OPTIMIZER_EXTINGUISHER_RADIUS_METERS,
	OPTIMIZER_LATE_RUN_COUNT,
	OPTIMIZER_MAX_ROUNDS,
	OPTIMIZER_WATER_SOURCE_COST_RUPIAH,
	OPTIMIZER_WIDENING_COST_RUPIAH_PER_METER
} from '$lib/domain/constants';
import type {
	AlleyNetwork,
	BuildingTable,
	FireCoefficients,
	InterventionCandidate,
	OptimizerOutcome,
	SelectedIntervention
} from '$lib/domain/types';
import { runFireSimulation, type FireContext } from '$lib/sim/fireSpread';
import { SeededRandom, deriveSeed } from '$lib/sim/random';
import { collectBuildingsWithin } from '$lib/sim/spatialGrid';
import { collectStopPointCandidates, computeStopPointField, widenSegment } from '$lib/sim/stopPoint';
import { computeWaterArrival } from '$lib/sim/waterArrival';

const RUPIAH_PER_MILLION = 1_000_000;
const WIDENING_CANDIDATE_SHARE = 0.5;
const WATER_CANDIDATE_SHARE = 0.25;

export interface OptimizerInput {
	context: FireContext;
	network: AlleyNetwork;
	buildings: BuildingTable;
	candidates: InterventionCandidate[];
	budgetRupiah: number;
	coefficients: FireCoefficients;
	stepSeconds: number;
	stepCount: number;
	randomSeed: number;
	baseWaterNodeIds: number[];
	ignitionPool: number[];
	onProgress?: (completedRounds: number, totalRounds: number, note: string) => void;
}

interface WorldState {
	network: AlleyNetwork;
	waterNodeIds: number[];
	extinguisherNodeIds: number[];
}

interface ScenarioSeed {
	ignitionBuildingIndex: number;
	windDirectionDegrees: number;
	windSpeedMetersPerSecond: number;
	seed: number;
}

export function estimateSegmentLengthMeters(network: AlleyNetwork, segmentId: number): number {
	let total = 0;
	for (let edge = 0; edge < network.edgeCount; edge += 1) {
		if (network.edgeSegmentId[edge] === segmentId) {
			total += network.edgeLengthMeters[edge];
		}
	}
	return total;
}

export function computeSegmentUsage(network: AlleyNetwork, buildings: BuildingTable): Float64Array {
	const field = computeStopPointField(network, collectStopPointCandidates(network));
	const usage = new Float64Array(network.edgeCount);
	for (let index = 0; index < buildings.count; index += 1) {
		let node = buildings.nearestNodeId[index];
		if (node < 0) continue;
		let guard = network.nodeCount;
		while (field.nextHopNode[node] >= 0 && guard > 0) {
			const edge = field.nextHopEdge[node];
			if (edge >= 0) usage[edge] += 1;
			node = field.nextHopNode[node];
			guard -= 1;
		}
	}
	const perSegment = new Float64Array(network.edgeCount);
	for (let edge = 0; edge < network.edgeCount; edge += 1) {
		perSegment[network.edgeSegmentId[edge]] += usage[edge];
	}
	return perSegment;
}

export function buildInterventionCandidates(
	network: AlleyNetwork,
	buildings: BuildingTable,
	slowestBuildingIndices: number[],
	limit: number = OPTIMIZER_CANDIDATE_LIMIT
): InterventionCandidate[] {
	const candidates: InterventionCandidate[] = [];
	const segmentUsage = computeSegmentUsage(network, buildings);
	const largeUnitCode = ACCESS_CLASS_CODE.largeUnit;

	const segmentBest = new Map<number, { usage: number; edge: number }>();
	for (let edge = 0; edge < network.edgeCount; edge += 1) {
		if (network.edgeAccessClass[edge] >= largeUnitCode) continue;
		const segmentId = network.edgeSegmentId[edge];
		const existing = segmentBest.get(segmentId);
		if (!existing) segmentBest.set(segmentId, { usage: segmentUsage[segmentId], edge });
	}

	const rankedSegments = [...segmentBest.entries()]
		.sort((first, second) => second[1].usage - first[1].usage)
		.slice(0, Math.max(1, Math.round(limit * WIDENING_CANDIDATE_SHARE)));

	for (const [segmentId, detail] of rankedSegments) {
		if (detail.usage <= 0) continue;
		const lengthMeters = estimateSegmentLengthMeters(network, segmentId);
		const anchorNode = network.edgeFrom[detail.edge];
		candidates.push({
			id: `widen-${segmentId}`,
			kind: 'wideningSegment',
			label: `Pelebaran segmen ${segmentId}`,
			costRupiah: Math.round(lengthMeters * OPTIMIZER_WIDENING_COST_RUPIAH_PER_METER),
			targetEdgeId: segmentId,
			targetNodeId: anchorNode,
			position: { lon: network.nodeLon[anchorNode], lat: network.nodeLat[anchorNode] }
		});
	}

	const waterLimit = Math.max(1, Math.round(limit * WATER_CANDIDATE_SHARE));
	const usedNodes = new Set<number>();
	for (const buildingIndex of slowestBuildingIndices) {
		if (candidates.length >= rankedSegments.length + waterLimit) break;
		const node = buildings.nearestNodeId[buildingIndex];
		if (node < 0 || usedNodes.has(node)) continue;
		usedNodes.add(node);
		candidates.push({
			id: `water-${node}`,
			kind: 'waterSource',
			label: `Sumber air baru di node ${node}`,
			costRupiah: OPTIMIZER_WATER_SOURCE_COST_RUPIAH,
			targetEdgeId: null,
			targetNodeId: node,
			position: { lon: network.nodeLon[node], lat: network.nodeLat[node] }
		});
	}

	const extinguisherNodes = new Set<number>();
	for (const buildingIndex of slowestBuildingIndices) {
		if (candidates.length >= limit) break;
		const node = buildings.nearestNodeId[buildingIndex];
		if (node < 0 || extinguisherNodes.has(node) || usedNodes.has(node)) continue;
		extinguisherNodes.add(node);
		candidates.push({
			id: `apar-${node}`,
			kind: 'extinguisher',
			label: `Titik APAR di node ${node}`,
			costRupiah: OPTIMIZER_EXTINGUISHER_COST_RUPIAH,
			targetEdgeId: null,
			targetNodeId: node,
			position: { lon: network.nodeLon[node], lat: network.nodeLat[node] }
		});
	}

	return candidates;
}

function buildExtinguisherBoost(
	world: WorldState,
	context: FireContext,
	buildings: BuildingTable
): Float32Array | null {
	if (world.extinguisherNodeIds.length === 0) return null;
	const boost = new Float32Array(buildings.count);
	for (const node of world.extinguisherNodeIds) {
		const covered = collectBuildingsWithin(
			context.grid,
			buildings,
			world.network.nodeLon[node],
			world.network.nodeLat[node],
			OPTIMIZER_EXTINGUISHER_RADIUS_METERS
		);
		for (const index of covered) {
			if (boost[index] < OPTIMIZER_EXTINGUISHER_EFFECTIVENESS) {
				boost[index] = OPTIMIZER_EXTINGUISHER_EFFECTIVENESS;
			}
		}
	}
	return boost;
}

function applyCandidate(world: WorldState, candidate: InterventionCandidate): WorldState {
	if (candidate.kind === 'wideningSegment' && candidate.targetEdgeId !== null) {
		return { ...world, network: widenSegment(world.network, candidate.targetEdgeId) };
	}
	if (candidate.kind === 'waterSource' && candidate.targetNodeId !== null) {
		return { ...world, waterNodeIds: [...world.waterNodeIds, candidate.targetNodeId] };
	}
	if (candidate.kind === 'extinguisher' && candidate.targetNodeId !== null) {
		return {
			...world,
			extinguisherNodeIds: [...world.extinguisherNodeIds, candidate.targetNodeId]
		};
	}
	return world;
}

function buildScenarioSeeds(
	buildings: BuildingTable,
	ignitionPool: number[],
	randomSeed: number,
	runCount: number
): ScenarioSeed[] {
	const random = new SeededRandom(randomSeed);
	const pool = ignitionPool.length > 0 ? ignitionPool : null;
	return Array.from({ length: runCount }, (_, run) => ({
		ignitionBuildingIndex: pool
			? pool[random.nextBelow(pool.length)]
			: random.nextBelow(buildings.count),
		windDirectionDegrees: random.nextInRange(0, 360),
		windSpeedMetersPerSecond: random.nextInRange(0, MAX_WIND_SPEED_METERS_PER_SECOND),
		seed: deriveSeed(randomSeed, run)
	}));
}

function evaluateWorld(
	input: OptimizerInput,
	world: WorldState,
	scenarios: ScenarioSeed[]
): number {
	const arrival = computeWaterArrival(world.network, input.buildings, world.waterNodeIds);
	const boost = buildExtinguisherBoost(world, input.context, input.buildings);
	let totalBurnt = 0;
	for (const scenario of scenarios) {
		const result = runFireSimulation(
			input.context,
			{
				ignitionBuildingIndices: [scenario.ignitionBuildingIndex],
				wind: {
					directionDegrees: scenario.windDirectionDegrees,
					speedMetersPerSecond: scenario.windSpeedMetersPerSecond
				},
				randomSeed: scenario.seed,
				stepSeconds: input.stepSeconds,
				stepCount: input.stepCount,
				suppressionEnabled: true
			},
			input.coefficients,
			arrival.secondsPerBuilding,
			boost
		);
		totalBurnt += result.totalAffectedCount;
	}
	return totalBurnt / scenarios.length;
}

export function runGreedyOptimizer(input: OptimizerInput): OptimizerOutcome {
	let world: WorldState = {
		network: input.network,
		waterNodeIds: [...input.baseWaterNodeIds],
		extinguisherNodeIds: []
	};

	const finalScenarios = buildScenarioSeeds(
		input.buildings,
		input.ignitionPool,
		input.randomSeed,
		OPTIMIZER_LATE_RUN_COUNT
	);
	const baselineBurnt = evaluateWorld(input, world, finalScenarios);

	let remaining = [...input.candidates];
	const selected: SelectedIntervention[] = [];
	let spentRupiah = 0;

	for (let round = 0; round < OPTIMIZER_MAX_ROUNDS; round += 1) {
		const progression = round / Math.max(1, OPTIMIZER_MAX_ROUNDS - 1);
		const runCount = Math.round(
			OPTIMIZER_EARLY_RUN_COUNT +
				progression * (OPTIMIZER_LATE_RUN_COUNT - OPTIMIZER_EARLY_RUN_COUNT)
		);
		const scenarios = buildScenarioSeeds(
			input.buildings,
			input.ignitionPool,
			input.randomSeed,
			runCount
		);
		const roundBase = evaluateWorld(input, world, scenarios);

		input.onProgress?.(round, OPTIMIZER_MAX_ROUNDS, `Putaran ${round + 1}, ${runCount} lari`);

		let bestCandidate: InterventionCandidate | null = null;
		let bestRatio = 0;
		let bestGain = 0;

		for (const candidate of remaining) {
			if (spentRupiah + candidate.costRupiah > input.budgetRupiah) continue;
			const trial = applyCandidate(world, candidate);
			const value = evaluateWorld(input, trial, scenarios);
			const gain = roundBase - value;
			if (gain <= 0) continue;
			const ratio = gain / (candidate.costRupiah / RUPIAH_PER_MILLION);
			if (ratio > bestRatio) {
				bestRatio = ratio;
				bestGain = gain;
				bestCandidate = candidate;
			}
		}

		if (!bestCandidate) break;

		world = applyCandidate(world, bestCandidate);
		spentRupiah += bestCandidate.costRupiah;
		remaining = remaining.filter((candidate) => candidate.id !== bestCandidate?.id);
		selected.push({
			...bestCandidate,
			rank: selected.length + 1,
			expectedSavedGain: bestGain,
			gainPerMillionRupiah: bestRatio
		});
	}

	const improvedBurnt = evaluateWorld(input, world, finalScenarios);

	return {
		selected,
		spentRupiah,
		baselineExpectedBurnt: baselineBurnt,
		improvedExpectedBurnt: improvedBurnt
	};
}
