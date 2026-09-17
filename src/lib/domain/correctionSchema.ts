import { z } from '$lib/domain/zod';
import {
	CORRECTION_MAX_WIDTH_METERS,
	CORRECTION_MIN_WIDTH_METERS,
	CORRECTION_SENTENCE_MAX_LENGTH,
	CORRECTION_SENTENCE_MIN_LENGTH
} from '$lib/domain/constants';

export const accessClassSchema = z.enum(['largeUnit', 'smallUnit', 'hoseOnly']);

export const segmentContextSchema = z.object({
	segmentId: z.number().int().min(0),
	accessClass: accessClassSchema,
	minWidthMeters: z.number().min(0),
	meanWidthMeters: z.number().min(0),
	lengthMeters: z.number().min(0)
});

export const correctionRequestSchema = z.object({
	sentence: z.string().trim().min(CORRECTION_SENTENCE_MIN_LENGTH).max(CORRECTION_SENTENCE_MAX_LENGTH),
	segment: segmentContextSchema
});

export const correctionProposalSchema = z.object({
	segmentId: z.number().int().min(0),
	proposedWidthMeters: z.number().min(CORRECTION_MIN_WIDTH_METERS).max(CORRECTION_MAX_WIDTH_METERS),
	reason: z.string().min(1).max(280),
	confidence: z.number().min(0).max(1)
});

export type CorrectionRequestBody = z.infer<typeof correctionRequestSchema>;

export function isProposalForSegment(
	proposal: { segmentId: number },
	expectedSegmentId: number
): boolean {
	return proposal.segmentId === expectedSegmentId;
}

export const correctionResponseSchema = z.discriminatedUnion('ok', [
	z.object({ ok: z.literal(true), proposal: correctionProposalSchema }),
	z.object({ ok: z.literal(false), message: z.string().min(1) })
]);
