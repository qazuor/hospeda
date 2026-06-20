import { z } from 'zod';
import { CommerceEntityTypeEnumSchema } from '../enums/commerce-entity-type.schema.js';

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
 * Deliberately minimal: identity is read-only for owners, so the summary
 * carries only what the listing index needs (label, slug, sub-type badge,
 * subscription/visibility state). The full editable payload is fetched
 * per-listing via the protected getById endpoint of the matching vertical.
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
    isPublic: z.boolean()
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
