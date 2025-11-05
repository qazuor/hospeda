/**
 * Complete CRUD Endpoint Example
 *
 * This example shows a complete CRUD implementation for a Product entity
 * including all layers: Schema → Model → Service → Routes
 */

import {
    createProductSchema,
    productSchema,
    searchProductSchema,
    updateProductSchema
} from '@repo/schemas';
import { ProductService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { createListRoute, createOpenApiRoute } from '../../src/utils/route-factory';

// List Products (GET /products)
export const listProductsRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List products',
    description: 'Returns paginated list of products',
    tags: ['Products'],
    querySchema: searchProductSchema.optional(),
    responseSchema: z.array(productSchema),
    handler: async (c: Context, _params, _body, query) => {
        const service = new ProductService(c);
        const result = await service.findAll(query);

        return {
            data: result.data,
            pagination: result.pagination
        };
    },
    options: {
        skipAuth: true, // Public endpoint
        cacheTTL: 300 // Cache for 5 minutes
    }
});

// Get Product by ID (GET /products/:id)
export const getProductByIdRoute = createOpenApiRoute({
    method: 'get',
    path: '/:id',
    summary: 'Get product by ID',
    description: 'Returns a single product',
    tags: ['Products'],
    requestParams: {
        id: z.string().uuid()
    },
    responseSchema: productSchema,
    handler: async (c: Context, params) => {
        const service = new ProductService(c);
        const result = await service.findById({ id: params.id });

        if (!result.success) {
            throw new Error(result.error.message);
        }

        return result.data;
    },
    options: { skipAuth: true }
});

// Create Product (POST /products)
export const createProductRoute = createOpenApiRoute({
    method: 'post',
    path: '/',
    summary: 'Create product',
    description: 'Creates a new product',
    tags: ['Products'],
    requestBody: createProductSchema,
    responseSchema: productSchema,
    handler: async (c: Context, _params, body) => {
        const service = new ProductService(c);
        const result = await service.create(body);

        if (!result.success) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
    // Auth required by default
});

// Update Product (PATCH /products/:id)
export const updateProductRoute = createOpenApiRoute({
    method: 'patch',
    path: '/:id',
    summary: 'Update product',
    description: 'Updates an existing product',
    tags: ['Products'],
    requestParams: {
        id: z.string().uuid()
    },
    requestBody: updateProductSchema.omit({ id: true }),
    responseSchema: productSchema,
    handler: async (c: Context, params, body) => {
        const service = new ProductService(c);
        const result = await service.update({
            id: params.id,
            ...body
        });

        if (!result.success) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});

// Delete Product (DELETE /products/:id)
export const deleteProductRoute = createOpenApiRoute({
    method: 'delete',
    path: '/:id',
    summary: 'Delete product',
    description: 'Soft deletes a product',
    tags: ['Products'],
    requestParams: {
        id: z.string().uuid()
    },
    responseSchema: z.object({
        id: z.string(),
        deletedAt: z.string()
    }),
    handler: async (c: Context, params) => {
        const service = new ProductService(c);
        const result = await service.delete({ id: params.id });

        if (!result.success) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});

// Register routes
import { createRouter } from '../../src/utils/create-app';

const router = createRouter();

router.route('/', listProductsRoute);
router.route('/', createProductRoute);
router.route('/', getProductByIdRoute);
router.route('/', updateProductRoute);
router.route('/', deleteProductRoute);

export default router;
