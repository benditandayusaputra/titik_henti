export type AccessClass = 'largeUnit' | 'smallUnit' | 'hoseOnly';

export type MaterialClass = 'masonry' | 'mixed' | 'lightweight';

export type WaterSourceKind =
	| 'hydrant'
	| 'well'
	| 'openWater'
	| 'reservoir'
	| 'applianceStand'
	| 'hypothetical';

export type BuildingStateCode = 0 | 1 | 2 | 3 | 4;

export interface BoundingBox {
	west: number;
	south: number;
	east: number;
	north: number;
}

export interface LonLat {
	lon: number;
	lat: number;
}

export interface DataProvenance {
	label: string;
	source: string;
	licence: string;
	retrievedAt: string;
}

export interface AlleyLengthByClass {
	largeUnit: number;
	smallUnit: number;
	hoseOnly: number;
}

export interface MaterialMix {
	masonry: number;
	mixed: number;
	lightweight: number;
}

export interface PipelineMeta {
	pipelineVersion: string;
	processedAt: string;
	villageName: string;
	districtName: string;
	cityName: string;
	boundingBox: BoundingBox;
	areaSquareKilometres: number;
	buildingCount: number;
	alleySegmentCount: number;
	alleyNodeCount: number;
	alleyLengthMetersByClass: AlleyLengthByClass;
	inaccessibleLengthShare: number;
	waterSourceCount: number;
	rasterResolutionMeters: number;
	materialMix: MaterialMix;
	measuredHeightCount: number;
	populationCount: number;
	populationYear: number;
	provenance: DataProvenance[];
	estimatedFields: string[];
}

export interface AlleyNode {
	id: number;
	lon: number;
	lat: number;
}

export interface AlleyEdge {
	id: number;
	segmentId: number;
	fromNodeId: number;
	toNodeId: number;
	lengthMeters: number;
	minWidthMeters: number;
	meanWidthMeters: number;
	accessClass: AccessClass;
	isNamedRoad: boolean;
}

export interface WaterSource {
	id: number;
	lon: number;
	lat: number;
	kind: WaterSourceKind;
	label: string;
	nearestNodeId: number;
	nearestNodeDistanceMeters: number;
}

export interface AlleyGraph {
	nodes: AlleyNode[];
	edges: AlleyEdge[];
	waterSources: WaterSource[];
}

export interface BuildingTable {
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

export interface AdjacencyTable {
	count: number;
	offsets: Int32Array;
	neighbourIndex: Uint32Array;
	edgeDistanceMeters: Float32Array;
}

export interface AlleyNetwork {
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

export interface StopPointSolution {
	buildingIndex: number;
	stopNodeId: number;
	stopPoint: LonLat;
	hosePath: LonLat[];
	hoseLengthMeters: number;
	hoseRollCount: number;
	extraDelaySeconds: number;
	reachable: boolean;
	blockingAccessClass: AccessClass | null;
}

export interface HoseReachResult {
	reachedNodeDistanceMeters: Float32Array;
	buildingReached: Uint8Array;
	buildingWaterDelaySeconds: Float32Array;
	unreachedPocketOfBuilding: Int32Array;
	pockets: UnreachedPocket[];
	reachedBuildingCount: number;
	unreachedBuildingCount: number;
}

export interface UnreachedPocket {
	id: number;
	buildingIndices: number[];
	centroid: LonLat;
	buildingCount: number;
}

export interface WindField {
	directionDegrees: number;
	speedMetersPerSecond: number;
}

export interface FireCoefficients {
	radiationGain: number;
	radiationFalloffExponent: number;
	radiationReferenceDistanceMeters: number;
	heightGain: number;
	areaGain: number;
	windAlignmentGain: number;
	windSpeedGain: number;
	firebrandBaseProbability: number;
	firebrandRangeMeters: number;
	firebrandWindConeDegrees: number;
	materialFactorMasonry: number;
	materialFactorMixed: number;
	materialFactorLightweight: number;
	growthToFullSeconds: number;
	fullToBurntSeconds: number;
	suppressionEffectiveness: number;
	extinguishChancePerStep: number;
}

export interface FireScenario {
	ignitionBuildingIndices: number[];
	wind: WindField;
	randomSeed: number;
	stepSeconds: number;
	stepCount: number;
	suppressionEnabled: boolean;
}

export interface FireStepSummary {
	stepIndex: number;
	elapsedSeconds: number;
	burningCount: number;
	burntCount: number;
	savedCount: number;
	intactCount: number;
}

export interface FireRunResult {
	state: Uint8Array;
	ignitionSeconds: Float32Array;
	timeline: FireStepSummary[];
	secondsToTenBuildings: number;
	totalAffectedCount: number;
	savedCount: number;
}

export interface FireBatchStatistics {
	runCount: number;
	meanAffectedCount: number;
	meanSavedCount: number;
	worstAffectedCount: number;
}

export type InterventionKind = 'extinguisher' | 'waterSource' | 'wideningSegment';

export interface InterventionCandidate {
	id: string;
	kind: InterventionKind;
	label: string;
	costRupiah: number;
	targetEdgeId: number | null;
	targetNodeId: number | null;
	position: LonLat;
}

export interface SelectedIntervention extends InterventionCandidate {
	rank: number;
	expectedSavedGain: number;
	gainPerMillionRupiah: number;
}

export interface OptimizerOutcome {
	selected: SelectedIntervention[];
	spentRupiah: number;
	baselineExpectedBurnt: number;
	improvedExpectedBurnt: number;
}

export interface WaterArrivalField {
	secondsPerBuilding: Float32Array;
	reachableCount: number;
	meanSecondsReachable: number;
	worstSecondsReachable: number;
}

export interface ComparisonSummary {
	label: string;
	burntCount: number;
	savedCount: number;
	meanWaterArrivalSeconds: number;
	worstWaterArrivalSeconds: number;
	unreachableBuildingCount: number;
}

export type WidthSource = 'satellite' | 'field';

export type CorrectionStatus = 'pending' | 'approved' | 'rejected';

export interface CorrectionProposal {
	segmentId: number;
	proposedWidthMeters: number;
	reason: string;
	confidence: number;
}

export interface CorrectionRecord {
	id: number;
	segmentId: number;
	previousMinWidthMeters: number;
	previousAccessClass: AccessClass;
	proposal: CorrectionProposal;
	originalSentence: string;
	status: CorrectionStatus;
}

export interface SegmentSummary {
	segmentId: number;
	accessClass: AccessClass;
	minWidthMeters: number;
	meanWidthMeters: number;
	lengthMeters: number;
	edgeCount: number;
	isNamedRoad: boolean;
	widthSource: WidthSource;
}

export interface SegmentRequestContext {
	segmentId: number;
	accessClass: AccessClass;
	minWidthMeters: number;
	meanWidthMeters: number;
	lengthMeters: number;
}
