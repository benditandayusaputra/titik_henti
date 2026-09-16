import { EARTH_RADIUS_METERS, SPATIAL_GRID_CELL_METERS } from '$lib/domain/constants';
import type { BuildingTable } from '$lib/domain/types';

const DEGREES_TO_RADIANS = Math.PI / 180;

export interface SpatialGrid {
	originLon: number;
	originLat: number;
	metersPerDegreeLon: number;
	metersPerDegreeLat: number;
	cellMeters: number;
	columnCount: number;
	rowCount: number;
	cellStart: Int32Array;
	cellItems: Int32Array;
}

export function buildSpatialGrid(buildings: BuildingTable): SpatialGrid {
	let minLon = Infinity;
	let minLat = Infinity;
	let maxLon = -Infinity;
	let maxLat = -Infinity;
	for (let index = 0; index < buildings.count; index += 1) {
		if (buildings.lon[index] < minLon) minLon = buildings.lon[index];
		if (buildings.lon[index] > maxLon) maxLon = buildings.lon[index];
		if (buildings.lat[index] < minLat) minLat = buildings.lat[index];
		if (buildings.lat[index] > maxLat) maxLat = buildings.lat[index];
	}

	const midLatitude = (minLat + maxLat) / 2;
	const metersPerDegreeLat = DEGREES_TO_RADIANS * EARTH_RADIUS_METERS;
	const metersPerDegreeLon = metersPerDegreeLat * Math.cos(midLatitude * DEGREES_TO_RADIANS);
	const cellMeters = SPATIAL_GRID_CELL_METERS;

	const columnCount = Math.max(
		1,
		Math.ceil(((maxLon - minLon) * metersPerDegreeLon) / cellMeters) + 1
	);
	const rowCount = Math.max(1, Math.ceil(((maxLat - minLat) * metersPerDegreeLat) / cellMeters) + 1);

	const cellOf = (index: number): number => {
		const column = Math.min(
			columnCount - 1,
			Math.floor(((buildings.lon[index] - minLon) * metersPerDegreeLon) / cellMeters)
		);
		const row = Math.min(
			rowCount - 1,
			Math.floor(((buildings.lat[index] - minLat) * metersPerDegreeLat) / cellMeters)
		);
		return row * columnCount + column;
	};

	const cellCount = columnCount * rowCount;
	const counts = new Int32Array(cellCount + 1);
	for (let index = 0; index < buildings.count; index += 1) {
		counts[cellOf(index) + 1] += 1;
	}
	for (let cell = 0; cell < cellCount; cell += 1) {
		counts[cell + 1] += counts[cell];
	}
	const cellStart = counts;
	const cursor = cellStart.slice(0, cellCount);
	const cellItems = new Int32Array(buildings.count);
	for (let index = 0; index < buildings.count; index += 1) {
		const cell = cellOf(index);
		cellItems[cursor[cell]] = index;
		cursor[cell] += 1;
	}

	return {
		originLon: minLon,
		originLat: minLat,
		metersPerDegreeLon,
		metersPerDegreeLat,
		cellMeters,
		columnCount,
		rowCount,
		cellStart,
		cellItems
	};
}

export function findNearestBuilding(
	grid: SpatialGrid,
	buildings: BuildingTable,
	longitude: number,
	latitude: number,
	maximumMeters: number
): number {
	const eastingMeters = (longitude - grid.originLon) * grid.metersPerDegreeLon;
	const northingMeters = (latitude - grid.originLat) * grid.metersPerDegreeLat;
	const centerColumn = Math.floor(eastingMeters / grid.cellMeters);
	const centerRow = Math.floor(northingMeters / grid.cellMeters);
	const reach = Math.max(1, Math.ceil(maximumMeters / grid.cellMeters));

	let bestIndex = -1;
	let bestDistanceSquared = maximumMeters * maximumMeters;

	for (let row = centerRow - reach; row <= centerRow + reach; row += 1) {
		if (row < 0 || row >= grid.rowCount) continue;
		for (let column = centerColumn - reach; column <= centerColumn + reach; column += 1) {
			if (column < 0 || column >= grid.columnCount) continue;
			const cell = row * grid.columnCount + column;
			for (let slot = grid.cellStart[cell]; slot < grid.cellStart[cell + 1]; slot += 1) {
				const candidate = grid.cellItems[slot];
				const deltaEasting =
					(buildings.lon[candidate] - grid.originLon) * grid.metersPerDegreeLon - eastingMeters;
				const deltaNorthing =
					(buildings.lat[candidate] - grid.originLat) * grid.metersPerDegreeLat - northingMeters;
				const distanceSquared = deltaEasting * deltaEasting + deltaNorthing * deltaNorthing;
				if (distanceSquared < bestDistanceSquared) {
					bestDistanceSquared = distanceSquared;
					bestIndex = candidate;
				}
			}
		}
	}

	return bestIndex;
}

export function collectBuildingsWithin(
	grid: SpatialGrid,
	buildings: BuildingTable,
	longitude: number,
	latitude: number,
	radiusMeters: number
): number[] {
	const eastingMeters = (longitude - grid.originLon) * grid.metersPerDegreeLon;
	const northingMeters = (latitude - grid.originLat) * grid.metersPerDegreeLat;
	const centerColumn = Math.floor(eastingMeters / grid.cellMeters);
	const centerRow = Math.floor(northingMeters / grid.cellMeters);
	const reach = Math.max(1, Math.ceil(radiusMeters / grid.cellMeters));
	const radiusSquared = radiusMeters * radiusMeters;
	const found: number[] = [];

	for (let row = centerRow - reach; row <= centerRow + reach; row += 1) {
		if (row < 0 || row >= grid.rowCount) continue;
		for (let column = centerColumn - reach; column <= centerColumn + reach; column += 1) {
			if (column < 0 || column >= grid.columnCount) continue;
			const cell = row * grid.columnCount + column;
			for (let slot = grid.cellStart[cell]; slot < grid.cellStart[cell + 1]; slot += 1) {
				const candidate = grid.cellItems[slot];
				const deltaEasting =
					(buildings.lon[candidate] - grid.originLon) * grid.metersPerDegreeLon - eastingMeters;
				const deltaNorthing =
					(buildings.lat[candidate] - grid.originLat) * grid.metersPerDegreeLat - northingMeters;
				if (deltaEasting * deltaEasting + deltaNorthing * deltaNorthing <= radiusSquared) {
					found.push(candidate);
				}
			}
		}
	}

	return found;
}
