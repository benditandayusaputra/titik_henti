import {
	BUILDING_STATE_BURNING,
	BUILDING_STATE_BURNT_OUT,
	BUILDING_STATE_FULLY_INVOLVED,
	BUILDING_STATE_INTACT,
	BUILDING_STATE_SAVED,
	FIREBRAND_MIN_THROW_METERS,
	FIREBRAND_REFERENCE_WIND_SPEED,
	FIREBRAND_THROWS_PER_STEP,
	FIRE_MILESTONE_BUILDING_COUNT,
	FIRE_RADIATION_STRENGTH_BY_STATE,
	MAX_PAIR_IGNITION_PROBABILITY
} from '$lib/domain/constants';
import type {
	AdjacencyTable,
	BuildingTable,
	FireCoefficients,
	FireRunResult,
	FireScenario,
	FireStepSummary,
	WindField
} from '$lib/domain/types';
import { angleDifferenceDegrees, bearingDegrees } from '$lib/sim/geo';
import { hashToUnitInterval } from '$lib/sim/random';
import { buildSpatialGrid, findNearestBuilding, type SpatialGrid } from '$lib/sim/spatialGrid';

const FULL_TURN_DEGREES = 360;
const DEGREES_TO_RADIANS = Math.PI / 180;
const MINIMUM_WIND_FACTOR = 0.05;

export interface FireContext {
	buildings: BuildingTable;
	adjacency: AdjacencyTable;
	pairBearingDegrees: Float32Array;
	grid: SpatialGrid;
	scratchProbability: Float64Array;
	scratchTouched: Int32Array;
}

export interface FireState {
	state: Uint8Array;
	ignitionSeconds: Float32Array;
}

export interface FireStepInput {
	coefficients: FireCoefficients;
	wind: WindField;
	stepSeconds: number;
	elapsedSeconds: number;
	stepIndex: number;
	randomSeed: number;
	waterArrivalSeconds: Float32Array | null;
	suppressionEnabled: boolean;
	extinguisherBoost: Float32Array | null;
}

const IGNITION_CHANNEL = 0;
const EXTINGUISH_CHANNEL = 1;
const FIREBRAND_DISTANCE_CHANNEL = 2;
const FIREBRAND_HEADING_CHANNEL = 3;

export function createFireContext(
	buildings: BuildingTable,
	adjacency: AdjacencyTable
): FireContext {
	const pairBearingDegrees = new Float32Array(adjacency.neighbourIndex.length);
	for (let source = 0; source < adjacency.count; source += 1) {
		const from = { lon: buildings.lon[source], lat: buildings.lat[source] };
		for (let slot = adjacency.offsets[source]; slot < adjacency.offsets[source + 1]; slot += 1) {
			const target = adjacency.neighbourIndex[slot];
			pairBearingDegrees[slot] = bearingDegrees(from, {
				lon: buildings.lon[target],
				lat: buildings.lat[target]
			});
		}
	}
	return {
		buildings,
		adjacency,
		pairBearingDegrees,
		grid: buildSpatialGrid(buildings),
		scratchProbability: new Float64Array(buildings.count),
		scratchTouched: new Int32Array(buildings.count)
	};
}

export function createFireState(buildingCount: number): FireState {
	return {
		state: new Uint8Array(buildingCount),
		ignitionSeconds: new Float32Array(buildingCount).fill(Infinity)
	};
}

export function computeRadiationTerm(
	distanceMeters: number,
	sourceAreaSquareMeters: number,
	sourceHeightMeters: number,
	coefficients: FireCoefficients
): number {
	const reference = coefficients.radiationReferenceDistanceMeters;
	const effectiveDistance = Math.max(distanceMeters, reference);
	const falloff = Math.pow(reference / effectiveDistance, coefficients.radiationFalloffExponent);
	const sizeGain =
		(1 + coefficients.areaGain * sourceAreaSquareMeters) *
		(1 + coefficients.heightGain * sourceHeightMeters);
	return coefficients.radiationGain * sizeGain * falloff;
}

export function computeWindTerm(
	pairBearing: number,
	wind: WindField,
	coefficients: FireCoefficients
): number {
	const alignment = Math.cos((pairBearing - wind.directionDegrees) * DEGREES_TO_RADIANS);
	const strength = Math.min(1, coefficients.windSpeedGain * wind.speedMetersPerSecond);
	return Math.max(MINIMUM_WIND_FACTOR, 1 + coefficients.windAlignmentGain * alignment * strength);
}

export function computeMaterialTerm(
	materialCode: number,
	coefficients: FireCoefficients
): number {
	if (materialCode === 0) return coefficients.materialFactorMasonry;
	if (materialCode === 1) return coefficients.materialFactorMixed;
	return coefficients.materialFactorLightweight;
}

export function computeFirebrandTerm(
	distanceMeters: number,
	pairBearing: number,
	wind: WindField,
	coefficients: FireCoefficients
): number {
	if (distanceMeters > coefficients.firebrandRangeMeters) return 0;
	if (
		angleDifferenceDegrees(pairBearing, wind.directionDegrees) >
		coefficients.firebrandWindConeDegrees / 2
	) {
		return 0;
	}
	const reach = 1 - distanceMeters / coefficients.firebrandRangeMeters;
	const carry = Math.min(1, wind.speedMetersPerSecond / FIREBRAND_REFERENCE_WIND_SPEED);
	return coefficients.firebrandBaseProbability * reach * carry;
}

export function computePairIgnitionProbability(
	distanceMeters: number,
	pairBearing: number,
	sourceAreaSquareMeters: number,
	sourceHeightMeters: number,
	sourceStrength: number,
	targetMaterialCode: number,
	wind: WindField,
	coefficients: FireCoefficients
): number {
	const radiation = computeRadiationTerm(
		distanceMeters,
		sourceAreaSquareMeters,
		sourceHeightMeters,
		coefficients
	);
	const windTerm = computeWindTerm(pairBearing, wind, coefficients);
	const materialTerm = computeMaterialTerm(targetMaterialCode, coefficients);
	const firebrand = computeFirebrandTerm(distanceMeters, pairBearing, wind, coefficients);
	const combined = radiation * windTerm * materialTerm * sourceStrength + firebrand;
	return Math.min(MAX_PAIR_IGNITION_PROBABILITY, Math.max(0, combined));
}

function advanceBurningStates(fireState: FireState, elapsedSeconds: number, coefficients: FireCoefficients): void {
	for (let index = 0; index < fireState.state.length; index += 1) {
		const currentState = fireState.state[index];
		if (currentState !== BUILDING_STATE_BURNING && currentState !== BUILDING_STATE_FULLY_INVOLVED) {
			continue;
		}
		const age = elapsedSeconds - fireState.ignitionSeconds[index];
		if (age >= coefficients.fullToBurntSeconds) {
			fireState.state[index] = BUILDING_STATE_BURNT_OUT;
		} else if (age >= coefficients.growthToFullSeconds) {
			fireState.state[index] = BUILDING_STATE_FULLY_INVOLVED;
		}
	}
}

function throwFirebrands(
	context: FireContext,
	fireState: FireState,
	input: FireStepInput,
	accumulate: (target: number, probability: number) => void
): void {
	const { coefficients, wind } = input;
	if (coefficients.firebrandBaseProbability <= 0 || wind.speedMetersPerSecond <= 0) return;

	const halfCone = coefficients.firebrandWindConeDegrees / 2;
	for (let source = 0; source < fireState.state.length; source += 1) {
		if (fireState.state[source] !== BUILDING_STATE_FULLY_INVOLVED) continue;
		for (let attempt = 0; attempt < FIREBRAND_THROWS_PER_STEP; attempt += 1) {
			const distanceDraw = hashToUnitInterval(
				input.randomSeed,
				input.stepIndex,
				source,
				FIREBRAND_DISTANCE_CHANNEL + attempt * 2
			);
			const headingDraw = hashToUnitInterval(
				input.randomSeed,
				input.stepIndex,
				source,
				FIREBRAND_HEADING_CHANNEL + attempt * 2
			);
			const distance =
				FIREBRAND_MIN_THROW_METERS +
				distanceDraw * (coefficients.firebrandRangeMeters - FIREBRAND_MIN_THROW_METERS);
			const heading =
				(wind.directionDegrees + (headingDraw * 2 - 1) * halfCone + FULL_TURN_DEGREES) %
				FULL_TURN_DEGREES;
			const headingRadians = heading * DEGREES_TO_RADIANS;
			const landingLon =
				context.buildings.lon[source] +
				(Math.sin(headingRadians) * distance) / context.grid.metersPerDegreeLon;
			const landingLat =
				context.buildings.lat[source] +
				(Math.cos(headingRadians) * distance) / context.grid.metersPerDegreeLat;
			const target = findNearestBuilding(
				context.grid,
				context.buildings,
				landingLon,
				landingLat,
				context.grid.cellMeters
			);
			if (target < 0 || fireState.state[target] !== BUILDING_STATE_INTACT) continue;
			const term = computeFirebrandTerm(distance, heading, wind, coefficients);
			if (term <= 0) continue;
			accumulate(target, term);
		}
	}
}

export function stepFire(context: FireContext, fireState: FireState, input: FireStepInput): void {
	const { buildings, adjacency } = context;
	const { coefficients, wind } = input;
	const nextElapsedSeconds = input.elapsedSeconds + input.stepSeconds;
	const ignitionProbability = context.scratchProbability;
	const touched = context.scratchTouched;
	let touchedCount = 0;

	const accumulate = (target: number, probability: number): void => {
		const previous = ignitionProbability[target];
		if (previous === 0) {
			touched[touchedCount] = target;
			touchedCount += 1;
		}
		ignitionProbability[target] = 1 - (1 - previous) * (1 - probability);
	};

	for (let source = 0; source < buildings.count; source += 1) {
		const sourceStrength = FIRE_RADIATION_STRENGTH_BY_STATE[fireState.state[source]];
		if (sourceStrength === 0) continue;
		const sourceArea = buildings.areaSquareMeters[source];
		const sourceHeight = buildings.heightMeters[source];
		for (let slot = adjacency.offsets[source]; slot < adjacency.offsets[source + 1]; slot += 1) {
			const target = adjacency.neighbourIndex[slot];
			if (fireState.state[target] !== BUILDING_STATE_INTACT) continue;
			const probability = computePairIgnitionProbability(
				adjacency.edgeDistanceMeters[slot],
				context.pairBearingDegrees[slot],
				sourceArea,
				sourceHeight,
				sourceStrength,
				buildings.materialClass[target],
				wind,
				coefficients
			);
			if (probability > 0) accumulate(target, probability);
		}
	}

	throwFirebrands(context, fireState, input, accumulate);

	const suppressionFactor = 1 - coefficients.suppressionEffectiveness;
	for (let slot = 0; slot < touchedCount; slot += 1) {
		const target = touched[slot];
		let probability = ignitionProbability[target];
		ignitionProbability[target] = 0;
		if (fireState.state[target] !== BUILDING_STATE_INTACT) continue;
		if (isWaterOnScene(input, target, nextElapsedSeconds)) {
			probability *= suppressionFactor;
		}
		if (input.extinguisherBoost) {
			probability *= 1 - input.extinguisherBoost[target];
		}
		if (probability <= 0) continue;
		const ignitionDraw = hashToUnitInterval(
			input.randomSeed,
			input.stepIndex,
			target,
			IGNITION_CHANNEL
		);
		if (ignitionDraw < probability) {
			fireState.state[target] = BUILDING_STATE_BURNING;
			fireState.ignitionSeconds[target] = nextElapsedSeconds;
		}
	}

	if (input.suppressionEnabled && input.waterArrivalSeconds && coefficients.extinguishChancePerStep > 0) {
		for (let target = 0; target < buildings.count; target += 1) {
			if (fireState.state[target] !== BUILDING_STATE_BURNING) continue;
			if (!isWaterOnScene(input, target, nextElapsedSeconds)) continue;
			if (fireState.ignitionSeconds[target] >= nextElapsedSeconds) continue;
			const extinguishDraw = hashToUnitInterval(
				input.randomSeed,
				input.stepIndex,
				target,
				EXTINGUISH_CHANNEL
			);
			if (extinguishDraw < coefficients.extinguishChancePerStep) {
				fireState.state[target] = BUILDING_STATE_SAVED;
			}
		}
	}

	advanceBurningStates(fireState, nextElapsedSeconds, coefficients);
}

function isWaterOnScene(input: FireStepInput, target: number, elapsedSeconds: number): boolean {
	if (!input.suppressionEnabled || !input.waterArrivalSeconds) return false;
	return elapsedSeconds > input.waterArrivalSeconds[target];
}

export function summariseFire(
	fireState: FireState,
	stepIndex: number,
	elapsedSeconds: number
): FireStepSummary {
	let burningCount = 0;
	let burntCount = 0;
	let savedCount = 0;
	let intactCount = 0;
	for (let index = 0; index < fireState.state.length; index += 1) {
		const value = fireState.state[index];
		if (value === BUILDING_STATE_BURNING || value === BUILDING_STATE_FULLY_INVOLVED) burningCount += 1;
		else if (value === BUILDING_STATE_BURNT_OUT) burntCount += 1;
		else if (value === BUILDING_STATE_SAVED) savedCount += 1;
		else intactCount += 1;
	}
	return { stepIndex, elapsedSeconds, burningCount, burntCount, savedCount, intactCount };
}

export function countTouchedByFire(fireState: FireState): number {
	let touched = 0;
	for (let index = 0; index < fireState.state.length; index += 1) {
		if (fireState.state[index] !== BUILDING_STATE_INTACT && fireState.state[index] !== BUILDING_STATE_SAVED) {
			touched += 1;
		}
	}
	return touched;
}

export function runFireSimulation(
	context: FireContext,
	scenario: FireScenario,
	coefficients: FireCoefficients,
	waterArrivalSeconds: Float32Array | null,
	extinguisherBoost: Float32Array | null = null
): FireRunResult {
	const fireState = createFireState(context.buildings.count);
	for (const ignition of scenario.ignitionBuildingIndices) {
		if (ignition < 0 || ignition >= context.buildings.count) continue;
		fireState.state[ignition] = BUILDING_STATE_BURNING;
		fireState.ignitionSeconds[ignition] = 0;
	}

	const timeline: FireStepSummary[] = [summariseFire(fireState, 0, 0)];
	let secondsToTenBuildings = Infinity;

	for (let step = 0; step < scenario.stepCount; step += 1) {
		const elapsedSeconds = step * scenario.stepSeconds;
		stepFire(context, fireState, {
			coefficients,
			wind: scenario.wind,
			stepSeconds: scenario.stepSeconds,
			elapsedSeconds,
			stepIndex: step,
			randomSeed: scenario.randomSeed,
			waterArrivalSeconds,
			suppressionEnabled: scenario.suppressionEnabled,
			extinguisherBoost
		});
		const summary = summariseFire(fireState, step + 1, elapsedSeconds + scenario.stepSeconds);
		timeline.push(summary);
		if (
			!Number.isFinite(secondsToTenBuildings) &&
			countTouchedByFire(fireState) >= FIRE_MILESTONE_BUILDING_COUNT
		) {
			secondsToTenBuildings = summary.elapsedSeconds;
		}
	}

	const last = timeline[timeline.length - 1];
	return {
		state: fireState.state,
		ignitionSeconds: fireState.ignitionSeconds,
		timeline,
		secondsToTenBuildings,
		totalAffectedCount: countTouchedByFire(fireState),
		savedCount: last.savedCount
	};
}
