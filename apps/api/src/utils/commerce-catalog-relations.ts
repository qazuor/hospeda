/**
 * @file commerce-catalog-relations.ts
 * @description Reads the amenities and features a commerce listing (gastronomy
 * or experience) is linked to, joined with the shared catalog, for the public
 * detail response (HOS-1072).
 *
 * WHY THIS LIVES IN A ROUTE UTIL AND NOT IN THE SERVICE. The listing services
 * already load `amenities` / `features` as Drizzle relations, but a bare
 * `with: { amenities: true }` returns the JUNCTION rows — `{ gastronomyId,
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
    rGastronomyAmenity,
    rGastronomyFeature
} from '@repo/db';
import type { CommerceListingAmenityPublic, CommerceListingFeaturePublic } from '@repo/schemas';

/**
 * Ordering shared by every query below: the catalog's own `displayWeight`
 * first, then `slug` so equal weights come back in a stable order instead of
 * whatever the planner felt like. The public item shape does NOT carry
 * `displayWeight` — the ordering is applied here so the client renders the
 * important rows first without the page having to re-sort a field it was
 * never given.
 */

/**
 * Amenities linked to one gastronomy listing, joined with the shared catalog.
 *
 * @param gastronomyId - The listing's UUID.
 * @returns Catalog-joined amenity rows, most important first. Empty when none.
 */
export async function fetchGastronomyAmenities(
    gastronomyId: string
): Promise<readonly CommerceListingAmenityPublic[]> {
    const db = getDb();
    const rows = await db
        .select({
            amenityId: rGastronomyAmenity.amenityId,
            slug: amenities.slug,
            icon: amenities.icon,
            displayWeight: amenities.displayWeight
        })
        .from(rGastronomyAmenity)
        .innerJoin(amenities, eq(rGastronomyAmenity.amenityId, amenities.id))
        .where(eq(rGastronomyAmenity.gastronomyId, gastronomyId))
        .orderBy(desc(amenities.displayWeight), asc(amenities.slug));

    return rows.map((row) => ({
        amenityId: row.amenityId,
        slug: row.slug,
        icon: row.icon ?? null
    }));
}

/**
 * Features linked to one gastronomy listing, joined with the shared catalog.
 *
 * @param gastronomyId - The listing's UUID.
 * @returns Catalog-joined feature rows, most important first. Empty when none.
 */
export async function fetchGastronomyFeatures(
    gastronomyId: string
): Promise<readonly CommerceListingFeaturePublic[]> {
    const db = getDb();
    const rows = await db
        .select({
            featureId: rGastronomyFeature.featureId,
            slug: features.slug,
            icon: features.icon,
            displayWeight: features.displayWeight,
            hostReWriteName: rGastronomyFeature.hostReWriteName,
            comments: rGastronomyFeature.comments
        })
        .from(rGastronomyFeature)
        .innerJoin(features, eq(rGastronomyFeature.featureId, features.id))
        .where(eq(rGastronomyFeature.gastronomyId, gastronomyId))
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
): Promise<readonly CommerceListingAmenityPublic[]> {
    const db = getDb();
    const rows = await db
        .select({
            amenityId: rExperienceAmenity.amenityId,
            slug: amenities.slug,
            icon: amenities.icon,
            displayWeight: amenities.displayWeight
        })
        .from(rExperienceAmenity)
        .innerJoin(amenities, eq(rExperienceAmenity.amenityId, amenities.id))
        .where(eq(rExperienceAmenity.experienceId, experienceId))
        .orderBy(desc(amenities.displayWeight), asc(amenities.slug));

    return rows.map((row) => ({
        amenityId: row.amenityId,
        slug: row.slug,
        icon: row.icon ?? null
    }));
}

/**
 * Features linked to one experience listing, joined with the shared catalog.
 *
 * @param experienceId - The listing's UUID.
 * @returns Catalog-joined feature rows, most important first. Empty when none.
 */
export async function fetchExperienceFeatures(
    experienceId: string
): Promise<readonly CommerceListingFeaturePublic[]> {
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
