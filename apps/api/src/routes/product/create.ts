import {
    type ProductCreateHttp,
    ProductCreateHttpSchema,
    ProductSchema,
    httpToDomainProductCreate
} from '@repo/schemas';
import { ProductService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const productCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create product',
    description: 'Creates a new product entity',
    tags: ['Products'],
    requestBody: ProductCreateHttpSchema,
    responseSchema: ProductSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);

        // Convert HTTP data to domain input
        const createInput = httpToDomainProductCreate(body as ProductCreateHttp);

        const service = new ProductService({ logger: apiLogger });
        const result = await service.create(actor, createInput);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});
