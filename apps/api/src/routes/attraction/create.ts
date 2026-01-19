import { AttractionCreateInputSchema, AttractionSchema } from '@repo/schemas';
import { AttractionService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const attractionService = new AttractionService({ logger: apiLogger });

export const createAttractionRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create attraction',
    description: 'Creates a new attraction',
    tags: ['Attractions'],
    requestBody: AttractionCreateInputSchema,
    responseSchema: AttractionSchema,
    handler: async (ctx: Context, _params, body: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await attractionService.create(actor, body as never);
        if (result.error) throw result.error;
        return result.data;
    }
});
