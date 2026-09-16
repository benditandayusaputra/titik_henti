import {
	ACCESS_CLASS_BY_CODE,
	ACCESS_CLASS_CODE,
	LARGE_UNIT_MIN_WIDTH_METERS,
	SMALL_UNIT_MIN_WIDTH_METERS
} from '$lib/domain/constants';
import type { AccessClass, AlleyNetwork, SegmentSummary, WidthSource } from '$lib/domain/types';

export function classifyWidth(minWidthMeters: number): AccessClass {
	if (minWidthMeters >= LARGE_UNIT_MIN_WIDTH_METERS) return 'largeUnit';
	if (minWidthMeters >= SMALL_UNIT_MIN_WIDTH_METERS) return 'smallUnit';
	return 'hoseOnly';
}

export function applyWidthCorrections(
	network: AlleyNetwork,
	widthBySegmentId: Map<number, number>
): AlleyNetwork {
	if (widthBySegmentId.size === 0) return network;

	const correctedMinWidth = Float32Array.from(network.edgeMinWidthMeters);
	const correctedMeanWidth = Float32Array.from(network.edgeMeanWidthMeters);
	const correctedAccessClass = Uint8Array.from(network.edgeAccessClass);

	for (let edge = 0; edge < network.edgeCount; edge += 1) {
		const corrected = widthBySegmentId.get(network.edgeSegmentId[edge]);
		if (corrected === undefined) continue;
		correctedMinWidth[edge] = corrected;
		correctedMeanWidth[edge] = Math.max(corrected, network.edgeMeanWidthMeters[edge]);
		correctedAccessClass[edge] = ACCESS_CLASS_CODE[classifyWidth(corrected)];
	}

	return {
		...network,
		edgeMinWidthMeters: correctedMinWidth,
		edgeMeanWidthMeters: correctedMeanWidth,
		edgeAccessClass: correctedAccessClass
	};
}

export function summariseSegment(
	network: AlleyNetwork,
	segmentId: number,
	widthSource: WidthSource
): SegmentSummary | null {
	let edgeCount = 0;
	let lengthMeters = 0;
	let minWidthMeters = Infinity;
	let weightedMeanWidth = 0;
	let namedRoad = false;
	let highestClassCode = 0;

	for (let edge = 0; edge < network.edgeCount; edge += 1) {
		if (network.edgeSegmentId[edge] !== segmentId) continue;
		edgeCount += 1;
		const edgeLength = network.edgeLengthMeters[edge];
		lengthMeters += edgeLength;
		weightedMeanWidth += network.edgeMeanWidthMeters[edge] * edgeLength;
		minWidthMeters = Math.min(minWidthMeters, network.edgeMinWidthMeters[edge]);
		if (network.edgeIsNamedRoad[edge] === 1) namedRoad = true;
		highestClassCode = Math.max(highestClassCode, network.edgeAccessClass[edge]);
	}

	if (edgeCount === 0) return null;

	return {
		segmentId,
		accessClass: ACCESS_CLASS_BY_CODE[highestClassCode],
		minWidthMeters,
		meanWidthMeters: lengthMeters > 0 ? weightedMeanWidth / lengthMeters : minWidthMeters,
		lengthMeters,
		edgeCount,
		isNamedRoad: namedRoad,
		widthSource
	};
}
