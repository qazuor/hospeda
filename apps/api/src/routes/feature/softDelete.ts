import { DeleteResultSchema, FeatureIdSchema } from '@repo/schemas';
import { FeatureService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const softDeleteFeatureRoute = createCRUDRoute({
    method: 'delete',
    path: '/features/{id}',
    summary: 'Soft delete feature',
    description: 'Marks a feature as deleted',
    tags: ['Features'],
    requestParams: { id: FeatureIdSchema },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params) => {
        const actor = getActorFromContext(ctx);
        const service = new FeatureService({ logger: apiLogger });
        const result = await service.softDelete(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
