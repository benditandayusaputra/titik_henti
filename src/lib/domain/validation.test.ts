import { describe, expect, it } from 'vitest';
import {
	FIELD_MEASUREMENT_TOLERANCE_METERS,
	SYNTHETIC_WIDTH_CHECKS,
	countFieldMeasurementsWithinTolerance,
	findLargestSyntheticError,
	measureAbsoluteError,
	measureFieldError,
	OSM_WIDTH_CHECK,
	roundShareToTenths,
	type FieldMeasurement
} from '$lib/domain/validation';

function buildMeasurement(tape: number, pipeline: number): FieldMeasurement {
	return {
		label: `gang ${tape}`,
		tapeWidthMeters: tape,
		pipelineWidthMeters: pipeline,
		measuredOn: '2026-09-16',
		note: ''
	};
}

describe('validasi sintetis', () => {
	it('mencatat kelima lebar uji yang dilaporkan PRD', () => {
		expect(SYNTHETIC_WIDTH_CHECKS.map((check) => check.trueWidthMeters)).toEqual([
			1.5, 2, 2.5, 3, 6
		]);
	});

	it('menghitung selisih mutlak tiap baris', () => {
		expect(measureAbsoluteError({ trueWidthMeters: 2, measuredWidthMeters: 2.4 })).toBeCloseTo(
			0.4,
			5
		);
		expect(measureAbsoluteError({ trueWidthMeters: 3, measuredWidthMeters: 2.6 })).toBeCloseTo(
			0.4,
			5
		);
	});

	it('melaporkan selisih terbesar nol untuk hasil uji yang tersimpan', () => {
		expect(findLargestSyntheticError(SYNTHETIC_WIDTH_CHECKS)).toBe(0);
	});
});

describe('verifikasi lapangan', () => {
	it('menghitung selisih terhadap ukur meteran', () => {
		expect(measureFieldError(buildMeasurement(2, 2.7))).toBeCloseTo(0.7, 5);
	});

	it('menghitung baris yang masih dalam toleransi', () => {
		const measurements = [
			buildMeasurement(2, 2.3),
			buildMeasurement(3, 3.5),
			buildMeasurement(4, 5.1)
		];
		expect(countFieldMeasurementsWithinTolerance(measurements)).toBe(2);
	});

	it('memperlakukan selisih tepat di ambang sebagai lolos', () => {
		const measurements = [buildMeasurement(2, 2 + FIELD_MEASUREMENT_TOLERANCE_METERS)];
		expect(countFieldMeasurementsWithinTolerance(measurements)).toBe(1);
	});

	it('mengembalikan nol saat belum ada pengukuran', () => {
		expect(countFieldMeasurementsWithinTolerance([])).toBe(0);
	});
});

describe('pembanding silang OpenStreetMap', () => {
	it('memuat hasil cek yang lolos skema saat build', () => {
		expect(OSM_WIDTH_CHECK.primary.matchedWayCount).toBeGreaterThan(0);
		expect(OSM_WIDTH_CHECK.taggedWayCount).toBeGreaterThanOrEqual(
			OSM_WIDTH_CHECK.primary.matchedWayCount
		);
	});

	it('menyimpan rentang sensitivitas dengan batas bawah tidak melebihi batas atas', () => {
		const [bawah, atas] = OSM_WIDTH_CHECK.sensitivityMedianRangeMeters;
		expect(bawah).toBeLessThanOrEqual(atas);
		const [pangsaBawah, pangsaAtas] = OSM_WIDTH_CHECK.sensitivityWiderShareRange;
		expect(pangsaBawah).toBeLessThanOrEqual(pangsaAtas);
	});

	it('menempatkan median konfigurasi utama di dalam rentang sensitivitas', () => {
		const [bawah, atas] = OSM_WIDTH_CHECK.sensitivityMedianRangeMeters;
		expect(OSM_WIDTH_CHECK.primary.medianDifferenceMeters).toBeGreaterThanOrEqual(bawah);
		expect(OSM_WIDTH_CHECK.primary.medianDifferenceMeters).toBeLessThanOrEqual(atas);
	});

	it('membulatkan pangsa menjadi jumlah per sepuluh', () => {
		expect(roundShareToTenths(0.899)).toBe(9);
		expect(roundShareToTenths(0.835)).toBe(8);
		expect(roundShareToTenths(0)).toBe(0);
		expect(roundShareToTenths(1)).toBe(10);
	});
});
