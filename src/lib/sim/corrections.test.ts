import { describe, expect, it } from 'vitest';
import { ACCESS_CLASS_CODE } from '$lib/domain/constants';
import { correctionProposalSchema, correctionRequestSchema } from '$lib/domain/correctionSchema';
import { applyWidthCorrections, classifyWidth, summariseSegment } from '$lib/sim/corrections';
import type { AlleyNetwork } from '$lib/domain/types';

function buildNetwork(): AlleyNetwork {
	return {
		nodeCount: 3,
		nodeLon: Float64Array.from([106.78, 106.781, 106.782]),
		nodeLat: Float64Array.from([-6.15, -6.1501, -6.1502]),
		adjacencyOffsets: Int32Array.from([0, 1, 3, 4]),
		adjacencyTargets: Int32Array.from([1, 0, 2, 1]),
		adjacencyEdgeIds: Int32Array.from([0, 0, 1, 1]),
		edgeFrom: Int32Array.from([0, 1]),
		edgeTo: Int32Array.from([1, 2]),
		edgeLengthMeters: Float32Array.from([30, 10]),
		edgeAccessClass: Uint8Array.from([ACCESS_CLASS_CODE.largeUnit, ACCESS_CLASS_CODE.largeUnit]),
		edgeSegmentId: Int32Array.from([7, 7]),
		edgeMinWidthMeters: Float32Array.from([4.5, 5]),
		edgeMeanWidthMeters: Float32Array.from([6, 6]),
		edgeIsNamedRoad: Uint8Array.from([1, 0]),
		edgeCount: 2
	};
}

describe('classifyWidth', () => {
	it('memakai ambang kelas yang sama dengan pipeline', () => {
		expect(classifyWidth(4.5)).toBe('largeUnit');
		expect(classifyWidth(4)).toBe('largeUnit');
		expect(classifyWidth(3.2)).toBe('smallUnit');
		expect(classifyWidth(2.5)).toBe('smallUnit');
		expect(classifyWidth(1.9)).toBe('hoseOnly');
	});
});

describe('applyWidthCorrections', () => {
	it('mengembalikan jaringan yang sama saat tidak ada koreksi', () => {
		const network = buildNetwork();
		expect(applyWidthCorrections(network, new Map())).toBe(network);
	});

	it('menurunkan kelas akses seluruh ruas pada segmen yang dikoreksi', () => {
		const network = buildNetwork();
		const corrected = applyWidthCorrections(network, new Map([[7, 2]]));

		expect(Array.from(corrected.edgeMinWidthMeters)).toEqual([2, 2]);
		expect(Array.from(corrected.edgeAccessClass)).toEqual([
			ACCESS_CLASS_CODE.hoseOnly,
			ACCESS_CLASS_CODE.hoseOnly
		]);
	});

	it('tidak mengubah jaringan asal', () => {
		const network = buildNetwork();
		applyWidthCorrections(network, new Map([[7, 2]]));
		expect(Array.from(network.edgeMinWidthMeters)).toEqual([4.5, 5]);
		expect(Array.from(network.edgeAccessClass)).toEqual([
			ACCESS_CLASS_CODE.largeUnit,
			ACCESS_CLASS_CODE.largeUnit
		]);
	});

	it('menjaga lebar rata rata tidak pernah di bawah lebar minimum', () => {
		const network = buildNetwork();
		const corrected = applyWidthCorrections(network, new Map([[7, 9]]));
		for (let edge = 0; edge < corrected.edgeCount; edge += 1) {
			expect(corrected.edgeMeanWidthMeters[edge]).toBeGreaterThanOrEqual(
				corrected.edgeMinWidthMeters[edge]
			);
		}
	});
});

describe('summariseSegment', () => {
	it('menggabungkan seluruh ruas segmen jadi satu ringkasan', () => {
		const summary = summariseSegment(buildNetwork(), 7, 'satellite');
		expect(summary).not.toBeNull();
		expect(summary?.lengthMeters).toBeCloseTo(40, 5);
		expect(summary?.minWidthMeters).toBeCloseTo(4.5, 5);
		expect(summary?.edgeCount).toBe(2);
		expect(summary?.isNamedRoad).toBe(true);
		expect(summary?.widthSource).toBe('satellite');
	});

	it('mengembalikan null untuk segmen yang tidak ada', () => {
		expect(summariseSegment(buildNetwork(), 99, 'satellite')).toBeNull();
	});
});

describe('skema koreksi', () => {
	it('menolak usulan dengan lebar di luar batas', () => {
		const result = correctionProposalSchema.safeParse({
			segmentId: 7,
			proposedWidthMeters: 120,
			reason: 'kalimat menyebut lebar sangat besar',
			confidence: 0.9
		});
		expect(result.success).toBe(false);
	});

	it('menolak usulan tanpa tingkat keyakinan', () => {
		const result = correctionProposalSchema.safeParse({
			segmentId: 7,
			proposedWidthMeters: 2,
			reason: 'ada warung permanen di ujung gang'
		});
		expect(result.success).toBe(false);
	});

	it('menerima usulan yang sesuai skema', () => {
		const result = correctionProposalSchema.safeParse({
			segmentId: 7,
			proposedWidthMeters: 2,
			reason: 'ada warung permanen di ujung gang',
			confidence: 0.82
		});
		expect(result.success).toBe(true);
	});

	it('menolak permintaan dengan kalimat terlalu pendek', () => {
		const result = correctionRequestSchema.safeParse({
			sentence: 'sempit',
			segment: {
				segmentId: 7,
				accessClass: 'largeUnit',
				minWidthMeters: 4.5,
				meanWidthMeters: 6,
				lengthMeters: 40
			}
		});
		expect(result.success).toBe(false);
	});
});
