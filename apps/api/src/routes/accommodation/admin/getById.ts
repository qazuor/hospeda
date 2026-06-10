/**
 * Admin get accommodation by ID endpoint
 * Returns full accommodation information including admin fields, amenities, and features.
 */
import {
    amenities,
    eq,
    features,
    getDb,
    rAccommodationAmenity,
    rAccommodationFeature
} from '@repo/db';
import { AccommodationAdminSchema, AccommodationIdSchema } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Fetches amenities with their catalog data for an accommodation (admin tier).
 *
 * Uses `getDb()` directly because the service/model layer does not expose a
 * projection that joins `r_accommodation_amenity` → `amenities` in a single
 * query while preserving all catalog columns required by `AmenityAdminSchema`.
 * This matches the approach already used by the public `getBySlug` route.
 *
 * @param accommodationId - The accommodation UUID to fetch amenities for.
 * @returns Array of amenity objects with full catalog fields.
 */
async function fetchAdminAmenities(accommodationId: string) {
    const db = getDb();
    const rows = await db
        .select({
            id: amenities.id,
            slug: amenities.slug,
            name: amenities.name,
            description: amenities.description,
            icon: amenities.icon,
            isBuiltin: amenities.isBuiltin,
            isFeatured: amenities.isFeatured,
            displayWeight: amenities.displayWeight,
            type: amenities.type,
            lifecycleState: amenities.lifecycleState,
            adminInfo: amenities.adminInfo,
            createdAt: amenities.createdAt,
            updatedAt: amenities.updatedAt,
            createdById: amenities.createdById,
            updatedById: amenities.updatedById,
            deletedAt: amenities.deletedAt,
            deletedById: amenities.deletedById
        })
        .from(rAccommodationAmenity)
        .innerJoin(amenities, eq(rAccommodationAmenity.amenityId, amenities.id))
        .where(eq(rAccommodationAmenity.accommodationId, accommodationId));

    return rows;
}

/**
 * Fetches features with their catalog data for an accommodation (admin tier).
 *
 * Uses `getDb()` directly for the same reason as `fetchAdminAmenities`.
 *
 * @param accommodationId - The accommodation UUID to fetch features for.
 * @returns Array of feature objects with full catalog fields.
 */
async function fetchAdminFeatures(accommodationId: string) {
    const db = getDb();
    const rows = await db
        .select({
            id: features.id,
            slug: features.slug,
            name: features.name,
            description: features.description,
            icon: features.icon,
            isBuiltin: features.isBuiltin,
            isFeatured: features.isFeatured,
            displayWeight: features.displayWeight,
            lifecycleState: features.lifecycleState,
            adminInfo: features.adminInfo,
            createdAt: features.createdAt,
            updatedAt: features.updatedAt,
            createdById: features.createdById,
            updatedById: features.updatedById,
            deletedAt: features.deletedAt,
            deletedById: features.deletedById
        })
        .from(rAccommodationFeature)
        .innerJoin(features, eq(rAccommodationFeature.featureId, features.id))
        .where(eq(rAccommodationFeature.accommodationId, accommodationId));

    return rows;
}

/**
 * GET /api/v1/admin/accommodations/:id
 * Get accommodation by ID - Admin endpoint.
 *
 * SPEC-169 §2.1/§5.2: the gate only requires admin access; the entity-specific permission
 * (ACCOMMODATION_VIEW_ALL OR ACCOMMODATION_VIEW_OWN) plus owner-scoping are enforced in the
 * service via `adminGetById` → `checkCanAdminView` (a VIEW_OWN host sees only their own; others,
 * including PUBLIC, resolve to NOT_FOUND). It deliberately does NOT use the generic `getById`,
 * whose `checkCanView` would expose any PUBLIC accommodation's admin detail to a VIEW_OWN actor.
 *
 * SPEC-172: enriches the response with `amenities[]` and `features[]` loaded from the
 * junction tables (`r_accommodation_amenity`, `r_accommodation_feature`). The admin form
 * pre-populates its chip fields by mapping `raw.amenities[].id` → `amenityIds` and
 * `raw.features[].id` → `featureIds` (see `useAccommodationPage.enrichedEntity`). The
 * service's `getDefaultGetByIdRelations()` intentionally omits these junction relations
 * (they require a separate join projection), so we load them here in the route handler
 * following the same pattern used by the public `getBySlug` route.
 */
export const adminGetAccommodationByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get accommodation by ID (admin)',
    description:
        'Retrieves full accommodation information including admin fields, amenities, and features',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: AccommodationAdminSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await accommodationService.adminGetById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        if (!result.data) {
            return null;
        }

        const accommodation = result.data;

        // Load amenities and features in parallel from junction tables.
        // The service does not eager-load these (intentional — see comment in
        // getDefaultGetByIdRelations), so we fetch them here the same way the
        // public getBySlug route does.
        const [amenitiesData, featuresData] = await Promise.all([
            fetchAdminAmenities(accommodation.id),
            fetchAdminFeatures(accommodation.id)
        ]);

        return {
            ...accommodation,
            amenities: amenitiesData.length > 0 ? amenitiesData : undefined,
            features: featuresData.length > 0 ? featuresData : undefined
        };
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
