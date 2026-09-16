import { describe, expect, it } from 'vitest';
import { ACCESS_CLASS_CODE } from '$lib/domain/constants';
import {
	collectBuildingRows,
	collectSegmentRows,
	filterSegmentRows
} from '$lib/sim/catalogue';
import type { AlleyNetwork, BuildingTable, WaterArrivalField } from '$lib/domain/types';

function buildNetwork(): AlleyNetwork {
	return {
		nodeCount: 4,
		nodeLon: Float64Array.from([106.78, 106.781, 106.782, 106.783]),
		nodeLat: Float64Array.from([-6.2, -6.2, -6.2, -6.2]),
		adjacencyOffsets: Int32Array.from([0, 1, 3, 5, 6]),
		adjacencyTargets: Int32Array.from([1, 0, 2, 1, 3, 2]),
		adjacencyEdgeIds: Int32Array.from([0, 0, 1, 1, 2, 2]),
		edgeFrom: Int32Array.from([0, 1, 2]),
		edgeTo: Int32Array.from([1, 2, 3]),
		edgeLengthMeters: Float32Array.from([30, 10, 80]),
		edgeAccessClass: Uint8Array.from([
			ACCESS_CLASS_CODE.hoseOnly,
			ACCESS_CLASS_CODE.smallUnit,
			ACCESS_CLASS_CODE.largeUnit
		]),
		edgeSegmentId: Int32Array.from([5, 5, 9]),
		edgeMinWidthMeters: Float32Array.from([1.8, 3.2, 6]),
		edgeMeanWidthMeters: Float32Array.from([2, 4, 7]),
		edgeIsNamedRoad: Uint8Array.from([0, 1, 1]),
		edgeCount: 3
	};
}

function buildBuildings(): BuildingTable {
	return {
		count: 4,
		lon: Float64Array.from([106.78, 106.781, 106.782, 106.783]),
		lat: Float64Array.from([-6.2, -6.2, -6.2, -6.2]),
		areaSquareMeters: Float32Array.from([40, 55, 60, 30]),
		heightMeters: Float32Array.from([4, 4, 4, 4]),
		materialClass: Uint8Array.from([1, 1, 1, 1]),
		heightIsMeasured: Uint8Array.from([0, 0, 0, 0]),
		nearestNodeId: Int32Array.from([0, 1, 2, 3]),
		nearestNodeDistanceMeters: Float32Array.from([1, 1, 1, 1])
	};
}

describe('collectSegmentRows', () => {
	it('menggabungkan ruas menjadi satu baris per segmen dalam satu lintasan', () => {
		const rows = collectSegmentRows(buildNetwork(), new Set());
		expect(rows).toHaveLength(2);

		const segmenLima = rows.find((row) => row.segmentId === 5);
		expect(segmenLima?.lengthMeters).toBeCloseTo(40, 5);
		expect(segmenLima?.minWidthMeters).toBeCloseTo(1.8, 5);
		expect(segmenLima?.edgeCount).toBe(2);
		expect(segmenLima?.isNamedRoad).toBe(true);
		expect(segmenLima?.accessClass).toBe('smallUnit');
	});

	it('menandai segmen yang sudah dikoreksi sebagai nilai lapangan', () => {
		const rows = collectSegmentRows(buildNetwork(), new Set([5]));
		expect(rows.find((row) => row.segmentId === 5)?.widthSource).toBe('field');
		expect(rows.find((row) => row.segmentId === 9)?.widthSource).toBe('satellite');
	});

	it('memberi titik tengah di dalam rentang simpul segmennya', () => {
		const rows = collectSegmentRows(buildNetwork(), new Set());
		const segmenSembilan = rows.find((row) => row.segmentId === 9);
		expect(segmenSembilan?.midpoint.lon).toBeGreaterThan(106.782);
		expect(segmenSembilan?.midpoint.lon).toBeLessThan(106.783);
	});
});

describe('filterSegmentRows', () => {
	it('menyaring menurut kelas akses', () => {
		const rows = collectSegmentRows(buildNetwork(), new Set());
		expect(filterSegmentRows(rows, 'largeUnit', 10)).toHaveLength(1);
		expect(filterSegmentRows(rows, 'hoseOnly', 10)).toHaveLength(0);
		expect(filterSegmentRows(rows, 'semua', 10)).toHaveLength(2);
	});

	it('mengurutkan dari segmen terpanjang dan menghormati batas baris', () => {
		const rows = collectSegmentRows(buildNetwork(), new Set());
		const disaring = filterSegmentRows(rows, 'semua', 1);
		expect(disaring).toHaveLength(1);
		expect(disaring[0].segmentId).toBe(9);
	});
});

describe('collectBuildingRows', () => {
	const arrival: WaterArrivalField = {
		secondsPerBuilding: Float32Array.from([120, Infinity, 600, 300]),
		reachableCount: 3,
		meanSecondsReachable: 340,
		worstSecondsReachable: 600
	};

	it('menaruh bangunan tak terjangkau paling atas', () => {
		const rows = collectBuildingRows(buildBuildings(), arrival, 4);
		expect(rows[0].buildingIndex).toBe(1);
		expect(rows[0].reachable).toBe(false);
	});

	it('mengurutkan sisanya dari waktu air sampai terlama', () => {
		const rows = collectBuildingRows(buildBuildings(), arrival, 4);
		expect(rows.slice(1).map((row) => row.buildingIndex)).toEqual([2, 3, 0]);
	});

	it('menghormati batas jumlah baris', () => {
		expect(collectBuildingRows(buildBuildings(), arrival, 2)).toHaveLength(2);
	});

	it('menganggap seluruh bangunan tak terjangkau saat waktu air belum dihitung', () => {
		const rows = collectBuildingRows(buildBuildings(), null, 4);
		expect(rows.every((row) => !row.reachable)).toBe(true);
	});
});
