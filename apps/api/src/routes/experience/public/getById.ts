/**
 * Public get experience listing by ID endpoint (T-019)
 * Returns a single experience listing projected through ExperiencePublicSchema.
 * Returns 404 when the listing is not visible (non-existent, soft-deleted, or non-public).
 */
import { ExperiencePublicSchema } from '@repo/schemas';
import { ExperienceService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * GET /api/v1/public/experiences/:id
 * Get experience listing by ID — Public endpoint.
 *
 * Returns null (404) when the listing does not exist or is not publicly visible.
 * The service's _canView check and projection apply.
 */
export const publicGetExperienceByIdRoute = createPublicRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get experience listing by ID',
    description: 'Retrieves an experience listing by its UUID',
    tags: ['Experience'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: ExperiencePublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await experienceService.getById(actor, params.id as string);

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
