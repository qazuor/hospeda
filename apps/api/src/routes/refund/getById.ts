import { z } from '@hono/zod-openapi';
import { RefundSchema } from '@repo/schemas';
import { RefundService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const refundGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/:id',
    summary: 'Get refund by ID',
    description: 'Returns a single refund by ID',
    tags: ['Refunds'],
    requestParams: {
        id: z.string().uuid()
    },
    responseSchema: RefundSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const service = new RefundService({ logger: apiLogger });
        const result = await service.getById(actor, id as string);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});
