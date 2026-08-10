import type { z } from 'zod';
import { HostTradeReviewReplySchema } from './host-trade-review-reply.schema.js';

/**
 * @file host-trade-review-reply.access.schema.ts
 * @description Read tiers for review replies (HOS-376).
 *
 * Two tiers, and the missing one is deliberate: the host-trades routes have no
 * public surface (§7.5), so a reply is only ever served to a signed-in host
 * reading the directory, to the provider who wrote it, or to an admin
 * moderating. Same note as `host-trade-review.access.schema.ts`.
 */

/**
 * PROTECTED ACCESS SCHEMA
 *
 * What the directory renders under a review, plus what the provider needs to
 * understand the state of his own answer.
 *
 * `moderationState` stays IN because a reply is born PENDING: without it the
 * provider's panel could not tell him his answer is awaiting review rather than
 * lost, which is the single most likely thing for him to misread (T-051).
 * `reviewEditedAfterReply` stays IN because it drives the banner the reply is
 * rendered with (AC-22).
 *
 * The moderator's identity and their private reason stay OUT, matching the
 * review tier. Note the consequence: the REASON for a rejection reaches its
 * author through the `reply-moderated` email (AC-24), not through this shape.
 * Showing it in the provider's panel as well would need a deliberate widening
 * here, not an accidental one.
 *
 * `authorUserId` stays OUT too. The reply is attributable to the LISTING, which
 * the reader already has; mapping it to the natural person behind the business
 * is data the directory never needs to render.
 */
export const HostTradeReviewReplyProtectedSchema = HostTradeReviewReplySchema.pick({
    id: true,
    reviewId: true,
    content: true,
    moderationState: true,
    reviewEditedAfterReply: true,
    createdAt: true,
    updatedAt: true
});

/** Inferred type for {@link HostTradeReviewReplyProtectedSchema}. */
export type HostTradeReviewReplyProtected = z.infer<typeof HostTradeReviewReplyProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * The full row, including who moderated it and why — which is what the
 * moderation queue screen is for (G-5).
 */
export const HostTradeReviewReplyAdminSchema = HostTradeReviewReplySchema;

/** Inferred type for {@link HostTradeReviewReplyAdminSchema}. */
export type HostTradeReviewReplyAdmin = z.infer<typeof HostTradeReviewReplyAdminSchema>;
