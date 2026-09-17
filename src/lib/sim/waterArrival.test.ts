import { describe, expect, it } from 'vitest';
import { buildBuildingTable, buildChainNetwork, latitudeAfterMeters } from '$lib/sim/fixtures';
import { collectSupplyNodes, computeWaterArrival } from '$lib/sim/waterArrival';

const SPACING_METERS = 20;

describe('waterArrival', () => {
	const network = buildChainNetwork(
		['largeUnit', 'hoseOnly', 'hoseOnly', 'hoseOnly', 'hoseOnly'],
		SPACING_METERS
	);
	const buildings = buildBuildingTable([
		{
			lon: 106.7,
			lat: latitudeAfterMeters(100),
			areaSquareMeters: 40,
			heightMeters: 4,
			materialCode: 2,
			nearestNodeId: 5,
			nearestNodeDistanceMeters: 4
		}
	]);

	it('sumber air tambahan digabung tanpa duplikat dan simpul di luar jaringan dibuang', () => {
		const baseline = collectSupplyNodes(network, []);
		expect(baseline).toEqual([0, 1]);
		expect(collectSupplyNodes(network, [1, 5, 5, 42, -3])).toEqual([0, 1, 5]);
	});

	it('hidran uji coba di dekat bangunan memangkas waktu air sampai', () => {
		const before = computeWaterArrival(network, buildings, []);
		const after = computeWaterArrival(network, buildings, [5]);
		expect(Number.isFinite(before.secondsPerBuilding[0])).toBe(true);
		expect(after.secondsPerBuilding[0]).toBeLessThan(before.secondsPerBuilding[0]);
	});
});
