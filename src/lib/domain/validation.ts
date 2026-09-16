import { z } from 'zod';
import rawOsmWidthCheck from './osm-width-check.json';

export interface SyntheticWidthCheck {
	trueWidthMeters: number;
	measuredWidthMeters: number;
}

export interface FieldMeasurement {
	label: string;
	tapeWidthMeters: number;
	pipelineWidthMeters: number;
	measuredOn: string;
	note: string;
}

export const SYNTHETIC_BUILDING_COUNT = 54;
export const SYNTHETIC_SEGMENT_COUNT = 27;
export const SYNTHETIC_TOTAL_LENGTH_METERS = 417.2;
export const SYNTHETIC_RASTER_RESOLUTION_METERS = 0.25;

export const SYNTHETIC_WIDTH_CHECKS: SyntheticWidthCheck[] = [
	{ trueWidthMeters: 1.5, measuredWidthMeters: 1.5 },
	{ trueWidthMeters: 2, measuredWidthMeters: 2 },
	{ trueWidthMeters: 2.5, measuredWidthMeters: 2.5 },
	{ trueWidthMeters: 3, measuredWidthMeters: 3 },
	{ trueWidthMeters: 6, measuredWidthMeters: 6 }
];

export const FIELD_MEASUREMENT_TARGET_COUNT = 10;
export const FIELD_MEASUREMENT_TOLERANCE_METERS = 0.5;

export const FIELD_MEASUREMENTS: FieldMeasurement[] = [];

export function measureAbsoluteError(check: SyntheticWidthCheck): number {
	return Math.abs(check.measuredWidthMeters - check.trueWidthMeters);
}

export function measureFieldError(measurement: FieldMeasurement): number {
	return Math.abs(measurement.pipelineWidthMeters - measurement.tapeWidthMeters);
}

export function countFieldMeasurementsWithinTolerance(
	measurements: FieldMeasurement[]
): number {
	return measurements.filter(
		(measurement) => measureFieldError(measurement) <= FIELD_MEASUREMENT_TOLERANCE_METERS
	).length;
}

export function findLargestSyntheticError(checks: SyntheticWidthCheck[]): number {
	return checks.reduce((largest, check) => Math.max(largest, measureAbsoluteError(check)), 0);
}

const osmWidthSummarySchema = z.object({
	maxDistanceMeters: z.number(),
	minConsistency: z.number(),
	matchedWayCount: z.number().int().min(1),
	medianDifferenceMeters: z.number(),
	lowerQuartileDifferenceMeters: z.number(),
	upperQuartileDifferenceMeters: z.number(),
	pipelineWiderShare: z.number().min(0).max(1),
	withinHalfMeterCount: z.number().int().min(0),
	withinOneMeterCount: z.number().int().min(0)
});

const osmWidthCheckSchema = z.object({
	villageName: z.string(),
	checkedAt: z.string(),
	taggedWayCount: z.number().int().min(0),
	sampleSpacingMeters: z.number(),
	primary: osmWidthSummarySchema,
	sensitivityConfigurationCount: z.number().int().min(1),
	sensitivityMedianRangeMeters: z.tuple([z.number(), z.number()]),
	sensitivityWiderShareRange: z.tuple([z.number(), z.number()])
});

export type OsmWidthCheck = z.infer<typeof osmWidthCheckSchema>;

export const OSM_WIDTH_CHECK: OsmWidthCheck = osmWidthCheckSchema.parse(rawOsmWidthCheck);

export function roundShareToTenths(share: number): number {
	return Math.round(share * 10);
}
