import { describe, expect, it } from 'vitest';
import { buildChainNetwork, latitudeAfterMeters, longitudeAfterMeters } from '$lib/sim/fixtures';
import { findNearestNode, listEdgeCoordinates, rankSlowestBuildings } from '$lib/sim/network';

describe('network', () => {
	const network = buildChainNetwork(['largeUnit', 'smallUnit', 'hoseOnly'], 20);

	it('menemukan simpul terdekat dari sebuah posisi', () => {
		expect(findNearestNode(network, { lon: longitudeAfterMeters(3), lat: latitudeAfterMeters(27) })).toBe(1);
		expect(findNearestNode(network, { lon: longitudeAfterMeters(0), lat: latitudeAfterMeters(500) })).toBe(3);
	});

	it('memberi koordinat kedua ujung ruas', () => {
		const [from, to] = listEdgeCoordinates(network, 2);
		expect(from.lat).toBeCloseTo(latitudeAfterMeters(40), 9);
		expect(to.lat).toBeCloseTo(latitudeAfterMeters(60), 9);
	});

	it('mengurutkan bangunan paling lambat dan melewati yang tak terjangkau', () => {
		const seconds = Float32Array.from([120, Infinity, 480, 60, 300]);
		expect(rankSlowestBuildings(seconds, 3)).toEqual([2, 4, 0]);
		expect(rankSlowestBuildings(seconds, 10)).toEqual([2, 4, 0, 3]);
	});
});
