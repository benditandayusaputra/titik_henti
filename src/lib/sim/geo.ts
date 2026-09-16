import { EARTH_RADIUS_METERS } from '$lib/domain/constants';
import type { LonLat } from '$lib/domain/types';

const DEGREES_TO_RADIANS = Math.PI / 180;
const RADIANS_TO_DEGREES = 180 / Math.PI;
const FULL_TURN_DEGREES = 360;
const HALF_TURN_DEGREES = 180;

export function metersBetween(from: LonLat, to: LonLat): number {
	const meanLatitudeRadians = ((from.lat + to.lat) / 2) * DEGREES_TO_RADIANS;
	const eastingDelta =
		(to.lon - from.lon) * DEGREES_TO_RADIANS * Math.cos(meanLatitudeRadians) * EARTH_RADIUS_METERS;
	const northingDelta = (to.lat - from.lat) * DEGREES_TO_RADIANS * EARTH_RADIUS_METERS;
	return Math.hypot(eastingDelta, northingDelta);
}

export function bearingDegrees(from: LonLat, to: LonLat): number {
	const meanLatitudeRadians = ((from.lat + to.lat) / 2) * DEGREES_TO_RADIANS;
	const eastingDelta = (to.lon - from.lon) * Math.cos(meanLatitudeRadians);
	const northingDelta = to.lat - from.lat;
	const bearing = Math.atan2(eastingDelta, northingDelta) * RADIANS_TO_DEGREES;
	return (bearing + FULL_TURN_DEGREES) % FULL_TURN_DEGREES;
}

export function angleDifferenceDegrees(first: number, second: number): number {
	const raw = Math.abs(((first - second) % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) % FULL_TURN_DEGREES;
	return raw > HALF_TURN_DEGREES ? FULL_TURN_DEGREES - raw : raw;
}

export function measurePathMeters(path: LonLat[]): number {
	let total = 0;
	for (let index = 1; index < path.length; index += 1) {
		total += metersBetween(path[index - 1], path[index]);
	}
	return total;
}

export function interpolateAlongPath(path: LonLat[], travelledMeters: number): LonLat {
	if (path.length === 0) return { lon: 0, lat: 0 };
	if (travelledMeters <= 0) return path[0];
	let remaining = travelledMeters;
	for (let index = 1; index < path.length; index += 1) {
		const span = metersBetween(path[index - 1], path[index]);
		if (remaining <= span) {
			const ratio = span === 0 ? 0 : remaining / span;
			return {
				lon: path[index - 1].lon + (path[index].lon - path[index - 1].lon) * ratio,
				lat: path[index - 1].lat + (path[index].lat - path[index - 1].lat) * ratio
			};
		}
		remaining -= span;
	}
	return path[path.length - 1];
}

export function clipPathToLength(path: LonLat[], limitMeters: number): LonLat[] {
	if (path.length === 0) return [];
	const clipped: LonLat[] = [path[0]];
	let travelled = 0;
	for (let index = 1; index < path.length; index += 1) {
		const span = metersBetween(path[index - 1], path[index]);
		if (travelled + span >= limitMeters) {
			const ratio = span === 0 ? 0 : (limitMeters - travelled) / span;
			clipped.push({
				lon: path[index - 1].lon + (path[index].lon - path[index - 1].lon) * ratio,
				lat: path[index - 1].lat + (path[index].lat - path[index - 1].lat) * ratio
			});
			return clipped;
		}
		clipped.push(path[index]);
		travelled += span;
	}
	return clipped;
}
