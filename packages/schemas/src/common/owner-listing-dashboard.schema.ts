/**
 * Aggregate dashboard payload for venue and experience owners (HOS-2475,
 * HOS-2476, owner decision Q2 of HOS-2414, 2026-11-22).
 *
 * Served by `GET /api/v1/protected/venues/mine/stats` and
 * `GET /api/v1/protected/experiences/mine/stats`: one request per dashboard,
 * instead of composing one call per listing in the client.
 *
 * ## What the payload carries, and what it deliberately leaves out
 *
 * - **Listings by publication state.** Counted from the owner's own listings,
 *   the same rule as the host dashboard (`/protected/host/dashboard`).
 * - **Traffic total**, only when the owner's plan grants `view_basic_stats` in
 *   that vertical AND the read succeeded. Otherwise `traffic` is ABSENT and
 *   `trafficAccess` says why. A locked or failed read is never a `0`.
 * - **No unread inquiries.** Conversations are scoped to accommodations
 *   (`conversations.accommodation_id`); venues and experiences have no inquiry
 *   channel, so the API computes no such count and this payload invents none
 *   (HOS-2414 NG-6).
 *
 * @module common/owner-listing-dashboard.schema
 */

import { z } from 'zod';

/** Verticals that own an aggregate owner dashboard. */
export const OwnerDashboardVerticalSchema = z.enum(['venue', 'experience']);

/** Inferred type of {@link OwnerDashboardVerticalSchema}. */
export type OwnerDashboardVertical = z.infer<typeof OwnerDashboardVerticalSchema>;

/**
 * The owner's listings counted by publication state.
 *
 * `total` includes the states without a field of their own
 * (`UNPUBLISHED_BY_BILLING`, `MODERATED`, `PURGED`), as on the host dashboard.
 */
export const OwnerListingCountsSchema = z.object({
    /** Every listing the owner has, in any state. */
    total: z.number().int().nonnegative(),
    /** Listings in `PUBLISHED`. */
    published: z.number().int().nonnegative(),
    /** Listings in `DRAFT`. */
    draft: z.number().int().nonnegative(),
    /** Listings in `ARCHIVED`. */
    archived: z.number().int().nonnegative()
});

/** Inferred type of {@link OwnerListingCountsSchema}. */
export type OwnerListingCounts = z.infer<typeof OwnerListingCountsSchema>;

/**
 * Why the traffic numbers are (or are not) in the payload.
 *
 * - `granted`: the plan allows it and the read succeeded; `traffic` is present.
 * - `locked`: the plan does not grant `view_basic_stats`; `traffic` is absent.
 * - `unavailable`: the plan allows it but the read failed; `traffic` is absent.
 */
export const OwnerTrafficAccessSchema = z.enum(['granted', 'locked', 'unavailable']);

/** Inferred type of {@link OwnerTrafficAccessSchema}. */
export type OwnerTrafficAccess = z.infer<typeof OwnerTrafficAccessSchema>;

/** Deduplicated page views of every owned listing over the window. */
export const OwnerTrafficTotalsSchema = z.object({
    /** Rolling window the counts cover, in days (7 or 30). */
    windowDays: z.number().int().positive(),
    /** Sum over the owner's listings of distinct visitors per listing. */
    unique: z.number().int().nonnegative(),
    /** Sum over the owner's listings of deduplicated view events. */
    total: z.number().int().nonnegative()
});

/** Inferred type of {@link OwnerTrafficTotalsSchema}. */
export type OwnerTrafficTotals = z.infer<typeof OwnerTrafficTotalsSchema>;

/** Fields every branch of the dashboard payload shares. */
const OwnerListingDashboardBaseSchema = z.object({
    /** The vertical the numbers belong to. */
    vertical: OwnerDashboardVerticalSchema,
    /** The owner's listings by publication state. */
    listings: OwnerListingCountsSchema
});

/**
 * Response of `GET /api/v1/protected/{venues|experiences}/mine/stats`.
 *
 * `traffic` is present exactly when `trafficAccess` is `granted`; in the
 * other two branches an extra `traffic` key is stripped on parse, so a
 * locked or failed read can never leak a number.
 */
export const OwnerListingDashboardSchema = z.discriminatedUnion('trafficAccess', [
    OwnerListingDashboardBaseSchema.extend({
        trafficAccess: z.literal('granted'),
        /** Traffic totals; present only in the `granted` branch. */
        traffic: OwnerTrafficTotalsSchema
    }),
    OwnerListingDashboardBaseSchema.extend({ trafficAccess: z.literal('locked') }),
    OwnerListingDashboardBaseSchema.extend({ trafficAccess: z.literal('unavailable') })
]);

/** Inferred type of {@link OwnerListingDashboardSchema}. */
export type OwnerListingDashboard = z.infer<typeof OwnerListingDashboardSchema>;

/**
 * Accepted traffic windows, as on the other owner view-stats routes.
 * An unsupported value falls back to the default instead of failing the page.
 */
export const OwnerDashboardWindowSchema = z.enum(['7d', '30d']).catch('30d');

/** Inferred type of {@link OwnerDashboardWindowSchema}. */
export type OwnerDashboardWindow = z.infer<typeof OwnerDashboardWindowSchema>;
