import { describe, expect, it } from 'vitest';
import {
	DEFAULT_FIRE_COEFFICIENTS,
	FIRE_STEP_SECONDS,
	OPTIMIZER_WATER_SOURCE_COST_RUPIAH,
	OPTIMIZER_WIDENING_COST_RUPIAH_PER_METER
} from '$lib/domain/constants';
import { createFireContext } from '$lib/sim/fireSpread';
import {
	buildAdjacencyTable,
	buildBuildingTable,
	buildChainNetwork,
	latitudeAfterMeters,
	longitudeAfterMeters
} from '$lib/sim/fixtures';
import {
	buildInterventionCandidates,
	computeSegmentUsage,
	estimateSegmentLengthMeters,
	runGreedyOptimizer,
	type OptimizerInput
} from '$lib/sim/optimizer';
import type { AccessClass } from '$lib/domain/types';

const SPACING_METERS = 20;
const BUILDING_COUNT = 4;

function buildWorld(narrowClass: AccessClass = 'hoseOnly') {
	const network = buildChainNetwork(
		['largeUnit', narrowClass, narrowClass, narrowClass],
		SPACING_METERS
	);
	const buildings = buildBuildingTable(
		Array.from({ length: BUILDING_COUNT }, (_, index) => ({
			lon: longitudeAfterMeters(index * 7),
			lat: latitudeAfterMeters(80),
			areaSquareMeters: 36,
			heightMeters: 4,
			materialCode: 2,
			nearestNodeId: 4,
			nearestNodeDistanceMeters: 3 + index * 7
		}))
	);
	const neighbourLists = Array.from({ length: BUILDING_COUNT }, (_, index) =>
		[index - 1, index + 1].filter((neighbour) => neighbour >= 0 && neighbour < BUILDING_COUNT)
	);
	const adjacency = buildAdjacencyTable(
		neighbourLists,
		neighbourLists.map((list) => list.map(() => 1))
	);
	return { network, buildings, adjacency };
}

function buildInput(budgetRupiah: number, narrowClass: AccessClass = 'hoseOnly'): OptimizerInput {
	const { network, buildings, adjacency } = buildWorld(narrowClass);
	return {
		context: createFireContext(buildings, adjacency),
		network,
		buildings,
		candidates: buildInterventionCandidates(network, buildings, [3, 2, 1, 0], 8),
		budgetRupiah,
		coefficients: DEFAULT_FIRE_COEFFICIENTS,
		stepSeconds: FIRE_STEP_SECONDS,
		stepCount: 30,
		randomSeed: 2026,
		baseWaterNodeIds: [],
		ignitionPool: [0, 1, 2, 3]
	};
}

describe('optimizer', () => {
	it('panjang segmen adalah jumlah panjang ruas bersegmen sama', () => {
		const { network } = buildWorld();
		expect(estimateSegmentLengthMeters(network, 2)).toBe(SPACING_METERS);
		expect(estimateSegmentLengthMeters(network, 99)).toBe(0);
	});

	it('pemakaian segmen menghitung bangunan yang selangnya melewati segmen itu', () => {
		const { network, buildings } = buildWorld();
		expect([...computeSegmentUsage(network, buildings)]).toEqual([0, 4, 4, 4]);
	});

	it('kandidat hanya melebarkan gang sempit yang dipakai dan menaruh air di simpul bangunan lambat', () => {
		const { network, buildings } = buildWorld();
		const candidates = buildInterventionCandidates(network, buildings, [3, 2, 1, 0], 8);

		const widening = candidates.filter((candidate) => candidate.kind === 'wideningSegment');
		expect(widening.map((candidate) => candidate.targetEdgeId).sort()).toEqual([1, 2, 3]);
		for (const candidate of widening) {
			expect(candidate.costRupiah).toBe(SPACING_METERS * OPTIMIZER_WIDENING_COST_RUPIAH_PER_METER);
		}

		const water = candidates.filter((candidate) => candidate.kind === 'waterSource');
		expect(water.map((candidate) => candidate.targetNodeId)).toEqual([4]);
		expect(water[0].costRupiah).toBe(OPTIMIZER_WATER_SOURCE_COST_RUPIAH);
		expect(new Set(candidates.map((candidate) => candidate.id)).size).toBe(candidates.length);
	});

	it('anggaran nol tidak memilih apa pun dan hasilnya sama dengan kondisi awal', () => {
		const outcome = runGreedyOptimizer(buildInput(0));
		expect(outcome.selected).toEqual([]);
		expect(outcome.spentRupiah).toBe(0);
		expect(outcome.improvedExpectedBurnt).toBe(outcome.baselineExpectedBurnt);
	});

	it('pilihan berhenti saat anggaran habis, tidak memperburuk, dan dapat diulang persis', () => {
		const budgetRupiah = 60_000_000;
		const run = () => {
			const input = buildInput(budgetRupiah, 'smallUnit');
			return runGreedyOptimizer({
				...input,
				candidates: input.candidates.filter((candidate) => candidate.kind === 'wideningSegment')
			});
		};
		const first = run();

		expect(first.selected.map((candidate) => candidate.id)).toEqual(['widen-1', 'widen-2']);
		expect(first.selected.map((candidate) => candidate.rank)).toEqual([1, 2]);
		expect(first.spentRupiah).toBe(2 * SPACING_METERS * OPTIMIZER_WIDENING_COST_RUPIAH_PER_METER);
		expect(first.spentRupiah).toBeLessThanOrEqual(budgetRupiah);
		expect(first.improvedExpectedBurnt).toBeLessThan(first.baselineExpectedBurnt);
		expect(run()).toEqual(first);
	});
});
