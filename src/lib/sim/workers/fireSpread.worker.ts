import {
	BUILDING_STATE_BURNING,
	FIRE_MILESTONE_BUILDING_COUNT,
	MAX_WIND_SPEED_METERS_PER_SECOND
} from '$lib/domain/constants';
import type {
	AdjacencyTable,
	AlleyNetwork,
	BuildingTable,
	FireBatchStatistics
} from '$lib/domain/types';
import {
	countTouchedByFire,
	createFireContext,
	createFireState,
	runFireSimulation,
	stepFire,
	summariseFire,
	type FireContext
} from '$lib/sim/fireSpread';
import { runGreedyOptimizer } from '$lib/sim/optimizer';
import { SeededRandom, deriveSeed } from '$lib/sim/random';
import type {
	BatchRequest,
	OptimizeRequest,
	RunRequest,
	SimulationFailureCause,
	SimulationTask,
	WorkerRequest,
	WorkerResponse
} from '$lib/sim/workers/messages';

let context: FireContext | null = null;
let buildings: BuildingTable | null = null;
let adjacency: AdjacencyTable | null = null;
let network: AlleyNetwork | null = null;

function reply(message: WorkerResponse, transfer: Transferable[] = []): void {
	self.postMessage(message, { transfer });
}

function reportFailure(
	requestId: number,
	task: SimulationTask,
	cause: SimulationFailureCause
): void {
	reply({ kind: 'failed', requestId, task, cause });
}

function runGuarded(requestId: number, task: SimulationTask, work: () => void): void {
	try {
		work();
	} catch {
		reportFailure(requestId, task, 'computation');
	}
}

function handleRun(request: RunRequest): void {
	if (!context) {
		reportFailure(request.requestId, 'run', 'notReady');
		return;
	}
	const fireState = createFireState(context.buildings.count);
	for (const ignition of request.scenario.ignitionBuildingIndices) {
		if (ignition < 0 || ignition >= context.buildings.count) continue;
		fireState.state[ignition] = BUILDING_STATE_BURNING;
		fireState.ignitionSeconds[ignition] = 0;
	}

	const initialSnapshot = fireState.state.slice();
	reply(
		{
			kind: 'snapshot',
			requestId: request.requestId,
			stepIndex: 0,
			elapsedSeconds: 0,
			state: initialSnapshot,
			summary: summariseFire(fireState, 0, 0)
		},
		[initialSnapshot.buffer]
	);

	let secondsToTenBuildings = Infinity;

	for (let step = 0; step < request.scenario.stepCount; step += 1) {
		const elapsedSeconds = step * request.scenario.stepSeconds;
		stepFire(context, fireState, {
			coefficients: request.coefficients,
			wind: request.scenario.wind,
			stepSeconds: request.scenario.stepSeconds,
			elapsedSeconds,
			stepIndex: step,
			randomSeed: request.scenario.randomSeed,
			waterArrivalSeconds: request.waterArrivalSeconds,
			suppressionEnabled: request.scenario.suppressionEnabled,
			extinguisherBoost: request.extinguisherBoost
		});
		const nextElapsedSeconds = elapsedSeconds + request.scenario.stepSeconds;
		const summary = summariseFire(fireState, step + 1, nextElapsedSeconds);
		const snapshot = fireState.state.slice();
		reply(
			{
				kind: 'snapshot',
				requestId: request.requestId,
				stepIndex: step + 1,
				elapsedSeconds: nextElapsedSeconds,
				state: snapshot,
				summary
			},
			[snapshot.buffer]
		);
		if (
			!Number.isFinite(secondsToTenBuildings) &&
			countTouchedByFire(fireState) >= FIRE_MILESTONE_BUILDING_COUNT
		) {
			secondsToTenBuildings = nextElapsedSeconds;
		}
	}

	const finalSummary = summariseFire(fireState, request.scenario.stepCount, 0);
	reply({
		kind: 'runDone',
		requestId: request.requestId,
		secondsToTenBuildings,
		totalAffectedCount: countTouchedByFire(fireState),
		savedCount: finalSummary.savedCount
	});
}

function handleBatch(request: BatchRequest): void {
	if (!context) {
		reportFailure(request.requestId, 'batch', 'notReady');
		return;
	}
	const random = new SeededRandom(request.randomSeed);
	let totalAffected = 0;
	let totalSaved = 0;
	let worstAffected = 0;

	for (let run = 0; run < request.runCount; run += 1) {
		const result = runFireSimulation(
			context,
			{
				ignitionBuildingIndices: [random.nextBelow(context.buildings.count)],
				wind: {
					directionDegrees: random.nextInRange(0, 360),
					speedMetersPerSecond: random.nextInRange(0, MAX_WIND_SPEED_METERS_PER_SECOND)
				},
				randomSeed: deriveSeed(request.randomSeed, run),
				stepSeconds: request.stepSeconds,
				stepCount: request.stepCount,
				suppressionEnabled: request.waterArrivalSeconds !== null
			},
			request.coefficients,
			request.waterArrivalSeconds,
			request.extinguisherBoost
		);
		totalAffected += result.totalAffectedCount;
		totalSaved += result.savedCount;
		if (result.totalAffectedCount > worstAffected) worstAffected = result.totalAffectedCount;
	}

	const statistics: FireBatchStatistics = {
		runCount: request.runCount,
		meanAffectedCount: totalAffected / Math.max(1, request.runCount),
		meanSavedCount: totalSaved / Math.max(1, request.runCount),
		worstAffectedCount: worstAffected
	};
	reply({ kind: 'batchDone', requestId: request.requestId, statistics });
}

function handleOptimize(request: OptimizeRequest): void {
	if (!context || !network || !buildings) {
		reportFailure(request.requestId, 'optimize', 'notReady');
		return;
	}
	const outcome = runGreedyOptimizer({
		context,
		network,
		buildings,
		candidates: request.candidates,
		budgetRupiah: request.budgetRupiah,
		coefficients: request.coefficients,
		stepSeconds: request.stepSeconds,
		stepCount: request.stepCount,
		randomSeed: request.randomSeed,
		baseWaterNodeIds: request.waterSourceNodeIds,
		ignitionPool: request.ignitionPool,
		onProgress: (completedRounds, totalRounds, note) => {
			reply({
				kind: 'optimizeProgress',
				requestId: request.requestId,
				completedRounds,
				totalRounds,
				note
			});
		}
	});
	reply({ kind: 'optimizeDone', requestId: request.requestId, outcome });
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
	const request = event.data;
	if (request.kind === 'init') {
		buildings = request.buildings;
		adjacency = request.adjacency;
		network = request.network;
		context = createFireContext(buildings, adjacency);
		reply({ kind: 'ready' });
		return;
	}
	if (request.kind === 'run') {
		runGuarded(request.requestId, 'run', () => handleRun(request));
		return;
	}
	if (request.kind === 'batch') {
		runGuarded(request.requestId, 'batch', () => handleBatch(request));
		return;
	}
	if (request.kind === 'optimize') {
		runGuarded(request.requestId, 'optimize', () => handleOptimize(request));
	}
};
