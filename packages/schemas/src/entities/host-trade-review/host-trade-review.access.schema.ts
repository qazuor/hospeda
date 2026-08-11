import type { z } from 'zod';
import { HostTradeReviewSchema } from './host-trade-review.schema.js';

/**
 * @file host-trade-review.access.schema.ts
 * @description Read tiers for host-trade reviews (HOS-376).
 *
 * Two tiers, and the missing one is deliberate: the host-trades routes have no
 * public surface (§7.5), so a review row is only ever served to a signed-in
 * host browsing the directory or to an admin moderating. See the same note in
 * `host-trade-usage.access.schema.ts`.
 */

/**
 * PROTECTED ACCESS SCHEMA
 *
 * What the directory renders: the stars, the breakdown, the benefit answer,
 * the text, and whether it was edited.
 *
 * `moderationState` stays IN — a host reading back their own review needs to
 * know it is awaiting review rather than silently missing. The moderator's
 * identity and their private reason stay out: the outcome is the reviewer's
 * business, the deliberation is not.
 */
export const HostTradeReviewProtectedSchema = HostTradeReviewSchema.pick({
    id: true,
    hostTradeId: true,
    hostUserId: true,
    overallRating: true,
    rating: true,
    averageRating: true,
    respectedBenefit: true,
    content: true,
    moderationState: true,
    editedAt: true,
    createdAt: true,
    updatedAt: true
});

/** Inferred type for {@link HostTradeReviewProtectedSchema}. */
export type HostTradeReviewProtected = z.infer<typeof HostTradeReviewProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * The full row, including who moderated it and why — which is the whole point
 * of the moderation queue screen (G-5).
 */
export const HostTradeReviewAdminSchema = HostTradeReviewSchema;

/** Inferred type for {@link HostTradeReviewAdminSchema}. */
export type HostTradeReviewAdmin = z.infer<typeof HostTradeReviewAdminSchema>;
