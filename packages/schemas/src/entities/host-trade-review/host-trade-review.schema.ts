import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { HostTradeIdSchema, UserIdSchema } from '../../common/id.schema.js';
import { LifecycleStatusEnumSchema } from '../../enums/lifecycle-state.schema.js';
import { ModerationStatusEnumSchema } from '../../enums/moderation-status.schema.js';
import {
    HOST_TRADE_REVIEW_CONTENT_MAX,
    HOST_TRADE_REVIEW_CONTENT_MIN,
    HOST_TRADE_REVIEW_RATING_MAX,
    HOST_TRADE_REVIEW_RATING_MIN
} from '../host-trade/host-trade-usage.constants.js';

/** A single 1-5 star value. Integer because the input is whole stars. */
const StarRatingSchema = z
    .number()
    .int({ message: 'zodError.hostTradeReview.rating.int' })
    .min(HOST_TRADE_REVIEW_RATING_MIN, { message: 'zodError.hostTradeReview.rating.min' })
    .max(HOST_TRADE_REVIEW_RATING_MAX, { message: 'zodError.hostTradeReview.rating.max' });

/**
 * The optional three-dimension breakdown (spec §6.3).
 *
 * Every dimension is optional and the whole object is nullable: a host who
 * only wants to leave a single star rating must not be forced through three
 * more decisions to do it.
 */
export const HostTradeReviewRatingBreakdownSchema = z.object({
    /** How well the job itself was done. */
    workQuality: StarRatingSchema.optional(),
    /** Whether they showed up when they said they would. */
    punctuality: StarRatingSchema.optional(),
    /** How the host was treated. */
    treatment: StarRatingSchema.optional()
});

/** Inferred type for {@link HostTradeReviewRatingBreakdownSchema}. */
export type HostTradeReviewRatingBreakdown = z.infer<typeof HostTradeReviewRatingBreakdownSchema>;

/** Free-text body of a review. Bounded on both ends when present. */
export const HostTradeReviewContentSchema = z
    .string()
    .min(HOST_TRADE_REVIEW_CONTENT_MIN, { message: 'zodError.hostTradeReview.content.min' })
    .max(HOST_TRADE_REVIEW_CONTENT_MAX, { message: 'zodError.hostTradeReview.content.max' });

/**
 * HostTradeReviewSchema — a host's public review of a provider (HOS-376 §6.3).
 *
 * There is deliberately NO title. A title on a short trade review is either a
 * restatement of the stars or a headline the writer did not intend to publish;
 * the newest review tables in the repo dropped it for the same reason.
 */
export const HostTradeReviewSchema = z.object({
    /** Unique identifier for this review (UUID v4). */
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    /** The provider being reviewed. */
    hostTradeId: HostTradeIdSchema,

    /** The host writing it. UNIQUE with `hostTradeId` — one client, one voice. */
    hostUserId: UserIdSchema,

    /** Mandatory 1-5 overall rating. */
    overallRating: StarRatingSchema,

    /** Optional per-dimension breakdown. Null when the host skipped it. */
    rating: HostTradeReviewRatingBreakdownSchema.nullish(),

    /** Mean of the supplied breakdown dimensions. Null when there is no breakdown. */
    averageRating: z.number().nullish(),

    /**
     * Whether the provider honoured the benefit.
     *
     * A boolean rather than a fourth star dimension, on purpose: a provider is
     * listed *because* of the benefit, so "excellent work, ignored the discount"
     * is precisely the failure this system exists to expose. Averaged into a
     * star score it would disappear.
     */
    respectedBenefit: z.boolean(),

    /** Optional free text. */
    content: HostTradeReviewContentSchema.nullish(),

    /** Paired with the other four review tables in the repo. */
    lifecycleState: LifecycleStatusEnumSchema,

    /**
     * Moderation state. Born `APPROVED` (spec §6.4) unless `moderateText()`
     * forces `PENDING`, and never user-settable — see the crud schemas.
     */
    moderationState: ModerationStatusEnumSchema,
    /** Admin who moderated it. */
    moderatedById: UserIdSchema.nullish(),
    /** When it was moderated. */
    moderatedAt: z.coerce.date().nullish(),
    /** Why, when a moderator recorded a reason. */
    moderationReason: z.string().nullish(),

    /**
     * When the host last edited it.
     *
     * Load-bearing beyond audit: an edit re-runs moderation and marks any
     * existing provider reply `reviewEditedAfterReply` (AC-22), so the
     * directory can say the reply answers an earlier version of the text.
     */
    editedAt: z.coerce.date().nullish(),

    // Shared audit + soft-delete fields
    ...BaseAuditFields
});

/** Inferred TypeScript type for a full host-trade review. */
export type HostTradeReview = z.infer<typeof HostTradeReviewSchema>;
