import { ACCESS_CLASS_BY_CODE } from '$lib/domain/constants';
import type {
	AccessClass,
	AlleyNetwork,
	BuildingTable,
	LonLat,
	SegmentSummary,
	WaterArrivalField,
	WidthSource
} from '$lib/domain/types';

export interface SegmentRow extends SegmentSummary {
	midpoint: LonLat;
}

export interface BuildingRow {
	buildingIndex: number;
	position: LonLat;
	areaSquareMeters: number;
	waterArrivalSeconds: number;
	reachable: boolean;
}

interface SegmentAccumulator {
	lengthMeters: number;
	minWidthMeters: number;
	weightedMeanWidth: number;
	edgeCount: number;
	namedRoad: boolean;
	highestClassCode: number;
	lonSum: number;
	latSum: number;
}

export function collectSegmentRows(
	network: AlleyNetwork,
	correctedSegmentIds: ReadonlySet<number>
): SegmentRow[] {
	const accumulators = new Map<number, SegmentAccumulator>();

	for (let edge = 0; edge < network.edgeCount; edge += 1) {
		const segmentId = network.edgeSegmentId[edge];
		const edgeLength = network.edgeLengthMeters[edge];
		const from = network.edgeFrom[edge];
		const to = network.edgeTo[edge];
		let accumulator = accumulators.get(segmentId);
		if (!accumulator) {
			accumulator = {
				lengthMeters: 0,
				minWidthMeters: Infinity,
				weightedMeanWidth: 0,
				edgeCount: 0,
				namedRoad: false,
				highestClassCode: 0,
				lonSum: 0,
				latSum: 0
			};
			accumulators.set(segmentId, accumulator);
		}
		accumulator.lengthMeters += edgeLength;
		accumulator.weightedMeanWidth += network.edgeMeanWidthMeters[edge] * edgeLength;
		accumulator.minWidthMeters = Math.min(
			accumulator.minWidthMeters,
			network.edgeMinWidthMeters[edge]
		);
		accumulator.edgeCount += 1;
		if (network.edgeIsNamedRoad[edge] === 1) accumulator.namedRoad = true;
		accumulator.highestClassCode = Math.max(
			accumulator.highestClassCode,
			network.edgeAccessClass[edge]
		);
		accumulator.lonSum += (network.nodeLon[from] + network.nodeLon[to]) / 2;
		accumulator.latSum += (network.nodeLat[from] + network.nodeLat[to]) / 2;
	}

	const rows: SegmentRow[] = [];
	for (const [segmentId, accumulator] of accumulators) {
		const widthSource: WidthSource = correctedSegmentIds.has(segmentId) ? 'field' : 'satellite';
		rows.push({
			segmentId,
			accessClass: ACCESS_CLASS_BY_CODE[accumulator.highestClassCode],
			minWidthMeters: accumulator.minWidthMeters,
			meanWidthMeters:
				accumulator.lengthMeters > 0
					? accumulator.weightedMeanWidth / accumulator.lengthMeters
					: accumulator.minWidthMeters,
			lengthMeters: accumulator.lengthMeters,
			edgeCount: accumulator.edgeCount,
			isNamedRoad: accumulator.namedRoad,
			widthSource,
			midpoint: {
				lon: accumulator.lonSum / accumulator.edgeCount,
				lat: accumulator.latSum / accumulator.edgeCount
			}
		});
	}
	return rows;
}

export function filterSegmentRows(
	rows: SegmentRow[],
	accessClass: AccessClass | 'semua',
	limit: number
): SegmentRow[] {
	const matching =
		accessClass === 'semua' ? rows : rows.filter((row) => row.accessClass === accessClass);
	return [...matching].sort((first, second) => second.lengthMeters - first.lengthMeters).slice(0, limit);
}

export function collectBuildingRows(
	buildings: BuildingTable,
	waterArrival: WaterArrivalField | null,
	limit: number
): BuildingRow[] {
	const rows: BuildingRow[] = [];
	for (let index = 0; index < buildings.count; index += 1) {
		const seconds = waterArrival ? waterArrival.secondsPerBuilding[index] : Infinity;
		rows.push({
			buildingIndex: index,
			position: { lon: buildings.lon[index], lat: buildings.lat[index] },
			areaSquareMeters: buildings.areaSquareMeters[index],
			waterArrivalSeconds: seconds,
			reachable: Number.isFinite(seconds)
		});
	}
	rows.sort((first, second) => {
		if (first.reachable !== second.reachable) return first.reachable ? 1 : -1;
		return second.waterArrivalSeconds - first.waterArrivalSeconds;
	});
	return rows.slice(0, limit);
}
