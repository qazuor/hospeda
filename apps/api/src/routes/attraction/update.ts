import { AttractionIdSchema, AttractionSchema, AttractionUpdateInputSchema } from '@repo/schemas';
import { AttractionService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const attractionService = new AttractionService({ logger: apiLogger });

export const updateAttractionRoute = createCRUDRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update attraction',
    description: 'Updates an attraction by ID',
    tags: ['Attractions'],
    requestParams: { id: AttractionIdSchema },
    requestBody: AttractionUpdateInputSchema,
    responseSchema: AttractionSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await attractionService.update(actor, id, body as never);
        if (result.error) throw result.error;
        return result.data;
    }
});
