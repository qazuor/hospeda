/**
 * Protected gastronomy get-by-ID endpoint (T-043)
 * Returns a gastronomy listing with owner-tier projection for the authenticated
 * owner. Non-owners without the COMMERCE_VIEW_ALL bypass permission receive
 * NOT_FOUND so that owner-private fields (contactInfo, ownerId,
 * lifecycleState, richDescription, audit dates) are never leaked.
 */
import { GastronomyProtectedSchema, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { GastronomyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * GET /api/v1/protected/gastronomies/:id
 * Get gastronomy listing by ID — Protected endpoint (owner view only).
 *
 * Ownership is enforced: only the owner (`ownerId === actor.id`) or an actor
 * holding COMMERCE_VIEW_ALL (staff / admin) may retrieve this endpoint.
 * Non-owners receive NOT_FOUND to prevent leaking owner-private fields exposed
 * by GastronomyProtectedSchema (contactInfo, lifecycleState, audit dates).
 * The write path (updateOwn) retains its own ownership gate and is unaffected.
 */
export const protectedGetGastronomyByIdRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get gastronomy listing by ID (protected)',
    description:
        'Returns a gastronomy listing with owner-tier fields. Only the owner or staff with COMMERCE_VIEW_ALL may access this endpoint.',
    tags: ['Gastronomy'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: GastronomyProtectedSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await gastronomyService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const entity = result.data;

        // Ownership gate: only the owner or a staff actor with COMMERCE_VIEW_ALL
        // may read owner-private fields through the protected tier.
        const hasViewAll = actor.permissions?.includes(PermissionEnum.COMMERCE_VIEW_ALL);
        if (!hasViewAll && entity?.ownerId !== actor.id) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Gastronomy not found');
        }

        if (!entity) {
            return null;
        }

        // Seed the owner editor's amenity/feature multi-select: the protected
        // schema carries these read-back IDs, which the entity projection does
        // not include (junction relations live in separate tables).
        const { amenityIds, featureIds } = await gastronomyService.loadJunctionIds(entity.id);
        return { ...entity, amenityIds, featureIds };
    }
});
