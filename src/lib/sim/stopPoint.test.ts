import { describe, expect, it } from 'vitest';
import { HOSE_ROLL_LENGTH_METERS } from '$lib/domain/constants';
import {
	buildBuildingTable,
	buildChainNetwork,
	latitudeAfterMeters,
	type BuildingSeed
} from '$lib/sim/fixtures';
import {
	collectApplianceStandNodes,
	collectStopPointCandidates,
	computeStopPointField,
	computeWaterArrivalField,
	countHoseRolls,
	estimateHoseDeploySeconds,
	solveStopPoint,
	upgradeAccessClasses
} from '$lib/sim/stopPoint';

const SPACING_METERS = 20;

function seedAt(nodeId: number, connectionMeters: number, meters: number): BuildingSeed {
	return {
		lon: 106.7,
		lat: latitudeAfterMeters(meters),
		areaSquareMeters: 45,
		heightMeters: 4,
		materialCode: 2,
		nearestNodeId: nodeId,
		nearestNodeDistanceMeters: connectionMeters
	};
}

describe('stopPoint', () => {
	it('menempatkan titik henti di bangunan yang langsung menghadap jalan besar', () => {
		const network = buildChainNetwork(['largeUnit', 'largeUnit'], SPACING_METERS);
		const field = computeStopPointField(network, collectStopPointCandidates(network));
		const buildings = buildBuildingTable([seedAt(0, 6, 0)]);

		const solution = solveStopPoint(network, field, buildings, 0);

		expect(solution.reachable).toBe(true);
		expect(solution.stopNodeId).toBe(0);
		expect(solution.hoseLengthMeters).toBeCloseTo(6, 5);
		expect(solution.hoseRollCount).toBe(1);
		expect(solution.blockingAccessClass).toBeNull();
	});

	it('menarik selang sepanjang gang buntu sampai ujung', () => {
		const network = buildChainNetwork(
			['largeUnit', 'smallUnit', 'hoseOnly', 'hoseOnly'],
			SPACING_METERS
		);
		const field = computeStopPointField(network, collectStopPointCandidates(network));
		const buildings = buildBuildingTable([seedAt(4, 5, 4 * SPACING_METERS)]);

		const solution = solveStopPoint(network, field, buildings, 0);

		expect(solution.reachable).toBe(true);
		expect(solution.stopNodeId).toBe(1);
		expect(solution.hoseLengthMeters).toBeCloseTo(3 * SPACING_METERS + 5, 4);
		expect(solution.hoseRollCount).toBe(countHoseRolls(65));
		expect(solution.blockingAccessClass).toBe('hoseOnly');
		expect(solution.hosePath.length).toBeGreaterThan(2);
	});

	it('menandai bangunan yang tidak terhubung ke jalan kelas unit besar manapun', () => {
		const network = buildChainNetwork(['hoseOnly', 'smallUnit', 'hoseOnly'], SPACING_METERS);
		const field = computeStopPointField(network, collectStopPointCandidates(network));
		const buildings = buildBuildingTable([seedAt(2, 4, 2 * SPACING_METERS)]);

		const solution = solveStopPoint(network, field, buildings, 0);

		expect(solution.reachable).toBe(false);
		expect(solution.hoseLengthMeters).toBe(Infinity);
		expect(solution.extraDelaySeconds).toBe(Infinity);
	});

	it('menandai bangunan tanpa node terdekat sebagai tidak terjangkau', () => {
		const network = buildChainNetwork(['largeUnit'], SPACING_METERS);
		const field = computeStopPointField(network, collectStopPointCandidates(network));
		const buildings = buildBuildingTable([seedAt(-1, 0, 0)]);

		expect(solveStopPoint(network, field, buildings, 0).reachable).toBe(false);
	});

	it('menghitung jumlah gulung selang dari panjang selang', () => {
		expect(countHoseRolls(1)).toBe(1);
		expect(countHoseRolls(HOSE_ROLL_LENGTH_METERS)).toBe(1);
		expect(countHoseRolls(HOSE_ROLL_LENGTH_METERS + 0.5)).toBe(2);
		expect(countHoseRolls(5 * HOSE_ROLL_LENGTH_METERS)).toBe(5);
	});

	it('menaikkan kelas akses memperpendek waktu air sampai', () => {
		const network = buildChainNetwork(
			['largeUnit', 'smallUnit', 'smallUnit', 'smallUnit'],
			SPACING_METERS
		);
		const buildings = buildBuildingTable([seedAt(4, 5, 4 * SPACING_METERS)]);

		const baseField = computeStopPointField(network, collectStopPointCandidates(network));
		const baseArrival = computeWaterArrivalField(baseField, buildings);

		const widened = upgradeAccessClasses(network);
		const widenedField = computeStopPointField(widened, collectStopPointCandidates(widened));
		const widenedArrival = computeWaterArrivalField(widenedField, buildings);

		expect(widenedArrival.secondsPerBuilding[0]).toBeLessThan(baseArrival.secondsPerBuilding[0]);
	});

	it('menaikkan waktu penggelaran seiring panjang selang', () => {
		expect(estimateHoseDeploySeconds(120)).toBeGreaterThan(estimateHoseDeploySeconds(40));
	});
});

describe('posisi unit pemadam', () => {
	it('hanya memilih simpul di gang kelas unit besar', () => {
		const network = buildChainNetwork(['hoseOnly', 'largeUnit', 'hoseOnly'], 100);
		const stands = collectApplianceStandNodes(network, 60);

		expect(stands).toEqual([1, 2]);
	});

	it('menjaga jarak antarposisi sesuai spasi yang diminta', () => {
		const network = buildChainNetwork(['largeUnit', 'largeUnit', 'largeUnit'], 20);
		const rapat = collectApplianceStandNodes(network, 10);
		const renggang = collectApplianceStandNodes(network, 50);

		expect(rapat.length).toBe(4);
		expect(renggang.length).toBe(2);
	});

	it('ikut bertambah saat seluruh gang dinaikkan satu kelas', () => {
		const network = buildChainNetwork(['hoseOnly', 'smallUnit', 'hoseOnly'], 100);
		const sebelum = collectApplianceStandNodes(network, 60);
		const sesudah = collectApplianceStandNodes(upgradeAccessClasses(network), 60);

		expect(sebelum).toEqual([]);
		expect(sesudah.length).toBeGreaterThan(0);
	});
});
