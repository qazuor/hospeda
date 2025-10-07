import {
    FeatureIdSchema,
    FeatureSchema,
    type FeatureUpdateInput,
    FeatureUpdateInputSchema
} from '@repo/schemas';
import { FeatureService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const updateFeatureRoute = createCRUDRoute({
    method: 'put',
    path: '/features/{id}',
    summary: 'Update feature',
    description: 'Updates an existing feature',
    tags: ['Features'],
    requestParams: { id: FeatureIdSchema },
    requestBody: FeatureUpdateInputSchema,
    responseSchema: FeatureSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const input = body as FeatureUpdateInput;
        const service = new FeatureService({ logger: apiLogger });
        const result = await service.update(actor, params.id as string, input);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
