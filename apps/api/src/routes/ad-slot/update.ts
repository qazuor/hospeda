import { z } from '@hono/zod-openapi';
import { AdSlotSchema, UpdateAdSlotSchema } from '@repo/schemas';
import { AdSlotService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z as zodType } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const adSlotUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update ad slot',
    description: 'Updates an existing advertising slot',
    tags: ['Ad Slots'],
    requestParams: {
        id: z.string().uuid()
    },
    requestBody: UpdateAdSlotSchema,
    responseSchema: AdSlotSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);

        const service = new AdSlotService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as zodType.infer<typeof UpdateAdSlotSchema>;
        const result = await service.update(actor, params.id as string, validatedBody);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});
