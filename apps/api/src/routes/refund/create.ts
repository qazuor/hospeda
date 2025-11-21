import { CreateRefundHTTPSchema, RefundSchema } from '@repo/schemas';
import { RefundService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const refundCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create refund',
    description: 'Creates a new refund entity',
    tags: ['Refunds'],
    requestBody: CreateRefundHTTPSchema,
    responseSchema: RefundSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new RefundService({ logger: apiLogger });

        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof CreateRefundHTTPSchema>;

        const result = await service.create(actor, validatedBody);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});
