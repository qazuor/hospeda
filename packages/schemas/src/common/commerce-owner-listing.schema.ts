import { z } from 'zod';
import { CommerceEntityTypeEnumSchema } from '../enums/commerce-entity-type.schema.js';
import { SubscriptionStatusEnumSchema } from '../enums/subscription-status.schema.js';

// ============================================================================
// CommerceOwnerListingSummary — lightweight view model for the owner's
// self-service "Mi comercio" listing index (SPEC-249 Part A).
//
// A COMMERCE_OWNER can own several listings across both verticals (gastronomy,
// experience). The owner area lists them with just enough to render the index
// and deep-link to each operational editor — NOT the full entity payload.
// ============================================================================

/**
 * Summary row for one commerce listing owned by the current actor.
 *
 * Deliberately minimal — this is an INDEX row, not the editable payload: it
 * carries only what the listing index needs (label, slug, sub-type badge,
 * subscription/visibility state). NOTE: as of HOS-166 D-1, `name` (and other
 * identity fields not present here) ARE owner-editable — "read-only" no
 * longer describes the identity fields generally, only this summary
 * projection specifically. The full editable payload (including `name`,
 * `description`, `destinationId`) is fetched per-listing via the protected
 * getById endpoint of the matching vertical.
 */
export const CommerceOwnerListingSummarySchema = z.object({
    /** Listing UUID (primary key of the gastronomy/experience row). */
    id: z.string().uuid({ message: 'zodError.commerce.ownerListing.id.invalid' }),

    /** Which commerce vertical this listing belongs to ('gastronomy' | 'experience'). */
    vertical: CommerceEntityTypeEnumSchema,

    /** Display name of the listing (read-only for owners). */
    name: z.string(),

    /** URL-safe slug used to build the public ficha link (read-only for owners). */
    slug: z.string(),

    /**
     * Vertical-specific sub-type (e.g. a gastronomy or experience type value),
     * carried as a plain string because the concrete enum differs per vertical
     * and this is a display-only badge.
     */
    type: z.string(),

    /**
     * Whether the listing is currently publicly visible.
     *
     * Derived from the entity `visibility` (PUBLIC vs anything else). Visibility
     * is reconciler-driven from the commerce subscription (SPEC-239), so this is
     * the single owner-facing signal of whether the ficha is live — the summary
     * deliberately does NOT surface raw subscription/billing state (out of scope
     * per SPEC-249 §4), and it stays consistent across both verticals (gastronomy
     * has no `hasActiveSubscription` column; experiences does).
     */
    isPublic: z.boolean(),

    /**
     * The listing's current commerce subscription status, or `null`/absent
     * when it has never had one (still a `DRAFT` never taken to checkout).
     *
     * HOS-166 judgment-day W1: SPEC-249's original omission of raw billing
     * state left the `SUSPENDED` card state (payment lapsed / dunning)
     * permanently unreachable on the owner's listing index — there was no
     * signal to derive it from (see `apps/web/src/lib/commerce/
     * listing-card-state.ts`'s `resolveCommerceListingCardState` doc). This
     * field is the minimal fix: it exposes the SAME status string stored on
     * `commerce_listing_subscriptions.status` (mirroring
     * `billing_subscriptions.status` — see `SubscriptionStatusEnum`), scoped
     * to this one commerce listing. Resolved via `getCommerceListingSubscriptionStatuses`
     * (`@repo/service-core`), which reads ONLY the commerce link table — that
     * table's rows are always `product_domain = 'commerce'` by construction,
     * so this can never leak accommodation or partner billing state.
     *
     * Optional AND nullable (not just nullable) so existing callers/fixtures
     * that predate this field keep parsing unchanged.
     */
    subscriptionStatus: SubscriptionStatusEnumSchema.nullable().optional()
});

/** Inferred type for a single owner listing summary row. */
export type CommerceOwnerListingSummary = z.infer<typeof CommerceOwnerListingSummarySchema>;

/**
 * Response schema for the protected "list my commerce listings" endpoints
 * (`GET /{vertical}/protected/mine`). Wraps the array under `listings` so the
 * shape can grow (counts, pagination) without a breaking change.
 */
export const CommerceOwnerListingListSchema = z.object({
    listings: z.array(CommerceOwnerListingSummarySchema)
});

/** Inferred type for the owner listing list response. */
export type CommerceOwnerListingList = z.infer<typeof CommerceOwnerListingListSchema>;
