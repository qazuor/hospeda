import { z } from 'zod';

// ============================================================================
// Commerce listing catalog projections — the amenity / feature rows a public
// gastronomy or experience detail page renders (HOS-1072).
// ============================================================================

/**
 * One amenity attached to a commerce listing, as published on the PUBLIC tier.
 *
 * The shape is a merge of the junction row and the shared `amenities` catalog
 * row it points at, exactly like `AccommodationPublicSchema.amenities` — the
 * two verticals read the SAME catalog, so a separate item shape would only
 * fork the i18n contract.
 *
 * It is narrower than the accommodation twin in one respect, and that is a
 * property of the tables rather than a simplification: `r_gastronomy_amenity`
 * and `r_experience_amenity` carry no `isOptional` / `additionalCost` columns,
 * so there is nothing to publish for them. Declaring them anyway would promise
 * a value the DB cannot produce.
 *
 * `slug` is the canonical identifier AND the i18n key
 * (`accommodations.amenityNames.<slug>`) — SPEC-266 dropped the catalog `name`
 * column, so there is no display text to read from the row.
 */
export const CommerceListingAmenityPublicSchema = z.object({
    /** Catalog row id (junction FK). */
    amenityId: z.string().uuid(),
    /** Catalog slug — the i18n key used to render the label. */
    slug: z.string(),
    /** Icon name resolved by `@repo/icons`. Null when the catalog row has none. */
    icon: z.string().nullable()
});

/** TypeScript type for {@link CommerceListingAmenityPublicSchema}. */
export type CommerceListingAmenityPublic = z.infer<typeof CommerceListingAmenityPublicSchema>;

/**
 * One feature attached to a commerce listing, as published on the PUBLIC tier.
 *
 * Unlike the amenity twin above, the feature junction tables DO carry
 * owner-authored columns (`host_rewrite_name`, `comments`), and both are
 * published for the same reason the accommodation page publishes them: they
 * are the owner's own words about that feature on that listing, and dropping
 * them would silently discard text the owner typed.
 */
export const CommerceListingFeaturePublicSchema = z.object({
    /** Catalog row id (junction FK). */
    featureId: z.string().uuid(),
    /** Catalog slug — the i18n key used to render the label. */
    slug: z.string(),
    /** Icon name resolved by `@repo/icons`. Null when the catalog row has none. */
    icon: z.string().nullable(),
    /** Owner-provided relabel for this feature on this listing. */
    hostReWriteName: z.string().nullable(),
    /** Owner-provided note shown under the feature label. */
    comments: z.string().nullable()
});

/** TypeScript type for {@link CommerceListingFeaturePublicSchema}. */
export type CommerceListingFeaturePublic = z.infer<typeof CommerceListingFeaturePublicSchema>;
