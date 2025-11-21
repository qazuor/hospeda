import { z } from '@hono/zod-openapi';
import { ServiceOrderSchema } from '@repo/schemas';
import { ProfessionalServiceOrderService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const professionalServiceOrderGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/:id',
    summary: 'Get professional service order by ID',
    description: 'Returns a single professional service order by ID',
    tags: ['Professional Service Orders'],
    requestParams: { id: z.string().uuid() },
    responseSchema: ServiceOrderSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const service = new ProfessionalServiceOrderService({ logger: apiLogger });
        const result = await service.getById(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
