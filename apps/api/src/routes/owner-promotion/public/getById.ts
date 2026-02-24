/**
 * Public get owner promotion by ID endpoint
 * Returns a single owner promotion by its ID
 */
import { OwnerPromotionIdSchema, OwnerPromotionSchema, type ServiceErrorCode } from '@repo/schemas';
import { OwnerPromotionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const ownerPromotionService = new OwnerPromotionService({ logger: apiLogger });

/**
 * GET /api/v1/public/owner-promotions/:id
 * Get owner promotion by ID - Public endpoint
 */
export const publicGetOwnerPromotionByIdRoute = createPublicRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get owner promotion by ID',
    description: 'Retrieves an owner promotion by its ID',
    tags: ['Owner Promotions'],
    requestParams: { id: OwnerPromotionIdSchema },
    responseSchema: OwnerPromotionSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await ownerPromotionService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    },
    options: {
        cacheTTL: 300
    }
});
