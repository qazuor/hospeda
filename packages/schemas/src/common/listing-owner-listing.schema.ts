import { z } from 'zod';
import { PublicationStatusEnumSchema } from '../enums/publication-status.schema.js';
import { SubscriptionStatusEnumSchema } from '../enums/subscription-status.schema.js';

// ============================================================================
// OwnerListingSummary — lightweight view model for the owner's
// self-service "Mi comercio" listing index (SPEC-249 Part A).
//
// An owner can hold either or both vertical roles and own several listings.
// The owner area lists them with just enough to render the index
// and deep-link to each operational editor — NOT the full entity payload.
// ============================================================================

/**
 * Summary row for one listing owned by the current actor.
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
export const OwnerListingSummarySchema = z.object({
    /** Listing UUID (primary key of the gastronomy/experience row). */
    id: z.string().uuid({ message: 'zodError.listing.ownerListing.id.invalid' }),

    /** Which gastronomy or experience vertical this listing belongs to ('venue' | 'experience'). */
    vertical: z.enum(['venue', 'experience']),

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
     * The listing's publication state (`PublicationStatusEnum`, HOS-1641): the
     * six states the PB publication transitions move it through. The owner
     * surfaces read this to decide which state and which actions a card shows
     * (e.g. a `PURGED` listing offers none).
     */
    publicationStatus: PublicationStatusEnumSchema,

    /**
     * Whether the listing is currently publicly visible:
     * `publicationStatus === PUBLISHED` (HOS-1641). `PUBLISHED` is the only
     * state a stranger can read, so this is the single owner-facing signal of
     * whether the ficha is live — the summary deliberately does NOT surface raw
     * subscription/billing state (out of scope per SPEC-249 §4).
     */
    isPublic: z.boolean(),

    /**
     * Whether the listing has a public page RIGHT NOW:
     * `publicationStatus === PUBLISHED` (HOS-1641), the predicate the public
     * read and every protected route that prints something for a listing use.
     *
     * Since HOS-1641 it answers the same as {@link isPublic}: both used to be
     * derived from separate old columns (HOS-982 PR 2 added this one because
     * the single-column `isPublic` could call a row published that the API
     * answered 404 for). Both stay so existing consumers keep parsing.
     *
     * Optional, so a client parsing an older response still validates. A consumer
     * that finds it absent MUST treat it as not published.
     */
    hasPublicPage: z.boolean().optional(),

    /**
     * The listing's current subscription status, or `null`/absent
     * when it has never had one (still a `DRAFT` never taken to checkout).
     *
     * HOS-166 judgment-day W1: SPEC-249's original omission of raw billing
     * state left the `SUSPENDED` card state (payment lapsed / dunning)
     * permanently unreachable on the owner's listing index — there was no
     * signal to derive it from (see `apps/web/src/lib/listing/
     * listing-card-state.ts`'s `resolveListingCardState` doc). This
     * field is the minimal fix: it exposes the SAME status string stored on
     * `entity_subscriptions.status` (mirroring
     * `billing_subscriptions.status` — see `SubscriptionStatusEnum`), scoped
     * to this one listing. Resolved via `getListingSubscriptionStatuses`
     * (`@repo/service-core`), which reads the `entity_subscriptions` cache by listing, so a
     * gastronomy or experience listing can only ever surface its own
     * vertical's billing state, never a partner's.
     *
     * Optional AND nullable (not just nullable) so existing callers/fixtures
     * that predate this field keep parsing unchanged.
     */
    subscriptionStatus: SubscriptionStatusEnumSchema.nullable().optional()
});

/** Inferred type for a single owner listing summary row. */
export type OwnerListingSummary = z.infer<typeof OwnerListingSummarySchema>;

/**
 * Response schema for the protected "list my listings" endpoints
 * (`GET /{vertical}/protected/mine`). Wraps the array under `listings` so the
 * shape can grow (counts, pagination) without a breaking change.
 */
export const OwnerListingListSchema = z.object({
    listings: z.array(OwnerListingSummarySchema)
});

/** Inferred type for the owner listing list response. */
export type OwnerListingList = z.infer<typeof OwnerListingListSchema>;
