import { describe, expect, it } from 'vitest';
import { latitudeAfterMeters, longitudeAfterMeters } from '$lib/sim/fixtures';
import {
	angleDifferenceDegrees,
	bearingDegrees,
	clipPathToLength,
	interpolateAlongPath,
	measurePathMeters,
	metersBetween
} from '$lib/sim/geo';

const ORIGIN = { lon: longitudeAfterMeters(0), lat: latitudeAfterMeters(0) };
const NORTH_100 = { lon: longitudeAfterMeters(0), lat: latitudeAfterMeters(100) };
const NORTH_EAST = { lon: longitudeAfterMeters(100), lat: latitudeAfterMeters(100) };

describe('geo', () => {
	it('mengukur jarak meter antara dua titik', () => {
		expect(metersBetween(ORIGIN, NORTH_100)).toBeCloseTo(100, 0);
		expect(metersBetween(ORIGIN, ORIGIN)).toBe(0);
	});

	it('menghitung arah mata angin dari utara searah jarum jam', () => {
		expect(bearingDegrees(ORIGIN, NORTH_100)).toBeCloseTo(0, 1);
		expect(bearingDegrees(NORTH_100, NORTH_EAST)).toBeCloseTo(90, 0);
		expect(bearingDegrees(NORTH_100, ORIGIN)).toBeCloseTo(180, 1);
	});

	it('selisih sudut selalu jalur terpendek di antara 0 dan 180', () => {
		expect(angleDifferenceDegrees(350, 10)).toBe(20);
		expect(angleDifferenceDegrees(10, 350)).toBe(20);
		expect(angleDifferenceDegrees(0, 180)).toBe(180);
		expect(angleDifferenceDegrees(-90, 90)).toBe(180);
	});

	it('panjang lintasan adalah jumlah panjang tiap ruas', () => {
		expect(measurePathMeters([ORIGIN, NORTH_100, NORTH_EAST])).toBeCloseTo(200, 0);
		expect(measurePathMeters([ORIGIN])).toBe(0);
	});

	it('titik di tengah perjalanan jatuh di ruas yang benar', () => {
		const path = [ORIGIN, NORTH_100, NORTH_EAST];
		const halfway = interpolateAlongPath(path, 150);
		expect(metersBetween(halfway, NORTH_100)).toBeCloseTo(50, 0);
		expect(interpolateAlongPath(path, -5)).toEqual(ORIGIN);
		expect(interpolateAlongPath(path, 999)).toEqual(NORTH_EAST);
		expect(interpolateAlongPath([], 10)).toEqual({ lon: 0, lat: 0 });
	});

	it('memotong lintasan tepat di panjang batas', () => {
		const clipped = clipPathToLength([ORIGIN, NORTH_100, NORTH_EAST], 130);
		expect(clipped).toHaveLength(3);
		expect(measurePathMeters(clipped)).toBeCloseTo(130, 0);
		expect(clipPathToLength([ORIGIN, NORTH_100], 500)).toEqual([ORIGIN, NORTH_100]);
		expect(clipPathToLength([], 10)).toEqual([]);
	});
});
