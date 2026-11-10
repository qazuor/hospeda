/**
 * @file listing-catalog-relations.ts
 * @description Reads the amenities and features a venue or experience listing (venue
 * or experience) is linked to, joined with the shared catalog, for the public
 * detail response (HOS-1072).
 *
 * WHY THIS LIVES IN A ROUTE UTIL AND NOT IN THE SERVICE. The listing services
 * already load `amenities` / `features` as Drizzle relations, but a bare
 * `with: { amenities: true }` returns the JUNCTION rows — `{ venueId,
 * amenityId }` — and nothing else. The catalog fields a page needs to render a
 * row (`slug`, which is also the i18n key, and `icon`) live one hop further
 * out. This mirrors `accommodation/public/getBySlug.ts`, which reaches for
 * `getDb()` for exactly the same reason and says so in its own remarks: no
 * service method covers this join projection.
 *
 * WHY ONLY `getBySlug` CALLS IT. A detail page is the only public surface that
 * renders the full amenity/feature grid; the list and card payloads do not, and
 * running two extra joins per card would buy nothing. The accommodation tier
 * draws the same line — its `public/getById` does not enrich either.
 */
import {
    amenities,
    asc,
    desc,
    eq,
    features,
    getDb,
    rExperienceAmenity,
    rExperienceFeature,
    rVenueAmenity,
    rVenueFeature
} from '@repo/db';
import type { ListingAmenityPublic, ListingFeaturePublic } from '@repo/schemas';

/**
 * Ordering shared by every query below: the catalog's own `displayWeight`
 * first, then `slug` so equal weights come back in a stable order instead of
 * whatever the planner felt like. The public item shape does NOT carry
 * `displayWeight` — the ordering is applied here so the client renders the
 * important rows first without the page having to re-sort a field it was
 * never given.
 */

/** Junction + catalog columns read for one linked amenity (HOS-2061). */
interface ListingAmenityRow {
    readonly amenityId: string;
    readonly slug: string;
    readonly icon: string | null;
    readonly isOptional: boolean;
    readonly additionalCost: unknown;
    /** pgEnum column; Drizzle types it as a plain string. */
    readonly scope: string | null;
    /** pgEnum column; Drizzle types it as a plain string. */
    readonly availability: string | null;
}

/**
 * Serializes one linked amenity exactly like the accommodation public detail
 * (`accommodation/public/getBySlug.ts`), so the three verticals publish one
 * shape: a structured price object is not published as `additionalCost`, and
 * an undeclared `scope` / `availability` stays `null` (HOS-2061).
 *
 * @param row - Junction row joined with the catalog.
 * @returns The public amenity item.
 */
function toListingAmenityPublic(row: ListingAmenityRow): ListingAmenityPublic {
    return {
        amenityId: row.amenityId,
        slug: row.slug,
        icon: row.icon ?? null,
        isOptional: row.isOptional,
        additionalCost:
            row.additionalCost != null && typeof row.additionalCost === 'object'
                ? null
                : ((row.additionalCost as number | null | undefined) ?? null),
        scope: (row.scope ?? null) as ListingAmenityPublic['scope'],
        availability: (row.availability ?? null) as ListingAmenityPublic['availability']
    };
}

/**
 * Amenities linked to one venue listing, joined with the shared catalog.
 *
 * @param venueId - The listing's UUID.
 * @returns Catalog-joined amenity rows, most important first. Empty when none.
 */
export async function fetchVenueAmenities(
    venueId: string
): Promise<readonly ListingAmenityPublic[]> {
    const db = getDb();
    const rows = await db
        .select({
            amenityId: rVenueAmenity.amenityId,
            slug: amenities.slug,
            icon: amenities.icon,
            displayWeight: amenities.displayWeight,
            isOptional: rVenueAmenity.isOptional,
            additionalCost: rVenueAmenity.additionalCost,
            scope: rVenueAmenity.scope,
            availability: rVenueAmenity.availability
        })
        .from(rVenueAmenity)
        .innerJoin(amenities, eq(rVenueAmenity.amenityId, amenities.id))
        .where(eq(rVenueAmenity.venueId, venueId))
        .orderBy(desc(amenities.displayWeight), asc(amenities.slug));

    return rows.map(toListingAmenityPublic);
}

/**
 * Features linked to one venue listing, joined with the shared catalog.
 *
 * @param venueId - The listing's UUID.
 * @returns Catalog-joined feature rows, most important first. Empty when none.
 */
export async function fetchVenueFeatures(
    venueId: string
): Promise<readonly ListingFeaturePublic[]> {
    const db = getDb();
    const rows = await db
        .select({
            featureId: rVenueFeature.featureId,
            slug: features.slug,
            icon: features.icon,
            displayWeight: features.displayWeight,
            hostReWriteName: rVenueFeature.hostReWriteName,
            comments: rVenueFeature.comments
        })
        .from(rVenueFeature)
        .innerJoin(features, eq(rVenueFeature.featureId, features.id))
        .where(eq(rVenueFeature.venueId, venueId))
        .orderBy(desc(features.displayWeight), asc(features.slug));

    return rows.map((row) => ({
        featureId: row.featureId,
        slug: row.slug,
        icon: row.icon ?? null,
        hostReWriteName: row.hostReWriteName ?? null,
        comments: row.comments ?? null
    }));
}

/**
 * Amenities linked to one experience listing, joined with the shared catalog.
 *
 * @param experienceId - The listing's UUID.
 * @returns Catalog-joined amenity rows, most important first. Empty when none.
 */
export async function fetchExperienceAmenities(
    experienceId: string
): Promise<readonly ListingAmenityPublic[]> {
    const db = getDb();
    const rows = await db
        .select({
            amenityId: rExperienceAmenity.amenityId,
            slug: amenities.slug,
            icon: amenities.icon,
            displayWeight: amenities.displayWeight,
            isOptional: rExperienceAmenity.isOptional,
            additionalCost: rExperienceAmenity.additionalCost,
            scope: rExperienceAmenity.scope,
            availability: rExperienceAmenity.availability
        })
        .from(rExperienceAmenity)
        .innerJoin(amenities, eq(rExperienceAmenity.amenityId, amenities.id))
        .where(eq(rExperienceAmenity.experienceId, experienceId))
        .orderBy(desc(amenities.displayWeight), asc(amenities.slug));

    return rows.map(toListingAmenityPublic);
}

/**
 * Features linked to one experience listing, joined with the shared catalog.
 *
 * @param experienceId - The listing's UUID.
 * @returns Catalog-joined feature rows, most important first. Empty when none.
 */
export async function fetchExperienceFeatures(
    experienceId: string
): Promise<readonly ListingFeaturePublic[]> {
    const db = getDb();
    const rows = await db
        .select({
            featureId: rExperienceFeature.featureId,
            slug: features.slug,
            icon: features.icon,
            displayWeight: features.displayWeight,
            hostReWriteName: rExperienceFeature.hostReWriteName,
            comments: rExperienceFeature.comments
        })
        .from(rExperienceFeature)
        .innerJoin(features, eq(rExperienceFeature.featureId, features.id))
        .where(eq(rExperienceFeature.experienceId, experienceId))
        .orderBy(desc(features.displayWeight), asc(features.slug));

    return rows.map((row) => ({
        featureId: row.featureId,
        slug: row.slug,
        icon: row.icon ?? null,
        hostReWriteName: row.hostReWriteName ?? null,
        comments: row.comments ?? null
    }));
}
