import {
    ProductSchema,
    type ProductUpdateHttp,
    ProductUpdateHttpSchema,
    httpToDomainProductUpdate
} from '@repo/schemas';
import { ProductService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const productUpdateRoute = createCRUDRoute({
    method: 'patch',
    path: '//:id',
    summary: 'Update product',
    description: 'Updates an existing product with partial data',
    tags: ['Products'],
    requestParams: {
        id: z.string().uuid()
    },
    requestBody: ProductUpdateHttpSchema,
    responseSchema: ProductSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        // Convert HTTP data to domain input
        const updateInput = httpToDomainProductUpdate(body as ProductUpdateHttp);

        const service = new ProductService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const _validatedBody = body as z.infer<typeof ProductUpdateHttpSchema>;
        const result = await service.update(actor, id as string, updateInput);

        if (result.error) {
            throw new Error(result.error.message);
        }

        if (!result.data) {
            throw new Error('Product not found');
        }

        return result.data;
    }
});
