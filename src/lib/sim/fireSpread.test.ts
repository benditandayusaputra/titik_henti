import { describe, expect, it } from 'vitest';
import {
	BUILDING_STATE_INTACT,
	BUILDING_STATE_SAVED,
	DEFAULT_FIRE_COEFFICIENTS,
	FIRE_STEP_SECONDS
} from '$lib/domain/constants';
import type { FireCoefficients, FireScenario } from '$lib/domain/types';
import {
	computeWindTerm,
	createFireContext,
	runFireSimulation
} from '$lib/sim/fireSpread';
import { buildBuildingTable, buildAdjacencyTable, buildRowOfBuildings } from '$lib/sim/fixtures';

const SEED = 424242;

function buildScenario(overrides: Partial<FireScenario> = {}): FireScenario {
	return {
		ignitionBuildingIndices: [0],
		wind: { directionDegrees: 0, speedMetersPerSecond: 0 },
		randomSeed: SEED,
		stepSeconds: FIRE_STEP_SECONDS,
		stepCount: 40,
		suppressionEnabled: false,
		...overrides
	};
}

function withCoefficients(overrides: Partial<FireCoefficients>): FireCoefficients {
	return { ...DEFAULT_FIRE_COEFFICIENTS, ...overrides };
}

describe('fireSpread', () => {
	it('bangunan terisolasi tidak menyebarkan api', () => {
		const buildings = buildBuildingTable([
			{
				lon: 106.7,
				lat: -6.15,
				areaSquareMeters: 60,
				heightMeters: 5,
				materialCode: 2,
				nearestNodeId: -1,
				nearestNodeDistanceMeters: 0
			},
			{
				lon: 106.75,
				lat: -6.15,
				areaSquareMeters: 60,
				heightMeters: 5,
				materialCode: 2,
				nearestNodeId: -1,
				nearestNodeDistanceMeters: 0
			}
		]);
		const adjacency = buildAdjacencyTable([[], []], [[], []]);
		const context = createFireContext(buildings, adjacency);

		const result = runFireSimulation(
			context,
			buildScenario(),
			withCoefficients({ firebrandBaseProbability: 0 }),
			null
		);

		expect(result.totalAffectedCount).toBe(1);
		expect(result.state[1]).toBe(BUILDING_STATE_INTACT);
	});

	it('dua bangunan berdampingan saling menyebarkan api', () => {
		const { buildings, adjacency } = buildRowOfBuildings(2, 2, 8);
		const context = createFireContext(buildings, adjacency);

		const result = runFireSimulation(context, buildScenario(), DEFAULT_FIRE_COEFFICIENTS, null);

		expect(result.totalAffectedCount).toBe(2);
	});

	it('angin nol menghasilkan pola simetris di kedua arah', () => {
		const { buildings, adjacency } = buildRowOfBuildings(21, 2.5, 7);
		const context = createFireContext(buildings, adjacency);

		const result = runFireSimulation(
			context,
			buildScenario({ ignitionBuildingIndices: [10], stepCount: 30 }),
			withCoefficients({ firebrandBaseProbability: 0 }),
			null
		);

		let leftReach = 0;
		let rightReach = 0;
		for (let index = 0; index < 10; index += 1) {
			if (result.state[index] !== BUILDING_STATE_INTACT) leftReach = Math.max(leftReach, 10 - index);
		}
		for (let index = 11; index < 21; index += 1) {
			if (result.state[index] !== BUILDING_STATE_INTACT)
				rightReach = Math.max(rightReach, index - 10);
		}

		expect(leftReach).toBeGreaterThan(0);
		expect(Math.abs(leftReach - rightReach)).toBeLessThanOrEqual(1);
	});

	it('memperbesar probabilitas searah angin dan memperkecil arah berlawanan', () => {
		const wind = { directionDegrees: 90, speedMetersPerSecond: 8 };
		const downwind = computeWindTerm(90, wind, DEFAULT_FIRE_COEFFICIENTS);
		const upwind = computeWindTerm(270, wind, DEFAULT_FIRE_COEFFICIENTS);
		const crosswind = computeWindTerm(0, wind, DEFAULT_FIRE_COEFFICIENTS);

		expect(downwind).toBeGreaterThan(crosswind);
		expect(upwind).toBeLessThan(crosswind);
	});
});

describe('kopling pemadaman', () => {
	function buildBlock() {
		const { buildings, adjacency } = buildRowOfBuildings(60, 2.5, 7);
		return createFireContext(buildings, adjacency);
	}

	function countBurnt(waterArrivalSeconds: Float32Array, coefficients: FireCoefficients): number {
		const context = buildBlock();
		return runFireSimulation(
			context,
			buildScenario({ ignitionBuildingIndices: [30], stepCount: 60, suppressionEnabled: true }),
			coefficients,
			waterArrivalSeconds
		).totalAffectedCount;
	}

	function fillArrival(count: number, seconds: number): Float32Array {
		return new Float32Array(count).fill(seconds);
	}

	it('menaikkan waktu air sampai tidak pernah mengurangi jumlah bangunan terbakar', () => {
		const fast = countBurnt(fillArrival(60, 120), DEFAULT_FIRE_COEFFICIENTS);
		const slow = countBurnt(fillArrival(60, 900), DEFAULT_FIRE_COEFFICIENTS);
		const slowest = countBurnt(fillArrival(60, 3600), DEFAULT_FIRE_COEFFICIENTS);

		expect(slow).toBeGreaterThanOrEqual(fast);
		expect(slowest).toBeGreaterThanOrEqual(slow);
	});

	it('menurunkan waktu air sampai tidak pernah menambah jumlah bangunan terbakar', () => {
		const slow = countBurnt(fillArrival(60, 2400), DEFAULT_FIRE_COEFFICIENTS);
		const medium = countBurnt(fillArrival(60, 600), DEFAULT_FIRE_COEFFICIENTS);
		const fast = countBurnt(fillArrival(60, 60), DEFAULT_FIRE_COEFFICIENTS);

		expect(medium).toBeLessThanOrEqual(slow);
		expect(fast).toBeLessThanOrEqual(medium);
	});

	it('efektivitas pemadaman nol menghasilkan hasil identik dengan tanpa pemadaman', () => {
		const withoutSuppression = runFireSimulation(
			buildBlock(),
			buildScenario({ ignitionBuildingIndices: [30], stepCount: 60, suppressionEnabled: false }),
			DEFAULT_FIRE_COEFFICIENTS,
			null
		);
		const neutralisedSuppression = runFireSimulation(
			buildBlock(),
			buildScenario({ ignitionBuildingIndices: [30], stepCount: 60, suppressionEnabled: true }),
			withCoefficients({ suppressionEffectiveness: 0, extinguishChancePerStep: 0 }),
			fillArrival(60, 0)
		);

		expect(neutralisedSuppression.totalAffectedCount).toBe(withoutSuppression.totalAffectedCount);
		expect(Array.from(neutralisedSuppression.state)).toEqual(Array.from(withoutSuppression.state));
	});

	it('pemadaman cepat menghasilkan bangunan berstatus terselamatkan', () => {
		const result = runFireSimulation(
			buildBlock(),
			buildScenario({ ignitionBuildingIndices: [30], stepCount: 60, suppressionEnabled: true }),
			DEFAULT_FIRE_COEFFICIENTS,
			fillArrival(60, 60)
		);

		let savedCount = 0;
		for (const value of result.state) {
			if (value === BUILDING_STATE_SAVED) savedCount += 1;
		}
		expect(savedCount).toBeGreaterThan(0);
	});
});
