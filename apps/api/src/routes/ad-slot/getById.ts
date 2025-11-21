import { z } from '@hono/zod-openapi';
import { AdSlotSchema } from '@repo/schemas';
import { AdSlotService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const adSlotGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/:id',
    summary: 'Get ad slot by ID',
    description: 'Returns a single advertising slot by ID',
    tags: ['Ad Slots'],
    requestParams: {
        id: z.string().uuid()
    },
    responseSchema: AdSlotSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const service = new AdSlotService({ logger: apiLogger });
        const result = await service.getById(actor, id as string);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});
