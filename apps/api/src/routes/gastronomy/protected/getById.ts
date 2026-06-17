/**
 * Protected gastronomy get-by-ID endpoint (T-043)
 * Returns a gastronomy listing with owner-tier projection for authenticated users.
 *
 * The owner sees their own listing through GastronomyProtectedSchema which
 * includes ownerId, contactInfo, lifecycleState, and audit dates not exposed
 * on the public tier.
 */
import { GastronomyProtectedSchema } from '@repo/schemas';
import { GastronomyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * GET /api/v1/protected/gastronomies/:id
 * Get gastronomy listing by ID — Protected endpoint (authenticated owner view).
 *
 * Ownership is NOT enforced here: any authenticated user may GET any listing
 * through this endpoint (same as accommodation protected getById). Identity
 * restriction is only enforced on mutation endpoints via updateOwn().
 */
export const protectedGetGastronomyByIdRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get gastronomy listing by ID (protected)',
    description: 'Returns a gastronomy listing with owner-tier fields for authenticated users',
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

        return result.data ?? null;
    }
});
