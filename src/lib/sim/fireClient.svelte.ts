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
	SimulationFailureCause,
	SimulationTask,
	WorkerRequest,
	WorkerResponse
} from '$lib/sim/workers/messages';

type SnapshotListener = (message: Extract<WorkerResponse, { kind: 'snapshot' }>) => void;
type RunDoneListener = (message: Extract<WorkerResponse, { kind: 'runDone' }>) => void;
type ProgressListener = (message: Extract<WorkerResponse, { kind: 'optimizeProgress' }>) => void;
type OptimizeDoneListener = (outcome: OptimizerOutcome) => void;
type BatchDoneListener = (statistics: FireBatchStatistics) => void;
export type FailureListener = (cause: SimulationFailureCause) => void;

export class FireWorkerClient {
	private worker: Worker | null = null;
	private nextRequestId = 1;
	private snapshotListener: SnapshotListener | null = null;
	private runDoneListener: RunDoneListener | null = null;
	private progressListener: ProgressListener | null = null;
	private optimizeDoneListener: OptimizeDoneListener | null = null;
	private batchDoneListener: BatchDoneListener | null = null;
	private failureListeners = new Map<SimulationTask, FailureListener>();
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
			this.handleMessage(event.data);
		};
		this.worker.onerror = (event: ErrorEvent) => {
			event.preventDefault();
			this.failAllPending('computation');
		};
		this.worker.onmessageerror = () => {
			this.failAllPending('computation');
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
		onDone: RunDoneListener,
		onFailed: FailureListener
	): void {
		this.activeRequestId = this.nextRequestId;
		this.nextRequestId += 1;
		this.snapshotListener = onSnapshot;
		this.runDoneListener = onDone;
		this.failureListeners.set('run', onFailed);
		this.dispatch('run', {
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
		onDone: OptimizeDoneListener,
		onFailed: FailureListener
	): void {
		this.progressListener = onProgress;
		this.optimizeDoneListener = onDone;
		this.failureListeners.set('optimize', onFailed);
		this.dispatch('optimize', {
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
		onDone: BatchDoneListener,
		onFailed: FailureListener
	): void {
		this.batchDoneListener = onDone;
		this.failureListeners.set('batch', onFailed);
		this.dispatch('batch', {
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
		this.failureListeners.delete('run');
	}

	private handleMessage(message: WorkerResponse): void {
		if (message.kind === 'ready') {
			this.ready = true;
			return;
		}
		if (message.kind === 'failed') {
			if (message.task === 'run' && message.requestId !== this.activeRequestId) return;
			this.fail(message.task, message.cause);
			return;
		}
		if (message.kind === 'snapshot' && message.requestId === this.activeRequestId) {
			this.snapshotListener?.(message);
			return;
		}
		if (message.kind === 'runDone' && message.requestId === this.activeRequestId) {
			this.failureListeners.delete('run');
			this.runDoneListener?.(message);
			return;
		}
		if (message.kind === 'optimizeProgress') {
			this.progressListener?.(message);
			return;
		}
		if (message.kind === 'optimizeDone') {
			this.failureListeners.delete('optimize');
			this.optimizeDoneListener?.(message.outcome);
			return;
		}
		if (message.kind === 'batchDone') {
			this.failureListeners.delete('batch');
			this.batchDoneListener?.(message.statistics);
		}
	}

	private dispatch(task: SimulationTask, request: WorkerRequest): void {
		if (!this.worker || !this.ready) {
			this.fail(task, 'notReady');
			return;
		}
		this.worker.postMessage(request);
	}

	private fail(task: SimulationTask, cause: SimulationFailureCause): void {
		const listener = this.failureListeners.get(task);
		this.failureListeners.delete(task);
		if (task === 'run') this.activeRequestId = 0;
		listener?.(cause);
	}

	private failAllPending(cause: SimulationFailureCause): void {
		for (const task of [...this.failureListeners.keys()]) {
			this.fail(task, cause);
		}
	}

	private post(request: WorkerRequest): void {
		this.worker?.postMessage(request);
	}
}

export const fireClient = new FireWorkerClient();
