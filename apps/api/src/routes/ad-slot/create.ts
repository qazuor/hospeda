import { AdSlotSchema, CreateAdSlotSchema } from '@repo/schemas';
import { AdSlotService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const adSlotCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create ad slot',
    description: 'Creates a new advertising slot',
    tags: ['Ad Slots'],
    requestBody: CreateAdSlotSchema,
    responseSchema: AdSlotSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new AdSlotService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof CreateAdSlotSchema>;

        const result = await service.create(actor, validatedBody);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});
