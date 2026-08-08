import { z } from 'zod';
import { stripShapeDefaults } from '../../utils/utils.js';
import { HostTradeReviewSchema } from './host-trade-review.schema.js';

/**
 * @file host-trade-review.crud.schema.ts
 * @description Write shapes for host-trade reviews (HOS-376 §6.3).
 *
 * Same mechanism as the usage schemas: a field the client may not set is one
 * these schemas do not DECLARE, and every HTTP body is `.strict()` so an
 * injected key is rejected loudly instead of stripped quietly.
 *
 * What that keeps out is the whole moderation apparatus. `moderationState` is
 * decided server-side by `moderateText()`, `averageRating` is derived from the
 * breakdown, and `editedAt` is the marker that tells a provider's reply it now
 * answers an older version of the text (AC-22). A client that could set any of
 * the three could publish a review that skipped moderation, invent its own
 * average, or edit the text without the reply ever being flagged.
 */

// ============================================================================
// CREATE
// ============================================================================

/** What the SERVICE supplies when creating a review. */
export const HostTradeReviewCreateInputSchema = HostTradeReviewSchema.omit({
    id: true,
    averageRating: true,
    moderationState: true,
    moderatedById: true,
    moderatedAt: true,
    moderationReason: true,
    editedAt: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/** Inferred type for {@link HostTradeReviewCreateInputSchema}. */
export type HostTradeReviewCreateInput = z.infer<typeof HostTradeReviewCreateInputSchema>;

/**
 * Body for `POST /protected/host-trades/{id}/reviews`.
 *
 * The provider comes from the path and the host from the session, so neither
 * appears here. `lifecycleState` is dropped too — a review is born ACTIVE and
 * archiving is not something its author does through the create endpoint.
 */
export const HostTradeReviewCreateBodySchema = HostTradeReviewCreateInputSchema.omit({
    hostTradeId: true,
    hostUserId: true,
    lifecycleState: true
}).strict();

/** Inferred type for {@link HostTradeReviewCreateBodySchema}. */
export type HostTradeReviewCreateBody = z.infer<typeof HostTradeReviewCreateBodySchema>;

// ============================================================================
// UPDATE
// ============================================================================

/**
 * Body for `PATCH /protected/host-trades/reviews/{id}` — the host editing
 * their own review.
 *
 * Exactly the four fields the host authored. Editing re-runs moderation and
 * stamps `editedAt` server-side; both are absent here for that reason.
 */
// Zod 4 `.partial()` keeps `.default()`; strip them so an absent key means "no change".
export const HostTradeReviewUpdateBodySchema = z
    .object(
        stripShapeDefaults(
            HostTradeReviewSchema.pick({
                overallRating: true,
                rating: true,
                respectedBenefit: true,
                content: true
            }).shape
        )
    )
    .partial()
    .strict();

/** Inferred type for {@link HostTradeReviewUpdateBodySchema}. */
export type HostTradeReviewUpdateBody = z.infer<typeof HostTradeReviewUpdateBodySchema>;

/** Service-layer update input. Same fields, no HTTP strictness. */
export const HostTradeReviewUpdateInputSchema = z
    .object(
        stripShapeDefaults(
            HostTradeReviewSchema.pick({
                overallRating: true,
                rating: true,
                respectedBenefit: true,
                content: true,
                averageRating: true,
                editedAt: true
            }).shape
        )
    )
    .partial();

/** Inferred type for {@link HostTradeReviewUpdateInputSchema}. */
export type HostTradeReviewUpdateInput = z.infer<typeof HostTradeReviewUpdateInputSchema>;
