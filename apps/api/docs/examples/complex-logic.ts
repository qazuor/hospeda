/**
 * Complex Business Logic Example
 *
 * This example shows advanced patterns including:
 * - Transaction handling
 * - Complex validation
 * - Multi-step operations
 * - Error recovery
 */

import { InventoryService, OrderService, ProductService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../src/middlewares/actor';
import { createOpenApiRoute } from '../../src/utils/route-factory';

// Create order with inventory check
const createOrderSchema = z.object({
    items: z
        .array(
            z.object({
                productId: z.string().uuid(),
                quantity: z.number().int().positive()
            })
        )
        .nonempty(),
    shippingAddress: z.object({
        street: z.string(),
        city: z.string(),
        zipCode: z.string()
    })
});

export const createOrderRoute = createOpenApiRoute({
    method: 'post',
    path: '/orders',
    summary: 'Create order',
    description: 'Creates order with inventory validation',
    tags: ['Orders'],
    requestBody: createOrderSchema,
    responseSchema: z.object({
        orderId: z.string(),
        total: z.number(),
        status: z.string()
    }),
    handler: async (c: Context, _params, body) => {
        const actor = getActorFromContext(c);

        if (!actor.isAuthenticated) {
            throw new Error('Authentication required');
        }

        const productService = new ProductService(c);
        const orderService = new OrderService(c);
        const inventoryService = new InventoryService(c);

        // Step 1: Validate all products exist and have stock
        const validationResults = await Promise.all(
            body.items.map(async (item) => {
                const product = await productService.findById({
                    id: item.productId
                });

                if (!product.success) {
                    return {
                        valid: false,
                        error: `Product ${item.productId} not found`
                    };
                }

                if (product.data.stock < item.quantity) {
                    return {
                        valid: false,
                        error: `Insufficient stock for ${product.data.name}`
                    };
                }

                return {
                    valid: true,
                    product: product.data,
                    item
                };
            })
        );

        // Check for validation errors
        const errors = validationResults.filter((r) => !r.valid).map((r) => r.error);

        if (errors.length > 0) {
            throw new Error(errors.join(', '));
        }

        // Step 2: Calculate total
        const validItems = validationResults.filter((r) => r.valid);
        const total = validItems.reduce((sum, { product, item }) => {
            return sum + product?.price * item?.quantity;
        }, 0);

        // Step 3: Reserve inventory (prevents race conditions)
        const reservations = await Promise.all(
            validItems.map(({ item }) =>
                inventoryService.reserve({
                    productId: item?.productId,
                    quantity: item?.quantity,
                    userId: actor.userId
                })
            )
        );

        try {
            // Step 4: Create order
            const orderResult = await orderService.create({
                userId: actor.userId,
                items: body.items,
                shippingAddress: body.shippingAddress,
                total,
                status: 'pending'
            });

            if (!orderResult.success) {
                throw new Error(orderResult.error.message);
            }

            // Step 5: Confirm reservations
            await Promise.all(
                reservations.map((reservation) =>
                    inventoryService.confirmReservation(reservation.id)
                )
            );

            return {
                orderId: orderResult.data.id,
                total,
                status: 'pending'
            };
        } catch (error) {
            // Rollback: Release reservations on failure
            await Promise.all(
                reservations.map((reservation) =>
                    inventoryService.releaseReservation(reservation.id)
                )
            );

            throw error;
        }
    }
});

// Complex search with aggregations
const salesReportSchema = z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    groupBy: z.enum(['day', 'week', 'month']).default('day')
});

export const salesReportRoute = createOpenApiRoute({
    method: 'get',
    path: '/reports/sales',
    summary: 'Sales report',
    description: 'Generates sales report with aggregations',
    tags: ['Reports'],
    requestQuery: salesReportSchema,
    responseSchema: z.object({
        period: z.object({
            start: z.string(),
            end: z.string()
        }),
        summary: z.object({
            totalOrders: z.number(),
            totalRevenue: z.number(),
            averageOrderValue: z.number()
        }),
        data: z.array(
            z.object({
                date: z.string(),
                orders: z.number(),
                revenue: z.number()
            })
        )
    }),
    handler: async (c: Context, _params, _body, query) => {
        const actor = getActorFromContext(c);

        // Only admins can view reports
        if (actor.role !== 'admin') {
            throw new Error('Admin access required');
        }

        const orderService = new OrderService(c);

        // Get orders in date range
        const orders = await orderService.findByDateRange({
            startDate: query.startDate,
            endDate: query.endDate
        });

        if (!orders.success) {
            throw new Error(orders.error.message);
        }

        // Aggregate by period
        const aggregated = aggregateByPeriod(orders.data, query.groupBy);

        // Calculate summary
        const totalOrders = orders.data.length;
        const totalRevenue = orders.data.reduce((sum, order) => sum + order.total, 0);
        const averageOrderValue = totalRevenue / totalOrders || 0;

        return {
            period: {
                start: query.startDate,
                end: query.endDate
            },
            summary: {
                totalOrders,
                totalRevenue,
                averageOrderValue
            },
            data: aggregated
        };
    }
});

// Helper function for aggregation
function aggregateByPeriod(
    orders: Array<{ createdAt: Date; total: number }>,
    groupBy: 'day' | 'week' | 'month'
) {
    const grouped = new Map<string, { orders: number; revenue: number }>();

    for (const order of orders) {
        const date = new Date(order.createdAt);
        let key: string;

        switch (groupBy) {
            case 'day':
                key = date.toISOString().split('T')[0];
                break;
            case 'week': {
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                key = weekStart.toISOString().split('T')[0];
                break;
            }
            case 'month':
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                break;
        }

        const existing = grouped.get(key) || { orders: 0, revenue: 0 };
        grouped.set(key, {
            orders: existing.orders + 1,
            revenue: existing.revenue + order.total
        });
    }

    return Array.from(grouped.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));
}
