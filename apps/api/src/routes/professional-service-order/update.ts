import { z } from '@hono/zod-openapi';
import { ServiceOrderSchema, UpdateServiceOrderSchema } from '@repo/schemas';
import { ProfessionalServiceOrderService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const professionalServiceOrderUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update professional service order',
    description: 'Updates an existing professional service order',
    tags: ['Professional Service Orders'],
    requestParams: { id: z.string().uuid() },
    requestBody: UpdateServiceOrderSchema,
    responseSchema: ServiceOrderSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new ProfessionalServiceOrderService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof UpdateServiceOrderSchema>;
        const result = await service.update(actor, params.id as string, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
