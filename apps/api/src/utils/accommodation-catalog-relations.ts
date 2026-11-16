/**
 * @file accommodation-catalog-relations.ts
 * @description Reads the amenities and features an accommodation is linked to,
 * joined with the shared catalog, in the owner-tier projection
 * (`AmenityProtectedSchema` / `FeatureProtectedSchema`).
 *
 * Extracted verbatim from `routes/accommodation/protected/getById.ts` (HOS-321
 * enrichment) so the owner get-own route and the `get_listing` assistant tool
 * (HOS-2184 T-014) read the exact same set instead of two copies of the join.
 * `AccommodationService.getDefaultGetByIdRelations()` deliberately omits these
 * junction relations, which is why this reaches for `getDb()` (same reason as
 * `listing-catalog-relations.ts` for venue and experience).
 */

import {
    amenities,
    eq,
    features,
    getDb,
    rAccommodationAmenity,
    rAccommodationFeature
} from '@repo/db';
import type {
    AmenityAvailabilityEnum,
    AmenityProtected,
    AmenityScopeEnum,
    FeatureProtected
} from '@repo/schemas';

/**
 * An amenity catalog row plus its HOS-2058 relation attributes, as the editor
 * baseline needs them. NULL = not declared.
 */
export type ProtectedAmenityWithAttributes = AmenityProtected & {
    readonly scope: AmenityScopeEnum | null;
    readonly availability: AmenityAvailabilityEnum | null;
    /** HOS-2084: `is_optional` -- paid separately. */
    readonly isOptional: boolean;
};

/**
 * Fetches the amenities linked to an accommodation through
 * `r_accommodation_amenity`, projected to the exact field set
 * `AmenityProtectedSchema` declares.
 *
 * Uses `getDb()` directly because `AccommodationService.getDefaultGetByIdRelations()`
 * intentionally omits the junction relations (they need a dedicated join
 * projection) — the same reason the admin `getById` and the public `getBySlug`
 * routes enrich their payloads in the route handler.
 *
 * The projection is narrowed to exactly the fields the response schema
 * declares. Robustness against a malformed catalog row does NOT live here — it
 * lives in the lenient `AccommodationAmenityReadSchema` overlay (HOS-321): the
 * response is fail-closed, so one row tripping a bound would throw
 * INTERNAL_ERROR, 500 the GET, and leave the owner unable to edit at all.
 *
 * Soft-deleted catalog rows are deliberately NOT filtered out — do not "fix"
 * that. Soft-delete is meant to be reversible (`/admin/amenities/:id/restore`
 * exists and `_afterSoftDelete` leaves the junction rows intact), and neither
 * the public `getBySlug` projection nor `/public/amenities` filters them
 * either. Hiding such a row here would omit it from the editor's baseline, so
 * the very next save — the diff is an EXACT set — would `hardDelete` the link
 * the owner was never shown and could not have chosen to keep, turning a
 * reversible admin action into silent, irreversible data loss.
 *
 * @param accommodationId - The accommodation UUID to load amenities for.
 * @returns Amenity catalog rows in `AmenityProtectedSchema` shape.
 */
export async function fetchProtectedAmenities(
    accommodationId: string
): Promise<ProtectedAmenityWithAttributes[]> {
    const db = getDb();
    const rows = await db
        .select({
            id: amenities.id,
            slug: amenities.slug,
            description: amenities.description,
            icon: amenities.icon,
            applicableVerticals: amenities.applicableVerticals,
            type: amenities.type,
            // HOS-2058: relation attributes, so the editor can rebuild them.
            scope: rAccommodationAmenity.scope,
            availability: rAccommodationAmenity.availability,
            // HOS-2084: "Con cargo extra" flag.
            isOptional: rAccommodationAmenity.isOptional,
            isFeatured: amenities.isFeatured,
            displayWeight: amenities.displayWeight,
            isBuiltin: amenities.isBuiltin,
            lifecycleState: amenities.lifecycleState,
            createdAt: amenities.createdAt,
            updatedAt: amenities.updatedAt
        })
        .from(rAccommodationAmenity)
        .innerJoin(amenities, eq(rAccommodationAmenity.amenityId, amenities.id))
        .where(eq(rAccommodationAmenity.accommodationId, accommodationId));

    // The declared return type is what ties this projection to the response
    // contract: drop or rename a column and it becomes a compile error rather
    // than a runtime 500. Drizzle widens three columns, for two different
    // reasons. `type` and `lifecycleState` are pgEnums generated from the very
    // TS enums these types come from, so those casts are sound.
    // `applicableVerticals` is NOT: it is an unconstrained `text[]` (no pgEnum,
    // no CHECK), so this cast is an assumption, not a guarantee — which is
    // exactly why the response overlay relaxes it back to `z.array(z.string())`
    // instead of trusting it.
    return rows.map((row) => ({
        ...row,
        type: row.type as AmenityProtected['type'],
        scope: row.scope as AmenityScopeEnum | null,
        availability: row.availability as AmenityAvailabilityEnum | null,
        lifecycleState: row.lifecycleState as AmenityProtected['lifecycleState'],
        applicableVerticals: row.applicableVerticals as AmenityProtected['applicableVerticals']
    }));
}

/**
 * Fetches the features linked to an accommodation through
 * `r_accommodation_feature`, projected to the exact field set
 * `FeatureProtectedSchema` declares. The `features` catalog has no `type`
 * column — that is the only difference from {@link fetchProtectedAmenities},
 * including the deliberate absence of a soft-delete filter (see there).
 *
 * @param accommodationId - The accommodation UUID to load features for.
 * @returns Feature catalog rows in `FeatureProtectedSchema` shape.
 */
export async function fetchProtectedFeatures(accommodationId: string): Promise<FeatureProtected[]> {
    const db = getDb();
    const rows = await db
        .select({
            id: features.id,
            slug: features.slug,
            description: features.description,
            icon: features.icon,
            applicableVerticals: features.applicableVerticals,
            category: features.category,
            isFeatured: features.isFeatured,
            displayWeight: features.displayWeight,
            isBuiltin: features.isBuiltin,
            lifecycleState: features.lifecycleState,
            createdAt: features.createdAt,
            updatedAt: features.updatedAt
        })
        .from(rAccommodationFeature)
        .innerJoin(features, eq(rAccommodationFeature.featureId, features.id))
        .where(eq(rAccommodationFeature.accommodationId, accommodationId));

    // Same narrowing rationale as `fetchProtectedAmenities` (no `type` here).
    return rows.map((row) => ({
        ...row,
        category: row.category as FeatureProtected['category'],
        lifecycleState: row.lifecycleState as FeatureProtected['lifecycleState'],
        applicableVerticals: row.applicableVerticals as FeatureProtected['applicableVerticals']
    }));
}
