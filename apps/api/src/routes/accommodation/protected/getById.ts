/**
 * Protected get own accommodation by ID endpoint
 * Returns a single accommodation only if it is owned by the authenticated user.
 */
import {
    amenities,
    eq,
    features,
    getDb,
    rAccommodationAmenity,
    rAccommodationFeature
} from '@repo/db';
import type { AmenityProtected, FeatureProtected } from '@repo/schemas';
import {
    AccommodationIdSchema,
    AccommodationProtectedSchema,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

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
async function fetchProtectedAmenities(accommodationId: string): Promise<AmenityProtected[]> {
    const db = getDb();
    const rows = await db
        .select({
            id: amenities.id,
            slug: amenities.slug,
            description: amenities.description,
            icon: amenities.icon,
            applicableVerticals: amenities.applicableVerticals,
            type: amenities.type,
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
async function fetchProtectedFeatures(accommodationId: string): Promise<FeatureProtected[]> {
    const db = getDb();
    const rows = await db
        .select({
            id: features.id,
            slug: features.slug,
            description: features.description,
            icon: features.icon,
            applicableVerticals: features.applicableVerticals,
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
        lifecycleState: row.lifecycleState as FeatureProtected['lifecycleState'],
        applicableVerticals: row.applicableVerticals as FeatureProtected['applicableVerticals']
    }));
}

/**
 * GET /api/v1/protected/accommodations/:id
 * Get own accommodation by ID - Protected endpoint
 *
 * Returns the accommodation only if the authenticated user is the owner
 * (`ownerId === actor.id`) or holds ACCOMMODATION_UPDATE_ANY permission.
 * Returns 404 if the record is not found or belongs to a different user.
 *
 * HOS-321: the response is enriched with the `amenities` / `features` junction
 * relations. `AccommodationProtectedSchema` has always declared both, but
 * nothing populated them, so the web host editor built its form baseline with
 * `amenityIds: []` / `featureIds: []`. Beyond rendering saved selections as
 * unchecked, that made saving destructive: the PATCH diff sent whatever the
 * host ticked in that session as the complete target set, and
 * `syncAmenityJunction`'s exact-set contract deleted every other row.
 */
export const protectedGetOwnAccommodationByIdRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get own accommodation by ID',
    description:
        'Returns a single accommodation owned by the authenticated user. Returns 404 if not found or not owned by the requesting user.',
    tags: ['Accommodations'],
    // No permission gate: the handler enforces ownership in the service
    // layer and returns 404 if the row belongs to a different user. The
    // previous `ACCOMMODATION_LISTING_VIEW` requirement was the admin
    // listing permission, not granted to default HOST users — so hosts
    // could not even read their own properties through the web UI.
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: AccommodationProtectedSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        const result = await accommodationService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const accommodation = result.data;

        // Ownership check: only return if the actor is the owner.
        // ACCOMMODATION_UPDATE_ANY bypasses the ownership check (admin-level perm).
        const hasUpdateAny = actor.permissions?.includes(PermissionEnum.ACCOMMODATION_UPDATE_ANY);
        if (!hasUpdateAny && accommodation?.ownerId !== actor.id) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
        }

        if (!accommodation) {
            return null;
        }

        // HOS-321: load the junction relations the service does not eager-load.
        // Runs only AFTER the ownership check so a foreign/missing id never
        // triggers the extra queries.
        const [amenitiesData, featuresData] = await Promise.all([
            fetchProtectedAmenities(accommodation.id),
            fetchProtectedFeatures(accommodation.id)
        ]);

        return {
            ...accommodation,
            // `undefined` (not `[]`) when empty, mirroring the admin/public
            // routes: the field is `.optional()` on the response schema.
            amenities: amenitiesData.length > 0 ? amenitiesData : undefined,
            features: featuresData.length > 0 ? featuresData : undefined
        };
    }
});
