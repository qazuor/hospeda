import { z } from 'zod';

/**
 * Request body schema for the owner self-service featured toggle endpoint
 * (`PATCH /api/v1/protected/accommodations/:id/featured-toggle`, SPEC-309 T-019).
 *
 * Deliberately separate from {@link AccommodationUpdateHttpSchema}, which
 * strips `isFeatured` entirely (SPEC-292 owner-leak closure) — that schema
 * must stay untouched. This one exists ONLY for the narrowly-scoped toggle
 * route, whose handler gates the write behind a live FEATURED_LISTING
 * entitlement check (plan OR addon), not just field presence.
 */
export const AccommodationFeaturedToggleHttpSchema = z.object({
    /** New value for `accommodations.isFeatured`. */
    isFeatured: z.boolean({
        message: 'zodError.accommodation.featuredToggle.isFeatured.required'
    })
});

/** Inferred type for {@link AccommodationFeaturedToggleHttpSchema}. */
export type AccommodationFeaturedToggleHttp = z.infer<typeof AccommodationFeaturedToggleHttpSchema>;
