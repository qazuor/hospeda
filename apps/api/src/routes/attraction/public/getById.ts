/**
 * Public get attraction by ID endpoint
 * Returns a single attraction by its ID
 */
import { AttractionIdSchema, AttractionPublicSchema, type ServiceErrorCode } from '@repo/schemas';
import { AttractionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const attractionService = new AttractionService({ logger: apiLogger });

/**
 * GET /api/v1/public/attractions/:id
 * Get attraction by ID - Public endpoint
 */
export const publicGetAttractionByIdRoute = createPublicRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get attraction by ID',
    description: 'Retrieves an attraction by its ID',
    tags: ['Attractions'],
    requestParams: {
        id: AttractionIdSchema
    },
    responseSchema: AttractionPublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await attractionService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
