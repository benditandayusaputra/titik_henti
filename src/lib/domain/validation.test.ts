import { describe, expect, it } from 'vitest';
import {
	FIELD_MEASUREMENT_TOLERANCE_METERS,
	SYNTHETIC_WIDTH_CHECKS,
	countFieldMeasurementsWithinTolerance,
	findLargestSyntheticError,
	measureAbsoluteError,
	measureFieldError,
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
