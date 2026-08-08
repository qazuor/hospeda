import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { IdSchema, UserIdSchema } from '../../common/id.schema.js';
import { ModerationStatusEnumSchema } from '../../enums/moderation-status.schema.js';
import {
    HOST_TRADE_REVIEW_REPLY_MAX,
    HOST_TRADE_REVIEW_REPLY_MIN
} from '../host-trade/host-trade-usage.constants.js';

/**
 * Body of a provider's reply. Required, and bounded on both ends.
 *
 * The ceiling is half the review's: the reply is a right of response, not a
 * platform for a counter-argument longer than the complaint it answers.
 */
export const HostTradeReviewReplyContentSchema = z
    .string()
    .min(HOST_TRADE_REVIEW_REPLY_MIN, { message: 'zodError.hostTradeReviewReply.content.min' })
    .max(HOST_TRADE_REVIEW_REPLY_MAX, { message: 'zodError.hostTradeReviewReply.content.max' });

/**
 * HostTradeReviewReplySchema — the provider's answer to a host's review
 * (HOS-376 §6.4).
 *
 * One reply per review, never a thread: the UNIQUE index on `reviewId` is the
 * enforcement, and the shape has no parent/child pointer that would suggest
 * otherwise. A directory entry is not a forum, and a thread turns a right of
 * response into a public argument between two people who have to keep working
 * in the same town.
 */
export const HostTradeReviewReplySchema = z.object({
    /** Unique identifier for this reply (UUID v4). */
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    /** The review being answered. UNIQUE — one reply, not a thread. */
    reviewId: IdSchema,

    /** The provider's `ownerUserId` AT THE TIME OF WRITING, frozen deliberately. */
    authorUserId: UserIdSchema,

    /** The reply itself. */
    content: HostTradeReviewReplyContentSchema,

    /**
     * Moderation state. Born `PENDING` (spec §6.4) — the opposite default from
     * the review it answers.
     *
     * The asymmetry is the point: this is written by someone with a wounded
     * commercial interest who was physically at the host's address, so "la
     * señora de Alberdi 300 me hizo ir tres veces" is a doxxing vector the
     * review does not carry. Reply volume is a fraction of review volume, so
     * gating it does not choke the funnel.
     *
     * Never user-settable — see the crud schemas.
     */
    moderationState: ModerationStatusEnumSchema,
    /** Admin who moderated it. */
    moderatedById: UserIdSchema.nullish(),
    /** When it was moderated. */
    moderatedAt: z.coerce.date().nullish(),
    /** Why, when a moderator recorded a reason. */
    moderationReason: z.string().nullish(),

    /**
     * Set when the host edits their review AFTER this reply exists (AC-22).
     *
     * The reply is CONSERVED and marked, not cleared: deleting the provider's
     * words because the other party changed theirs would be the worse outcome.
     * The directory renders a banner instead, and the provider can rewrite.
     */
    reviewEditedAfterReply: z.boolean(),

    // Shared audit + soft-delete fields
    ...BaseAuditFields
});

/** Inferred TypeScript type for a full host-trade review reply. */
export type HostTradeReviewReply = z.infer<typeof HostTradeReviewReplySchema>;
