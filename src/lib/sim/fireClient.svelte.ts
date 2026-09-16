import type {
	AdjacencyTable,
	AlleyNetwork,
	BuildingTable,
	FireBatchStatistics,
	FireCoefficients,
	FireScenario,
	InterventionCandidate,
	OptimizerOutcome
} from '$lib/domain/types';
import type {
	SerialisedAdjacency,
	SerialisedBuildings,
	SerialisedNetwork,
	WorkerRequest,
	WorkerResponse
} from '$lib/sim/workers/messages';

type SnapshotListener = (message: Extract<WorkerResponse, { kind: 'snapshot' }>) => void;
type RunDoneListener = (message: Extract<WorkerResponse, { kind: 'runDone' }>) => void;
type ProgressListener = (message: Extract<WorkerResponse, { kind: 'optimizeProgress' }>) => void;
type OptimizeDoneListener = (outcome: OptimizerOutcome) => void;
type BatchDoneListener = (statistics: FireBatchStatistics) => void;

export class FireWorkerClient {
	private worker: Worker | null = null;
	private nextRequestId = 1;
	private snapshotListener: SnapshotListener | null = null;
	private runDoneListener: RunDoneListener | null = null;
	private progressListener: ProgressListener | null = null;
	private optimizeDoneListener: OptimizeDoneListener | null = null;
	private batchDoneListener: BatchDoneListener | null = null;
	private activeRequestId = 0;

	ready = $state(false);

	start(
		buildings: BuildingTable,
		adjacency: AdjacencyTable,
		network: AlleyNetwork
	): void {
		if (this.worker) return;
		this.worker = new Worker(new URL('./workers/fireSpread.worker.ts', import.meta.url), {
			type: 'module'
		});
		this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
			const message = event.data;
			if (message.kind === 'ready') {
				this.ready = true;
				return;
			}
			if (message.kind === 'snapshot' && message.requestId === this.activeRequestId) {
				this.snapshotListener?.(message);
				return;
			}
			if (message.kind === 'runDone' && message.requestId === this.activeRequestId) {
				this.runDoneListener?.(message);
				return;
			}
			if (message.kind === 'optimizeProgress') {
				this.progressListener?.(message);
				return;
			}
			if (message.kind === 'optimizeDone') {
				this.optimizeDoneListener?.(message.outcome);
				return;
			}
			if (message.kind === 'batchDone') {
				this.batchDoneListener?.(message.statistics);
			}
		};
		this.post({
			kind: 'init',
			buildings: buildings as SerialisedBuildings,
			adjacency: adjacency as SerialisedAdjacency,
			network: network as SerialisedNetwork
		});
	}

	stop(): void {
		this.worker?.terminate();
		this.worker = null;
		this.ready = false;
	}

	run(
		scenario: FireScenario,
		coefficients: FireCoefficients,
		waterArrivalSeconds: Float32Array | null,
		extinguisherBoost: Float32Array | null,
		onSnapshot: SnapshotListener,
		onDone: RunDoneListener
	): void {
		this.activeRequestId = this.nextRequestId;
		this.nextRequestId += 1;
		this.snapshotListener = onSnapshot;
		this.runDoneListener = onDone;
		this.post({
			kind: 'run',
			requestId: this.activeRequestId,
			scenario,
			coefficients,
			waterArrivalSeconds,
			extinguisherBoost
		});
	}

	optimize(
		budgetRupiah: number,
		coefficients: FireCoefficients,
		candidates: InterventionCandidate[],
		stepSeconds: number,
		stepCount: number,
		randomSeed: number,
		waterSourceNodeIds: number[],
		maximumHoseLengthMeters: number,
		ignitionPool: number[],
		onProgress: ProgressListener,
		onDone: OptimizeDoneListener
	): void {
		this.progressListener = onProgress;
		this.optimizeDoneListener = onDone;
		this.post({
			kind: 'optimize',
			requestId: this.nextRequestId,
			budgetRupiah,
			coefficients,
			candidates,
			stepSeconds,
			stepCount,
			randomSeed,
			waterSourceNodeIds,
			maximumHoseLengthMeters,
			ignitionPool
		});
		this.nextRequestId += 1;
	}

	runBatch(
		runCount: number,
		coefficients: FireCoefficients,
		waterArrivalSeconds: Float32Array | null,
		stepSeconds: number,
		stepCount: number,
		randomSeed: number,
		onDone: BatchDoneListener
	): void {
		this.batchDoneListener = onDone;
		this.post({
			kind: 'batch',
			requestId: this.nextRequestId,
			runCount,
			coefficients,
			waterArrivalSeconds,
			extinguisherBoost: null,
			stepSeconds,
			stepCount,
			randomSeed
		});
		this.nextRequestId += 1;
	}

	cancelActiveRun(): void {
		this.activeRequestId = 0;
		this.snapshotListener = null;
		this.runDoneListener = null;
	}

	private post(request: WorkerRequest): void {
		this.worker?.postMessage(request);
	}
}

export const fireClient = new FireWorkerClient();
