import { describe, expect, it } from 'vitest';
import {
	buildAdjacencyTable,
	buildBuildingTable,
	buildChainNetwork,
	buildRowOfBuildings,
	latitudeAfterMeters,
	type BuildingSeed
} from '$lib/sim/fixtures';
import {
	computeHoseReach,
	computeReachedNodeDistances,
	groupUnreachedIntoPockets
} from '$lib/sim/hoseReach';
import { estimateHoseDeploySeconds } from '$lib/sim/stopPoint';

const SPACING_METERS = 20;

function seedAtNode(nodeId: number, connectionMeters: number): BuildingSeed {
	return {
		lon: 106.7,
		lat: latitudeAfterMeters(nodeId * SPACING_METERS),
		areaSquareMeters: 40,
		heightMeters: 4,
		materialCode: 2,
		nearestNodeId: nodeId,
		nearestNodeDistanceMeters: connectionMeters
	};
}

describe('hoseReach', () => {
	const network = buildChainNetwork(['hoseOnly', 'hoseOnly', 'hoseOnly', 'hoseOnly'], SPACING_METERS);

	it('jarak selang berhenti di batas panjang maksimum', () => {
		const distances = computeReachedNodeDistances(network, [0], 50);
		expect([...distances]).toEqual([0, 20, 40, Infinity, Infinity]);
	});

	it('beberapa sumber air memakai jarak terdekat dan sumber tidak sah diabaikan', () => {
		const distances = computeReachedNodeDistances(network, [0, 4, 99, -1], 100);
		expect([...distances]).toEqual([0, 20, 40, 20, 0]);
	});

	it('bangunan tak terjangkau yang bersebelahan jadi satu kantong, terbesar lebih dulu', () => {
		const { buildings, adjacency } = buildRowOfBuildings(6, 2, 6);
		const reached = Uint8Array.from([0, 1, 0, 0, 1, 1]);
		const { pocketOfBuilding, pockets } = groupUnreachedIntoPockets(buildings, adjacency, reached);

		expect(pockets.map((pocket) => pocket.buildingCount)).toEqual([2, 1]);
		expect(pockets.map((pocket) => pocket.id)).toEqual([0, 1]);
		expect(pockets[0].buildingIndices.sort()).toEqual([2, 3]);
		expect([...pocketOfBuilding]).toEqual([1, -1, 0, 0, -1, -1]);
	});

	it('menandai bangunan terjangkau bila jarak simpul ditambah sambungan masih dalam batas', () => {
		const buildings = buildBuildingTable([seedAtNode(2, 5), seedAtNode(2, 15), seedAtNode(0, 0)]);
		const adjacency = buildAdjacencyTable([[1], [0], []], [[3], [3], []]);
		const result = computeHoseReach({
			network,
			buildings,
			adjacency,
			sourceNodeIds: [0],
			maximumHoseLengthMeters: 50
		});

		expect([...result.buildingReached]).toEqual([1, 0, 1]);
		expect(result.buildingWaterDelaySeconds[0]).toBeCloseTo(estimateHoseDeploySeconds(45), 3);
		expect(result.buildingWaterDelaySeconds[1]).toBe(Infinity);
		expect(result.reachedBuildingCount).toBe(2);
		expect(result.unreachedBuildingCount).toBe(1);
		expect(result.pockets).toHaveLength(1);
		expect(result.pockets[0].buildingIndices).toEqual([1]);
	});
});
