/**
 * Custom Business Logic Endpoint Example
 *
 * This example shows endpoints with custom business logic
 * beyond simple CRUD operations
 */

import { OrderService, ProductService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../src/middlewares/actor';
import { createOpenApiRoute, createSimpleRoute } from '../../src/utils/route-factory';

// Adjust product stock
const adjustStockSchema = z.object({
    quantity: z.number().int(), // Can be positive or negative
    reason: z.enum(['sale', 'return', 'adjustment', 'damage'])
});

export const adjustStockRoute = createOpenApiRoute({
    method: 'post',
    path: '/:id/adjust-stock',
    summary: 'Adjust product stock',
    description: 'Increases or decreases product stock',
    tags: ['Products'],
    requestParams: {
        id: z.string().uuid()
    },
    requestBody: adjustStockSchema,
    responseSchema: z.object({
        id: z.string(),
        previousStock: z.number(),
        newStock: z.number(),
        adjustment: z.number()
    }),
    handler: async (c: Context, params, body) => {
        const actor = getActorFromContext(c);

        // Check permission
        if (!actor.permissions?.includes('inventory:manage')) {
            throw new Error('Insufficient permissions');
        }

        const service = new ProductService(c);

        // Get current product
        const product = await service.findById({ id: params.id });
        if (!product.success) {
            throw new Error('Product not found');
        }

        const previousStock = product.data.stock;
        const newStock = previousStock + body.quantity;

        // Validate stock doesn't go negative
        if (newStock < 0) {
            throw new Error('Insufficient stock');
        }

        // Update stock
        const result = await service.update({
            id: params.id,
            stock: newStock
        });

        if (!result.success) {
            throw new Error(result.error.message);
        }

        return {
            id: params.id,
            previousStock,
            newStock,
            adjustment: body.quantity
        };
    }
});

// Batch update products
const batchUpdateSchema = z.object({
    ids: z.array(z.string().uuid()),
    updates: z.object({
        isActive: z.boolean().optional(),
        discount: z.number().min(0).max(100).optional()
    })
});

export const batchUpdateRoute = createOpenApiRoute({
    method: 'post',
    path: '/batch-update',
    summary: 'Batch update products',
    description: 'Updates multiple products at once',
    tags: ['Products'],
    requestBody: batchUpdateSchema,
    responseSchema: z.object({
        updated: z.number(),
        failed: z.number(),
        errors: z.array(
            z.object({
                id: z.string(),
                error: z.string()
            })
        )
    }),
    handler: async (c: Context, _params, body) => {
        const service = new ProductService(c);

        let updated = 0;
        let failed = 0;
        const errors: Array<{ id: string; error: string }> = [];

        // Process each product
        for (const id of body.ids) {
            try {
                const result = await service.update({
                    id,
                    ...body.updates
                });

                if (result.success) {
                    updated++;
                } else {
                    failed++;
                    errors.push({ id, error: result.error.message });
                }
            } catch (error) {
                failed++;
                errors.push({
                    id,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        return { updated, failed, errors };
    }
});

// Complex query with multiple services
export const orderSummaryRoute = createSimpleRoute({
    method: 'get',
    path: '/orders/:orderId/summary',
    summary: 'Get order summary',
    description: 'Returns detailed order summary with products',
    tags: ['Orders'],
    responseSchema: z.object({
        order: z.object({
            id: z.string(),
            total: z.number(),
            status: z.string()
        }),
        items: z.array(
            z.object({
                product: z.object({
                    id: z.string(),
                    name: z.string(),
                    price: z.number()
                }),
                quantity: z.number(),
                subtotal: z.number()
            })
        ),
        summary: z.object({
            itemCount: z.number(),
            subtotal: z.number(),
            tax: z.number(),
            total: z.number()
        })
    }),
    handler: async (c: Context) => {
        const orderId = c.req.param('orderId');

        const orderService = new OrderService(c);
        const productService = new ProductService(c);

        // Get order
        const orderResult = await orderService.findById({ id: orderId });
        if (!orderResult.success) {
            throw new Error('Order not found');
        }

        const order = orderResult.data;

        // Get products for each order item
        const items = await Promise.all(
            order.items.map(async (item) => {
                const product = await productService.findById({ id: item.productId });
                return {
                    product: {
                        id: product.data.id,
                        name: product.data.name,
                        price: product.data.price
                    },
                    quantity: item.quantity,
                    subtotal: product.data.price * item.quantity
                };
            })
        );

        // Calculate summary
        const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
        const tax = subtotal * 0.21; // 21% tax
        const total = subtotal + tax;

        return {
            order: {
                id: order.id,
                total: order.total,
                status: order.status
            },
            items,
            summary: {
                itemCount: items.length,
                subtotal,
                tax,
                total
            }
        };
    },
    options: { skipAuth: false }
});
