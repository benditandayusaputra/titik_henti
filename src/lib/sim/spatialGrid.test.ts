import { describe, expect, it } from 'vitest';
import {
	buildBuildingTable,
	latitudeAfterMeters,
	longitudeAfterMeters,
	type BuildingSeed
} from '$lib/sim/fixtures';
import { buildSpatialGrid, collectBuildingsWithin, findNearestBuilding } from '$lib/sim/spatialGrid';

function seedAtMeters(eastMeters: number, northMeters: number): BuildingSeed {
	return {
		lon: longitudeAfterMeters(eastMeters),
		lat: latitudeAfterMeters(northMeters),
		areaSquareMeters: 40,
		heightMeters: 4,
		materialCode: 2,
		nearestNodeId: -1,
		nearestNodeDistanceMeters: 0
	};
}

describe('spatialGrid', () => {
	const offsets: [number, number][] = [
		[0, 0],
		[10, 0],
		[45, 0],
		[100, 100],
		[200, 5]
	];
	const buildings = buildBuildingTable(offsets.map(([east, north]) => seedAtMeters(east, north)));
	const grid = buildSpatialGrid(buildings);

	it('setiap bangunan masuk tepat satu sel', () => {
		expect(grid.cellItems.length).toBe(buildings.count);
		expect(new Set(grid.cellItems).size).toBe(buildings.count);
		expect(grid.cellStart[grid.columnCount * grid.rowCount]).toBe(buildings.count);
	});

	it('menemukan bangunan terdekat dalam batas jarak, termasuk di sel tetangga', () => {
		expect(findNearestBuilding(grid, buildings, longitudeAfterMeters(8), latitudeAfterMeters(1), 20)).toBe(1);
		expect(findNearestBuilding(grid, buildings, longitudeAfterMeters(28), latitudeAfterMeters(0), 20)).toBe(2);
		expect(findNearestBuilding(grid, buildings, longitudeAfterMeters(150), latitudeAfterMeters(50), 20)).toBe(-1);
	});

	it('mengumpulkan seluruh bangunan di dalam radius dan tidak lebih', () => {
		const within = collectBuildingsWithin(grid, buildings, longitudeAfterMeters(0), latitudeAfterMeters(0), 50);
		expect(within.sort()).toEqual([0, 1, 2]);
		const wide = collectBuildingsWithin(grid, buildings, longitudeAfterMeters(0), latitudeAfterMeters(0), 150);
		expect(wide.sort()).toEqual([0, 1, 2, 3]);
	});
});
