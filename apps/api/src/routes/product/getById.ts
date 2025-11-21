import { ProductSchema } from '@repo/schemas';
import { ProductService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const productGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '//:id',
    summary: 'Get product by ID',
    description: 'Retrieves a single product by their unique identifier',
    tags: ['Products'],
    requestParams: {
        id: z.string().uuid()
    },
    responseSchema: ProductSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const service = new ProductService({ logger: apiLogger });
        const result = await service.getById(actor, id as string);

        if (result.error) {
            throw new Error(result.error.message);
        }

        if (!result.data) {
            throw new Error('Product not found');
        }

        return result.data;
    }
});
