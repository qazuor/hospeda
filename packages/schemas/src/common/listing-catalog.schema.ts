import { z } from 'zod';
import { AmenityAvailabilityEnumSchema } from '../enums/amenity-availability.schema.js';
import { AmenityScopeEnumSchema } from '../enums/amenity-scope.schema.js';

// ============================================================================
// Listing catalog projections — the amenity / feature rows a public
// venue or experience detail page renders (HOS-1072).
// ============================================================================

/**
 * One amenity attached to a listing, as published on the PUBLIC tier.
 *
 * The shape is a merge of the junction row and the shared `amenities` catalog
 * row it points at, exactly like `AccommodationPublicSchema.amenities` — the
 * two verticals read the SAME catalog, so a separate item shape would only
 * fork the i18n contract.
 *
 * HOS-2061: `r_venue_amenity` and `r_experience_amenity` now carry the same
 * relation attributes as `r_accommodation_amenity` (`isOptional`,
 * `additionalCost`, `scope`, `availability`), and they are published with the
 * same shape and the same NULL semantics as the accommodation twin.
 *
 * `slug` is the canonical identifier AND the i18n key
 * (`accommodations.amenityNames.<slug>`) — SPEC-266 dropped the catalog `name`
 * column, so there is no display text to read from the row.
 */
export const ListingAmenityPublicSchema = z.object({
    /** Catalog row id (junction FK). */
    amenityId: z.string().uuid(),
    /** Catalog slug — the i18n key used to render the label. */
    slug: z.string(),
    /** Icon name resolved by `@repo/icons`. Null when the catalog row has none. */
    icon: z.string().nullable(),
    /** Whether the amenity is optional for the customer (HOS-2061). */
    isOptional: z.boolean(),
    /**
     * Flat extra cost, or null. Serialized exactly like the accommodation twin:
     * a structured price object is not published here (HOS-2061).
     */
    additionalCost: z.number().nullable(),
    /** Private or shared. NULL = not declared; never inferred (HOS-2061). */
    scope: AmenityScopeEnumSchema.nullish(),
    /** Year-round or seasonal. NULL = not declared; never inferred (HOS-2061). */
    availability: AmenityAvailabilityEnumSchema.nullish()
});

/** TypeScript type for {@link ListingAmenityPublicSchema}. */
export type ListingAmenityPublic = z.infer<typeof ListingAmenityPublicSchema>;

/**
 * One feature attached to a listing, as published on the PUBLIC tier.
 *
 * Unlike the amenity twin above, the feature junction tables DO carry
 * owner-authored columns (`host_rewrite_name`, `comments`), and both are
 * published for the same reason the accommodation page publishes them: they
 * are the owner's own words about that feature on that listing, and dropping
 * them would silently discard text the owner typed.
 */
export const ListingFeaturePublicSchema = z.object({
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

/** TypeScript type for {@link ListingFeaturePublicSchema}. */
export type ListingFeaturePublic = z.infer<typeof ListingFeaturePublicSchema>;
