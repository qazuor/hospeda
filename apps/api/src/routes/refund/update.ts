import { z } from '@hono/zod-openapi';
import { RefundSchema, UpdateRefundHTTPSchema } from '@repo/schemas';
import { RefundService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z as zodType } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const refundUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update refund',
    description: 'Updates an existing refund',
    tags: ['Refunds'],
    requestParams: {
        id: z.string().uuid()
    },
    requestBody: UpdateRefundHTTPSchema,
    responseSchema: RefundSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const service = new RefundService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as zodType.infer<typeof UpdateRefundHTTPSchema>;
        const result = await service.update(actor, id as string, validatedBody);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});
