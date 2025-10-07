import { FeatureIdSchema, FeatureSchema } from '@repo/schemas';
import { FeatureService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const featureGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/features/{id}',
    summary: 'Get feature by ID',
    description: 'Retrieves a feature by ID',
    tags: ['Features'],
    requestParams: { id: FeatureIdSchema },
    responseSchema: FeatureSchema,
    handler: async (ctx: Context, params) => {
        const actor = getActorFromContext(ctx);
        const service = new FeatureService({ logger: apiLogger });
        const result = await service.getById(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
