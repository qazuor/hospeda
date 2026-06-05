import { z } from 'zod';
import { ModerationStatusEnum } from '../enums/index.js';
import { ModerationStatusEnumSchema } from '../enums/index.js';

/**
 * Input schema for review moderation actions (approve / reject).
 *
 * Used by:
 * - `POST /api/v1/admin/accommodation-reviews/:id/moderate`
 * - `POST /api/v1/admin/destination-reviews/:id/moderate`
 *
 * `decision` must be `APPROVED` or `REJECTED` (`PENDING` is the initial state
 * set by the service and cannot be chosen as a moderation outcome).
 * `reason` is optional but expected for `REJECTED` decisions by convention.
 */
export const ReviewModerateInputSchema = z.object({
    /** Moderation decision: APPROVED or REJECTED. */
    decision: z.enum(
        [ModerationStatusEnum.APPROVED, ModerationStatusEnum.REJECTED] as [
            ModerationStatusEnum.APPROVED,
            ModerationStatusEnum.REJECTED
        ],
        { error: () => ({ message: 'zodError.review.moderate.decision.invalid' }) }
    ),
    /** Free-text reason for the decision (required for REJECTED by convention). */
    reason: z.string().max(1000).optional()
});

export type ReviewModerateInput = z.infer<typeof ReviewModerateInputSchema>;

/**
 * Response schema for review moderation endpoints.
 *
 * Returns a structured pending count broken down by review type:
 * - `accommodationReviews`: count from accommodation_reviews table
 * - `destinationReviews`: count from destination_reviews table
 *
 * Used by `GET /api/v1/admin/reviews/pending-count`.
 */
export const ReviewPendingCountSchema = z.object({
    count: z.number().int().min(0),
    byType: z.object({
        accommodationReviews: z.number().int().min(0),
        destinationReviews: z.number().int().min(0)
    })
});
export type ReviewPendingCount = z.infer<typeof ReviewPendingCountSchema>;

/**
 * Base moderation fields
 */
export const BaseModerationFields = {
    moderationState: ModerationStatusEnumSchema.default(ModerationStatusEnum.PENDING)
} as const;

/**
 * Moderation Schema - Complete moderation information
 * Can be used as a standalone schema when needed
 */
export const ModerationSchema = z.object({
    ...BaseModerationFields
});
export type Moderation = z.infer<typeof ModerationSchema>;

/**
 * Response schema for `GET /api/v1/admin/moderation/pending-count`.
 *
 * Returns the count of content items in PENDING moderation state across
 * the four main content entities: accommodations, destinations, posts, and events.
 *
 * - `byEntity`: per-entity breakdown of PENDING items.
 * - `total`: sum of all four entity counts.
 */
export const ModerationPendingCountSchema = z.object({
    total: z.number().int().min(0),
    byEntity: z.object({
        accommodations: z.number().int().min(0),
        destinations: z.number().int().min(0),
        posts: z.number().int().min(0),
        events: z.number().int().min(0)
    })
});
export type ModerationPendingCount = z.infer<typeof ModerationPendingCountSchema>;
