/**
 * Protected experience get-by-ID endpoint (T-020)
 * Returns an experience listing with owner-tier projection for authenticated users.
 *
 * The owner sees their own listing through ExperienceProtectedSchema which
 * includes ownerId, contactInfo, lifecycleState, and audit dates not exposed
 * on the public tier.
 */
import { ExperienceProtectedSchema } from '@repo/schemas';
import { ExperienceService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * GET /api/v1/protected/experiences/:id
 * Get experience listing by ID — Protected endpoint (authenticated owner view).
 *
 * Ownership is NOT enforced here: any authenticated user may GET any listing
 * through this endpoint (same as accommodation protected getById). Identity
 * restriction is only enforced on mutation endpoints via updateOwn().
 */
export const protectedGetExperienceByIdRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get experience listing by ID (protected)',
    description: 'Returns an experience listing with owner-tier fields for authenticated users',
    tags: ['Experience'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: ExperienceProtectedSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await experienceService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const entity = result.data;
        if (!entity) {
            return null;
        }

        // Seed the owner editor's amenity/feature multi-select: the protected
        // schema carries these read-back IDs, which the entity projection does
        // not include (junction relations live in separate tables).
        const { amenityIds, featureIds } = await experienceService.loadJunctionIds(entity.id);
        return { ...entity, amenityIds, featureIds };
    }
});
