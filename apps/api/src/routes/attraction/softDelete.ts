import { AttractionIdSchema } from '@repo/schemas';
import { AttractionService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const attractionService = new AttractionService({ logger: apiLogger });

export const softDeleteAttractionRoute = createCRUDRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete attraction',
    description: 'Soft deletes an attraction by ID',
    tags: ['Attractions'],
    requestParams: { id: AttractionIdSchema },
    responseSchema: AttractionIdSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await attractionService.softDelete(actor, id);
        if (result.error) throw result.error;
        return { id };
    }
});
