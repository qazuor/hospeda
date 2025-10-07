import {
    type FeatureCreateInput,
    FeatureCreateInputSchema,
    FeatureCreateOutputSchema
} from '@repo/schemas';
import { FeatureService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const createFeatureRoute = createCRUDRoute({
    method: 'post',
    path: '/features',
    summary: 'Create feature',
    description: 'Creates a new feature',
    tags: ['Features'],
    requestBody: FeatureCreateInputSchema,
    responseSchema: FeatureCreateOutputSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const input = body as FeatureCreateInput;
        const service = new FeatureService({ logger: apiLogger });
        const result = await service.create(actor, input);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
