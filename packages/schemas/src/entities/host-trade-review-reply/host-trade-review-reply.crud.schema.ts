import type { z } from 'zod';
import { HostTradeReviewReplySchema } from './host-trade-review-reply.schema.js';

/**
 * @file host-trade-review-reply.crud.schema.ts
 * @description Write shapes for review replies (HOS-376 §6.4, §7.5).
 *
 * Same mechanism as the usage and review schemas: a field the client may not
 * set is one these schemas do not DECLARE, and every HTTP body is `.strict()`
 * so an injected key is rejected loudly instead of stripped quietly.
 *
 * Two fields make that load-bearing here. `moderationState` is what keeps a
 * reply out of the directory until an admin clears it, so a client that could
 * name it would publish straight past the doxxing check the PENDING default
 * exists for. And `reviewEditedAfterReply` is the AC-22 marker — a provider who
 * could clear it would erase the notice that his reply answers an older version
 * of the text.
 */

// ============================================================================
// CREATE
// ============================================================================

/** What the SERVICE supplies when a provider answers a review. */
export const HostTradeReviewReplyCreateInputSchema = HostTradeReviewReplySchema.omit({
    id: true,
    moderationState: true,
    moderatedById: true,
    moderatedAt: true,
    moderationReason: true,
    reviewEditedAfterReply: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/** Inferred type for {@link HostTradeReviewReplyCreateInputSchema}. */
export type HostTradeReviewReplyCreateInput = z.infer<typeof HostTradeReviewReplyCreateInputSchema>;

/**
 * Body for `POST /protected/host-trades/reviews/{id}/reply`.
 *
 * Text and nothing else. The review comes from the path and the author from row
 * ownership — the provider who owns the reviewed listing, resolved server-side,
 * with any other actor getting a 404 rather than a 403 (AC-7 of HOS-278).
 */
export const HostTradeReviewReplyCreateBodySchema = HostTradeReviewReplyCreateInputSchema.omit({
    reviewId: true,
    authorUserId: true
}).strict();

/** Inferred type for {@link HostTradeReviewReplyCreateBodySchema}. */
export type HostTradeReviewReplyCreateBody = z.infer<typeof HostTradeReviewReplyCreateBodySchema>;

// ============================================================================
// UPDATE
// ============================================================================

/**
 * Body for `PATCH /protected/host-trades/replies/{id}` — the provider
 * rewriting his own reply.
 *
 * `content` is REQUIRED, unlike the review's partial PATCH, because this
 * resource has exactly one editable field: "partial" and "complete" are the
 * same body. An empty one would carry no change and still send the reply back
 * to PENDING (AC-23), pulling a published answer out of the directory for
 * nothing.
 */
export const HostTradeReviewReplyUpdateBodySchema = HostTradeReviewReplySchema.pick({
    content: true
}).strict();

/** Inferred type for {@link HostTradeReviewReplyUpdateBodySchema}. */
export type HostTradeReviewReplyUpdateBody = z.infer<typeof HostTradeReviewReplyUpdateBodySchema>;

/**
 * Service-layer update input. Same single field, no HTTP strictness.
 *
 * Deliberately does NOT carry the moderation columns, following the usage
 * schemas: returning a reply to PENDING on edit (AC-23), stamping an admin's
 * decision (§7.5) and raising `reviewEditedAfterReply` (AC-22) are TRANSITIONS.
 * Each has its own caller, its own ownership check and its own stamping, and
 * each writes through the model. Folding them into a generic patch shape would
 * let one of those paths silently perform another's job.
 */
export const HostTradeReviewReplyUpdateInputSchema = HostTradeReviewReplySchema.pick({
    content: true
}).partial();

/** Inferred type for {@link HostTradeReviewReplyUpdateInputSchema}. */
export type HostTradeReviewReplyUpdateInput = z.infer<typeof HostTradeReviewReplyUpdateInputSchema>;
