import {
	ACCESS_CLASS_CODE,
	CORRECTION_ENDPOINT_PATH,
	DEFAULT_FIRE_COEFFICIENTS,
	DEFAULT_MAX_HOSE_LENGTH_METERS,
	DEFAULT_RANDOM_SEED,
	DEFAULT_WIND_DIRECTION_DEGREES,
	DEFAULT_WIND_SPEED_METERS_PER_SECOND,
	FIRE_DEFAULT_STEP_COUNT,
	FIRE_STEP_SECONDS
} from '$lib/domain/constants';
import { dataset } from '$lib/data/dataset.svelte';
import { correctionResponseSchema } from '$lib/domain/correctionSchema';
import type {
	AlleyNetwork,
	ComparisonSummary,
	CorrectionRecord,
	CorrectionStatus,
	FireCoefficients,
	FireStepSummary,
	HoseReachResult,
	LonLat,
	OptimizerOutcome,
	SegmentSummary,
	StopPointSolution,
	WaterArrivalField,
	WaterSource,
	WidthSource,
	WindField
} from '$lib/domain/types';
import { applyWidthCorrections, summariseSegment } from '$lib/sim/corrections';
import { computeHoseReach } from '$lib/sim/hoseReach';
import { findNearestNode } from '$lib/sim/network';
import {
	collectStopPointCandidates,
	computeStopPointField,
	solveStopPoint,
	upgradeAccessClasses,
	type StopPointField
} from '$lib/sim/stopPoint';
import { computeWaterArrival } from '$lib/sim/waterArrival';

export type WorkspaceTab = 'akses' | 'titikHenti' | 'api' | 'air' | 'intervensi';

export interface HypotheticalSource {
	id: number;
	position: LonLat;
	nodeId: number;
}

export interface FirePlayback {
	snapshots: Uint8Array[];
	timeline: FireStepSummary[];
	currentStep: number;
	running: boolean;
	playing: boolean;
	secondsToTenBuildings: number;
}

function createEmptyPlayback(): FirePlayback {
	return {
		snapshots: [],
		timeline: [],
		currentStep: 0,
		running: false,
		playing: false,
		secondsToTenBuildings: Infinity
	};
}

class Workspace {
	activeTab = $state<WorkspaceTab>('akses');
	selectedBuildingIndex = $state<number | null>(null);
	selectedSegmentId = $state<number | null>(null);
	corrections = $state.raw<CorrectionRecord[]>([]);
	correctionSubmitting = $state(false);
	correctionErrorMessage = $state('');
	ignitionBuildingIndices = $state.raw<number[]>([]);
	wind = $state.raw<WindField>({
		directionDegrees: DEFAULT_WIND_DIRECTION_DEGREES,
		speedMetersPerSecond: DEFAULT_WIND_SPEED_METERS_PER_SECOND
	});
	coefficients = $state.raw<FireCoefficients>({ ...DEFAULT_FIRE_COEFFICIENTS });
	randomSeed = $state(DEFAULT_RANDOM_SEED);
	stepSeconds = $state(FIRE_STEP_SECONDS);
	stepCount = $state(FIRE_DEFAULT_STEP_COUNT);
	maximumHoseLengthMeters = $state(DEFAULT_MAX_HOSE_LENGTH_METERS);
	hypotheticalSources = $state.raw<HypotheticalSource[]>([]);
	placingHydrant = $state(false);
	settingIgnition = $state(false);
	wideningScenarioActive = $state(false);
	suppressionEnabled = $state(true);
	calibrationOpen = $state(false);
	playback = $state.raw<FirePlayback>(createEmptyPlayback());
	comparison = $state.raw<ComparisonSummary[]>([]);
	optimizerOutcome = $state.raw<OptimizerOutcome | null>(null);
	optimizerRunning = $state(false);
	optimizerProgress = $state.raw({ completed: 0, total: 0, note: '' });
	appliedInterventionNodeIds = $state.raw<number[]>([]);
	appliedInterventionSegmentIds = $state.raw<number[]>([]);

	baseNetwork = $derived(dataset.network);

	approvedWidthBySegmentId = $derived.by<Map<number, number>>(() => {
		const widths = new Map<number, number>();
		for (const record of this.corrections) {
			if (record.status === 'approved') {
				widths.set(record.segmentId, record.proposal.proposedWidthMeters);
			}
		}
		return widths;
	});

	correctedSegmentIds = $derived(new Set(this.approvedWidthBySegmentId.keys()));

	network = $derived.by<AlleyNetwork | null>(() => {
		const base = this.baseNetwork;
		if (!base) return null;
		let network = applyWidthCorrections(base, this.approvedWidthBySegmentId);
		if (this.appliedInterventionSegmentIds.length > 0) {
			const upgraded = Uint8Array.from(network.edgeAccessClass);
			const wanted = new Set(this.appliedInterventionSegmentIds);
			for (let edge = 0; edge < network.edgeCount; edge += 1) {
				if (wanted.has(network.edgeSegmentId[edge])) {
					upgraded[edge] = Math.min(ACCESS_CLASS_CODE.largeUnit, upgraded[edge] + 1);
				}
			}
			network = { ...network, edgeAccessClass: upgraded };
		}
		return this.wideningScenarioActive ? upgradeAccessClasses(network) : network;
	});

	realWaterSources = $derived(dataset.waterSources);

	extraWaterNodeIds = $derived.by<number[]>(() => {
		const fromDataset = this.realWaterSources
			.filter((source) => source.kind !== 'applianceStand')
			.map((source) => source.nearestNodeId);
		const hypothetical = this.hypotheticalSources.map((source) => source.nodeId);
		return [...fromDataset, ...hypothetical, ...this.appliedInterventionNodeIds];
	});

	stopPointField = $derived.by<StopPointField | null>(() => {
		const network = this.network;
		if (!network) return null;
		return computeStopPointField(network, collectStopPointCandidates(network));
	});

	waterArrival = $derived.by<WaterArrivalField | null>(() => {
		const network = this.network;
		const buildings = dataset.buildings;
		if (!network || !buildings) return null;
		return computeWaterArrival(network, buildings, this.extraWaterNodeIds);
	});

	hoseReach = $derived.by<HoseReachResult | null>(() => {
		const network = this.network;
		const buildings = dataset.buildings;
		const adjacency = dataset.adjacency;
		if (!network || !buildings || !adjacency) return null;
		const supplyNodes = [
			...this.realWaterSources.map((source) => source.nearestNodeId),
			...this.hypotheticalSources.map((source) => source.nodeId)
		];
		return computeHoseReach({
			network,
			buildings,
			adjacency,
			sourceNodeIds: supplyNodes,
			maximumHoseLengthMeters: this.maximumHoseLengthMeters
		});
	});

	stopPointSolution = $derived.by<StopPointSolution | null>(() => {
		const network = this.network;
		const field = this.stopPointField;
		const buildings = dataset.buildings;
		if (!network || !field || !buildings || this.selectedBuildingIndex === null) return null;
		return solveStopPoint(network, field, buildings, this.selectedBuildingIndex);
	});

	currentFireState = $derived.by<Uint8Array | null>(() => {
		const playback = this.playback;
		if (playback.snapshots.length === 0) return null;
		const index = Math.min(playback.currentStep, playback.snapshots.length - 1);
		return playback.snapshots[index];
	});

	currentFireSummary = $derived.by<FireStepSummary | null>(() => {
		const playback = this.playback;
		if (playback.timeline.length === 0) return null;
		const index = Math.min(playback.currentStep, playback.timeline.length - 1);
		return playback.timeline[index];
	});

	selectedSegment = $derived.by<SegmentSummary | null>(() => {
		const network = this.network;
		if (!network || this.selectedSegmentId === null) return null;
		const source: WidthSource = this.correctedSegmentIds.has(this.selectedSegmentId)
			? 'field'
			: 'satellite';
		return summariseSegment(network, this.selectedSegmentId, source);
	});

	pendingCorrections = $derived(this.corrections.filter((record) => record.status === 'pending'));

	selectBuilding(index: number): void {
		this.selectedBuildingIndex = index;
	}

	selectSegment(segmentId: number): void {
		this.selectedSegmentId = segmentId;
		this.correctionErrorMessage = '';
	}

	async requestCorrection(sentence: string): Promise<void> {
		const segment = this.selectedSegment;
		if (!segment) return;

		this.correctionSubmitting = true;
		this.correctionErrorMessage = '';
		try {
			const response = await fetch(CORRECTION_ENDPOINT_PATH, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					sentence,
					segment: {
						segmentId: segment.segmentId,
						accessClass: segment.accessClass,
						minWidthMeters: segment.minWidthMeters,
						meanWidthMeters: segment.meanWidthMeters,
						lengthMeters: segment.lengthMeters
					}
				})
			});
			const body: unknown = await response.json();
			const parsed = correctionResponseSchema.safeParse(body);
			if (!parsed.success || !parsed.data.ok) {
				this.correctionErrorMessage =
					parsed.success && !parsed.data.ok
						? parsed.data.message
						: 'Jawaban layanan koreksi tidak dapat dibaca dan ditolak.';
				return;
			}
			this.corrections = [
				...this.corrections,
				{
					id: this.corrections.length,
					segmentId: segment.segmentId,
					previousMinWidthMeters: segment.minWidthMeters,
					previousAccessClass: segment.accessClass,
					proposal: parsed.data.proposal,
					originalSentence: sentence,
					status: 'pending'
				}
			];
		} catch {
			this.correctionErrorMessage = 'Gagal menghubungi layanan koreksi.';
		} finally {
			this.correctionSubmitting = false;
		}
	}

	setCorrectionStatus(id: number, status: CorrectionStatus): void {
		this.corrections = this.corrections.map((record) =>
			record.id === id ? { ...record, status } : record
		);
	}

	toggleIgnition(index: number): void {
		const existing = this.ignitionBuildingIndices.indexOf(index);
		if (existing >= 0) {
			this.ignitionBuildingIndices = this.ignitionBuildingIndices.filter(
				(value) => value !== index
			);
		} else {
			this.ignitionBuildingIndices = [...this.ignitionBuildingIndices, index];
		}
	}

	addHypotheticalSource(position: LonLat): void {
		const network = this.network;
		if (!network) return;
		const nodeId = findNearestNode(network, position);
		if (nodeId < 0) return;
		this.hypotheticalSources = [
			...this.hypotheticalSources,
			{ id: this.hypotheticalSources.length, position, nodeId }
		];
	}

	clearHypotheticalSources(): void {
		this.hypotheticalSources = [];
	}

	resetPlayback(): void {
		this.playback = createEmptyPlayback();
	}

	resetCoefficients(): void {
		this.coefficients = { ...DEFAULT_FIRE_COEFFICIENTS };
	}

	listWaterSourcesForMap(): WaterSource[] {
		return [
			...this.realWaterSources,
			...this.hypotheticalSources.map((source, index) => ({
				id: 100000 + index,
				lon: source.position.lon,
				lat: source.position.lat,
				kind: 'hypothetical' as const,
				label: 'Hidran usulan',
				nearestNodeId: source.nodeId,
				nearestNodeDistanceMeters: 0
			}))
		];
	}
}

export const workspace = new Workspace();
