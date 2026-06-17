/**
 * Public get gastronomy listing by ID endpoint (T-042)
 * Returns a single gastronomy listing projected through GastronomyPublicSchema.
 * Returns 404 when the listing is not visible (non-existent, soft-deleted, or non-public).
 */
import { GastronomyPublicSchema } from '@repo/schemas';
import { GastronomyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * GET /api/v1/public/gastronomies/:id
 * Get gastronomy listing by ID — Public endpoint.
 *
 * Returns null (404) when the listing does not exist or is not publicly visible.
 * The service's _canView check and projection apply.
 */
export const publicGetGastronomyByIdRoute = createPublicRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get gastronomy listing by ID',
    description: 'Retrieves a gastronomy listing by its UUID',
    tags: ['Gastronomy'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: GastronomyPublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await gastronomyService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data ?? null;
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
