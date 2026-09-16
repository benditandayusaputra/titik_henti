import type {
	FireBatchStatistics,
	FireCoefficients,
	FireScenario,
	FireStepSummary,
	InterventionCandidate,
	OptimizerOutcome
} from '$lib/domain/types';

export interface SerialisedBuildings {
	count: number;
	lon: Float64Array;
	lat: Float64Array;
	areaSquareMeters: Float32Array;
	heightMeters: Float32Array;
	materialClass: Uint8Array;
	heightIsMeasured: Uint8Array;
	nearestNodeId: Int32Array;
	nearestNodeDistanceMeters: Float32Array;
}

export interface SerialisedAdjacency {
	count: number;
	offsets: Int32Array;
	neighbourIndex: Uint32Array;
	edgeDistanceMeters: Float32Array;
}

export interface SerialisedNetwork {
	nodeCount: number;
	nodeLon: Float64Array;
	nodeLat: Float64Array;
	adjacencyOffsets: Int32Array;
	adjacencyTargets: Int32Array;
	adjacencyEdgeIds: Int32Array;
	edgeFrom: Int32Array;
	edgeTo: Int32Array;
	edgeLengthMeters: Float32Array;
	edgeAccessClass: Uint8Array;
	edgeSegmentId: Int32Array;
	edgeMinWidthMeters: Float32Array;
	edgeMeanWidthMeters: Float32Array;
	edgeIsNamedRoad: Uint8Array;
	edgeCount: number;
}

export interface InitRequest {
	kind: 'init';
	buildings: SerialisedBuildings;
	adjacency: SerialisedAdjacency;
	network: SerialisedNetwork;
}

export interface RunRequest {
	kind: 'run';
	requestId: number;
	scenario: FireScenario;
	coefficients: FireCoefficients;
	waterArrivalSeconds: Float32Array | null;
	extinguisherBoost: Float32Array | null;
}

export interface BatchRequest {
	kind: 'batch';
	requestId: number;
	runCount: number;
	coefficients: FireCoefficients;
	waterArrivalSeconds: Float32Array | null;
	extinguisherBoost: Float32Array | null;
	stepSeconds: number;
	stepCount: number;
	randomSeed: number;
}

export interface OptimizeRequest {
	kind: 'optimize';
	requestId: number;
	budgetRupiah: number;
	coefficients: FireCoefficients;
	candidates: InterventionCandidate[];
	stepSeconds: number;
	stepCount: number;
	randomSeed: number;
	waterSourceNodeIds: number[];
	maximumHoseLengthMeters: number;
	ignitionPool: number[];
}

export type WorkerRequest = InitRequest | RunRequest | BatchRequest | OptimizeRequest;

export interface ReadyMessage {
	kind: 'ready';
}

export interface SnapshotMessage {
	kind: 'snapshot';
	requestId: number;
	stepIndex: number;
	elapsedSeconds: number;
	state: Uint8Array;
	summary: FireStepSummary;
}

export interface RunDoneMessage {
	kind: 'runDone';
	requestId: number;
	secondsToTenBuildings: number;
	totalAffectedCount: number;
	savedCount: number;
}

export interface BatchDoneMessage {
	kind: 'batchDone';
	requestId: number;
	statistics: FireBatchStatistics;
}

export interface OptimizeProgressMessage {
	kind: 'optimizeProgress';
	requestId: number;
	completedRounds: number;
	totalRounds: number;
	note: string;
}

export interface OptimizeDoneMessage {
	kind: 'optimizeDone';
	requestId: number;
	outcome: OptimizerOutcome;
}

export type WorkerResponse =
	| ReadyMessage
	| SnapshotMessage
	| RunDoneMessage
	| BatchDoneMessage
	| OptimizeProgressMessage
	| OptimizeDoneMessage;
