/**
 * Complex Queries Example
 *
 * This file demonstrates advanced querying patterns including:
 * - Dynamic query building
 * - Aggregations and grouping
 * - Pagination strategies (offset and cursor-based)
 * - Transaction handling
 * - Complex filtering
 * - Performance optimization
 *
 * Key Concepts:
 * - Building queries conditionally
 * - Aggregation functions (COUNT, SUM, AVG)
 * - JOIN operations
 * - GROUP BY with HAVING
 * - Cursor-based pagination
 * - Multi-table transactions
 *
 * @example
 * ```ts
 * import { OrderModel } from './complex-queries';
 *
 * const orderModel = new OrderModel();
 *
 * // Search with complex filters
 * const orders = await orderModel.searchOrders({
 *   filters: {
 *     status: 'pending',
 *     minTotal: 100,
 *     dateFrom: '2024-01-01'
 *   }
 * });
 * ```
 */

import { and, between, count, desc, eq, gte, inArray, isNull, lte, sum } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
    integer,
    numeric,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { BaseModel } from '../src/base/base.model';
import { getDb } from '../src/client';
import type * as schema from '../src/schemas/index.js';
import { DbError } from '../src/utils/error';
import { logError, logQuery } from '../src/utils/logger';

// ============================================================================
// 1. ENUMS AND SCHEMAS
// ============================================================================

/**
 * Order status enum
 */
export const orderStatusEnum = pgEnum('order_status', [
    'pending',
    'processing',
    'shipped',
    'delivered',
    'cancelled'
]);

/**
 * Customer table schema
 */
export const customerTable = pgTable('customers', {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 50 }),
    // Audit fields
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at')
});

/**
 * Order table schema
 */
export const orderTable = pgTable('orders', {
    id: uuid('id').defaultRandom().primaryKey(),
    orderNumber: varchar('order_number', { length: 50 }).notNull().unique(),
    customerId: uuid('customer_id')
        .notNull()
        .references(() => customerTable.id, { onDelete: 'restrict' }),
    status: orderStatusEnum('status').default('pending').notNull(),
    subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
    tax: numeric('tax', { precision: 10, scale: 2 }).notNull(),
    total: numeric('total', { precision: 10, scale: 2 }).notNull(),
    notes: text('notes'),
    // Audit fields
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at')
});

/**
 * Order line table schema (order items)
 */
export const orderLineTable = pgTable('order_lines', {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
        .notNull()
        .references(() => orderTable.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').notNull(),
    productName: varchar('product_name', { length: 255 }).notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
    lineTotal: numeric('line_total', { precision: 10, scale: 2 }).notNull(),
    // Audit fields
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// ============================================================================
// 2. TYPE DEFINITIONS
// ============================================================================

export type Customer = typeof customerTable.$inferSelect;
export type Order = typeof orderTable.$inferSelect;
export type OrderLine = typeof orderLineTable.$inferSelect;

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

/**
 * Order search filters
 */
export interface OrderSearchFilters {
    status?: OrderStatus | OrderStatus[];
    customerId?: string;
    minTotal?: number;
    maxTotal?: number;
    dateFrom?: string;
    dateTo?: string;
    orderNumber?: string;
}

/**
 * Order statistics
 */
export interface OrderStats {
    totalOrders: number;
    totalRevenue: string;
    averageOrderValue: string;
    ordersByStatus: Record<OrderStatus, number>;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

/**
 * Cursor-based pagination
 */
export interface CursorResult<T> {
    items: T[];
    nextCursor: string | null;
    hasMore: boolean;
}

// ============================================================================
// 3. ORDER MODEL WITH COMPLEX QUERIES
// ============================================================================

/**
 * Order Model
 *
 * Demonstrates complex query patterns including:
 * - Dynamic filtering
 * - Aggregations
 * - Pagination strategies
 * - Transactions
 * - Performance optimizations
 */
export class OrderModel extends BaseModel<Order> {
    protected table = orderTable;
    protected entityName = 'order';

    protected getTableName(): string {
        return 'orders';
    }

    // ==========================================================================
    // FILTERING AND SEARCH
    // ==========================================================================

    /**
     * Find orders by status
     *
     * @param input - Query input
     * @param input.status - Order status or array of statuses
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to array of orders
     *
     * @example
     * ```ts
     * // Single status
     * const pending = await orderModel.findByStatus({
     *   status: 'pending'
     * });
     *
     * // Multiple statuses
     * const active = await orderModel.findByStatus({
     *   status: ['pending', 'processing']
     * });
     * ```
     */
    async findByStatus(input: {
        status: OrderStatus | OrderStatus[];
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<Order[]> {
        const { status, tx } = input;
        const db = this.getClient(tx);

        try {
            const whereClause = Array.isArray(status)
                ? and(inArray(orderTable.status, status), isNull(orderTable.deletedAt))
                : and(eq(orderTable.status, status), isNull(orderTable.deletedAt));

            const result = await db
                .select()
                .from(orderTable)
                .where(whereClause)
                .orderBy(desc(orderTable.createdAt));

            logQuery(this.entityName, 'findByStatus', { status }, result);
            return result as Order[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findByStatus', { status }, err);
            throw new DbError(this.entityName, 'findByStatus', { status }, err.message);
        }
    }

    /**
     * Find orders within a date range
     *
     * @param input - Query input
     * @param input.startDate - Start date (ISO string)
     * @param input.endDate - End date (ISO string)
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to array of orders
     *
     * @example
     * ```ts
     * const orders = await orderModel.findByDateRange({
     *   startDate: '2024-01-01',
     *   endDate: '2024-01-31'
     * });
     * ```
     */
    async findByDateRange(input: {
        startDate: string;
        endDate: string;
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<Order[]> {
        const { startDate, endDate, tx } = input;
        const db = this.getClient(tx);

        try {
            const whereClause = and(
                between(orderTable.createdAt, new Date(startDate), new Date(endDate)),
                isNull(orderTable.deletedAt)
            );

            const result = await db
                .select()
                .from(orderTable)
                .where(whereClause)
                .orderBy(desc(orderTable.createdAt));

            logQuery(this.entityName, 'findByDateRange', { startDate, endDate }, result);
            return result as Order[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findByDateRange', { startDate, endDate }, err);
            throw new DbError(
                this.entityName,
                'findByDateRange',
                { startDate, endDate },
                err.message
            );
        }
    }

    /**
     * Find orders by customer with pagination
     *
     * @param input - Query input
     * @param input.customerId - Customer ID
     * @param input.options - Pagination options
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to paginated orders
     *
     * @example
     * ```ts
     * const result = await orderModel.findByCustomer({
     *   customerId: 'customer-uuid',
     *   options: { page: 1, pageSize: 10 }
     * });
     * ```
     */
    async findByCustomer(input: {
        customerId: string;
        options?: { page?: number; pageSize?: number };
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<{ items: Order[]; total: number }> {
        const { customerId, options = {}, tx } = input;
        const { page = 1, pageSize = 20 } = options;

        try {
            const result = await this.findAll(
                { customerId, deletedAt: null },
                { page, pageSize },
                tx
            );

            logQuery(this.entityName, 'findByCustomer', { customerId, options }, result);
            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findByCustomer', { customerId, options }, err);
            throw new DbError(
                this.entityName,
                'findByCustomer',
                { customerId, options },
                err.message
            );
        }
    }

    /**
     * Search orders with complex filters
     *
     * Dynamically builds WHERE clause based on provided filters
     *
     * @param input - Query input
     * @param input.filters - Search filters
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to array of orders
     *
     * @example
     * ```ts
     * const orders = await orderModel.searchOrders({
     *   filters: {
     *     status: ['pending', 'processing'],
     *     minTotal: 50,
     *     maxTotal: 500,
     *     dateFrom: '2024-01-01',
     *     customerId: 'customer-uuid'
     *   }
     * });
     * ```
     */
    async searchOrders(input: {
        filters: OrderSearchFilters;
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<Order[]> {
        const { filters, tx } = input;
        const db = this.getClient(tx);

        try {
            // Build WHERE conditions dynamically
            const conditions = [isNull(orderTable.deletedAt)];

            if (filters.status) {
                if (Array.isArray(filters.status)) {
                    conditions.push(inArray(orderTable.status, filters.status));
                } else {
                    conditions.push(eq(orderTable.status, filters.status));
                }
            }

            if (filters.customerId) {
                conditions.push(eq(orderTable.customerId, filters.customerId));
            }

            if (filters.minTotal !== undefined) {
                conditions.push(gte(orderTable.total, filters.minTotal.toString()));
            }

            if (filters.maxTotal !== undefined) {
                conditions.push(lte(orderTable.total, filters.maxTotal.toString()));
            }

            if (filters.dateFrom) {
                conditions.push(gte(orderTable.createdAt, new Date(filters.dateFrom)));
            }

            if (filters.dateTo) {
                conditions.push(lte(orderTable.createdAt, new Date(filters.dateTo)));
            }

            if (filters.orderNumber) {
                conditions.push(eq(orderTable.orderNumber, filters.orderNumber));
            }

            const whereClause = and(...conditions);

            const result = await db
                .select()
                .from(orderTable)
                .where(whereClause)
                .orderBy(desc(orderTable.createdAt));

            logQuery(this.entityName, 'searchOrders', { filters }, result);
            return result as Order[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'searchOrders', { filters }, err);
            throw new DbError(this.entityName, 'searchOrders', { filters }, err.message);
        }
    }

    // ==========================================================================
    // AGGREGATIONS AND STATISTICS
    // ==========================================================================

    /**
     * Get order statistics
     *
     * Calculates total orders, revenue, and average order value
     *
     * @param input - Query input
     * @param input.customerId - Optional customer ID to filter by
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to order statistics
     *
     * @example
     * ```ts
     * // All orders
     * const stats = await orderModel.getOrderStats({});
     * console.log(stats.totalRevenue); // "$12,345.67"
     *
     * // Specific customer
     * const customerStats = await orderModel.getOrderStats({
     *   customerId: 'customer-uuid'
     * });
     * ```
     */
    async getOrderStats(input: {
        customerId?: string;
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<OrderStats> {
        const { customerId, tx } = input;
        const db = this.getClient(tx);

        try {
            // Build WHERE clause
            const conditions = [isNull(orderTable.deletedAt)];
            if (customerId) {
                conditions.push(eq(orderTable.customerId, customerId));
            }
            const whereClause = and(...conditions);

            // Get total orders and revenue
            const [totals] = await db
                .select({
                    totalOrders: count(),
                    totalRevenue: sum(orderTable.total)
                })
                .from(orderTable)
                .where(whereClause);

            // Get orders by status
            const byStatus = await db
                .select({
                    status: orderTable.status,
                    count: count()
                })
                .from(orderTable)
                .where(whereClause)
                .groupBy(orderTable.status);

            const ordersByStatus = byStatus.reduce(
                (acc, row) => {
                    acc[row.status] = Number(row.count);
                    return acc;
                },
                {} as Record<OrderStatus, number>
            );

            // Calculate average
            const totalRevenue = totals.totalRevenue ?? '0';
            const totalOrders = Number(totals.totalOrders) || 1;
            const averageOrderValue = (Number(totalRevenue) / totalOrders).toFixed(2);

            const stats: OrderStats = {
                totalOrders: Number(totals.totalOrders),
                totalRevenue: totalRevenue.toString(),
                averageOrderValue,
                ordersByStatus
            };

            logQuery(this.entityName, 'getOrderStats', { customerId }, stats);
            return stats;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'getOrderStats', { customerId }, err);
            throw new DbError(this.entityName, 'getOrderStats', { customerId }, err.message);
        }
    }

    /**
     * Find pending orders older than specified days
     *
     * @param input - Query input
     * @param input.olderThanDays - Number of days (default: 7)
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to array of old pending orders
     *
     * @example
     * ```ts
     * // Find orders pending for more than 7 days
     * const staleOrders = await orderModel.findPendingOrders({
     *   olderThanDays: 7
     * });
     * ```
     */
    async findPendingOrders(input: {
        olderThanDays?: number;
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<Order[]> {
        const { olderThanDays = 7, tx } = input;
        const db = this.getClient(tx);

        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

            const whereClause = and(
                eq(orderTable.status, 'pending'),
                lte(orderTable.createdAt, cutoffDate),
                isNull(orderTable.deletedAt)
            );

            const result = await db
                .select()
                .from(orderTable)
                .where(whereClause)
                .orderBy(orderTable.createdAt);

            logQuery(this.entityName, 'findPendingOrders', { olderThanDays }, result);
            return result as Order[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findPendingOrders', { olderThanDays }, err);
            throw new DbError(this.entityName, 'findPendingOrders', { olderThanDays }, err.message);
        }
    }

    /**
     * Get top products by order count
     *
     * Joins order lines and groups by product
     *
     * @param input - Query input
     * @param input.limit - Number of top products to return
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to top products
     *
     * @example
     * ```ts
     * const topProducts = await orderModel.getTopProducts({ limit: 10 });
     * topProducts.forEach(p => {
     *   console.log(`${p.productName}: ${p.orderCount} orders`);
     * });
     * ```
     */
    async getTopProducts(input: {
        limit: number;
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<Array<{ productId: string; productName: string; orderCount: number }>> {
        const { limit, tx } = input;
        const db = this.getClient(tx);

        try {
            const result = await db
                .select({
                    productId: orderLineTable.productId,
                    productName: orderLineTable.productName,
                    orderCount: count()
                })
                .from(orderLineTable)
                .groupBy(orderLineTable.productId, orderLineTable.productName)
                .orderBy(desc(count()))
                .limit(limit);

            logQuery(this.entityName, 'getTopProducts', { limit }, result);
            return result.map((row) => ({
                productId: row.productId,
                productName: row.productName,
                orderCount: Number(row.orderCount)
            }));
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'getTopProducts', { limit }, err);
            throw new DbError(this.entityName, 'getTopProducts', { limit }, err.message);
        }
    }

    // ==========================================================================
    // PAGINATION
    // ==========================================================================

    /**
     * Find all orders with offset-based pagination
     *
     * @param input - Query input
     * @param input.page - Page number (1-indexed)
     * @param input.pageSize - Items per page
     * @param input.filters - Optional search filters
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to paginated result
     *
     * @example
     * ```ts
     * const result = await orderModel.findAllPaginated({
     *   page: 2,
     *   pageSize: 20,
     *   filters: { status: 'pending' }
     * });
     *
     * console.log(`Page ${result.page} of ${result.totalPages}`);
     * console.log(`Showing ${result.items.length} of ${result.total} orders`);
     * ```
     */
    async findAllPaginated(input: {
        page: number;
        pageSize: number;
        filters?: OrderSearchFilters;
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<PaginatedResult<Order>> {
        const { page, pageSize, filters = {}, tx } = input;

        try {
            const orders = filters
                ? await this.searchOrders({ filters, tx })
                : (await this.findAll({ deletedAt: null }, { page, pageSize }, tx)).items;

            const total = await this.count({ deletedAt: null }, { tx });
            const totalPages = Math.ceil(total / pageSize);

            const result: PaginatedResult<Order> = {
                items: orders,
                total,
                page,
                pageSize,
                totalPages
            };

            logQuery(this.entityName, 'findAllPaginated', { page, pageSize, filters }, result);
            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findAllPaginated', { page, pageSize, filters }, err);
            throw new DbError(
                this.entityName,
                'findAllPaginated',
                { page, pageSize, filters },
                err.message
            );
        }
    }

    /**
     * Find orders with cursor-based pagination
     *
     * More efficient for large datasets and real-time data
     *
     * @param input - Query input
     * @param input.cursor - Cursor (order ID) to start from
     * @param input.limit - Number of items to return
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to cursor result
     *
     * @example
     * ```ts
     * // First page
     * const page1 = await orderModel.findWithCursor({
     *   cursor: null,
     *   limit: 20
     * });
     *
     * // Next page
     * if (page1.hasMore) {
     *   const page2 = await orderModel.findWithCursor({
     *     cursor: page1.nextCursor,
     *     limit: 20
     *   });
     * }
     * ```
     */
    async findWithCursor(input: {
        cursor: string | null;
        limit: number;
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<CursorResult<Order>> {
        const { cursor, limit, tx } = input;
        const db = this.getClient(tx);

        try {
            const conditions = [isNull(orderTable.deletedAt)];

            // Add cursor condition if provided
            if (cursor) {
                const cursorOrder = await this.findById(cursor, tx);
                if (cursorOrder) {
                    conditions.push(lte(orderTable.createdAt, cursorOrder.createdAt));
                }
            }

            const whereClause = and(...conditions);

            // Fetch one extra to determine if there are more results
            const result = await db
                .select()
                .from(orderTable)
                .where(whereClause)
                .orderBy(desc(orderTable.createdAt))
                .limit(limit + 1);

            const hasMore = result.length > limit;
            const items = hasMore ? result.slice(0, limit) : result;
            const nextCursor = hasMore ? items[items.length - 1].id : null;

            const cursorResult: CursorResult<Order> = {
                items: items as Order[],
                nextCursor,
                hasMore
            };

            logQuery(this.entityName, 'findWithCursor', { cursor, limit }, cursorResult);
            return cursorResult;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findWithCursor', { cursor, limit }, err);
            throw new DbError(this.entityName, 'findWithCursor', { cursor, limit }, err.message);
        }
    }

    // ==========================================================================
    // TRANSACTIONS
    // ==========================================================================

    /**
     * Create order with order lines in a transaction
     *
     * Ensures atomicity - either all inserts succeed or all fail
     *
     * @param input - Query input
     * @param input.orderData - Order data
     * @param input.lines - Order line items
     * @returns Promise resolving to created order with lines
     *
     * @example
     * ```ts
     * const order = await orderModel.createOrderWithLines({
     *   orderData: {
     *     orderNumber: 'ORD-001',
     *     customerId: 'customer-uuid',
     *     status: 'pending',
     *     subtotal: '100.00',
     *     tax: '10.00',
     *     total: '110.00'
     *   },
     *   lines: [
     *     {
     *       productId: 'product-1',
     *       productName: 'Product A',
     *       quantity: 2,
     *       unitPrice: '50.00',
     *       lineTotal: '100.00'
     *     }
     *   ]
     * });
     * ```
     */
    async createOrderWithLines(input: {
        orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;
        lines: Array<Omit<OrderLine, 'id' | 'orderId' | 'createdAt' | 'updatedAt'>>;
    }): Promise<Order & { lines: OrderLine[] }> {
        const { orderData, lines } = input;
        const db = getDb();

        try {
            const result = await db.transaction(async (trx) => {
                // Create order
                const [order] = await trx.insert(orderTable).values(orderData).returning();

                if (!order) {
                    throw new Error('Failed to create order');
                }

                // Create order lines
                const lineValues = lines.map((line) => ({
                    ...line,
                    orderId: order.id
                }));

                const createdLines = await trx
                    .insert(orderLineTable)
                    .values(lineValues)
                    .returning();

                return {
                    ...order,
                    lines: createdLines
                };
            });

            logQuery(this.entityName, 'createOrderWithLines', { orderData, lines }, result);
            return result as Order & { lines: OrderLine[] };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'createOrderWithLines', { orderData, lines }, err);
            throw new DbError(
                this.entityName,
                'createOrderWithLines',
                { orderData, lines },
                err.message
            );
        }
    }

    /**
     * Cancel an order
     *
     * Updates order status and handles related cleanup in a transaction
     *
     * @param input - Query input
     * @param input.orderId - Order ID
     * @returns Promise resolving to cancelled order
     *
     * @example
     * ```ts
     * const cancelled = await orderModel.cancelOrder({
     *   orderId: 'order-uuid'
     * });
     * ```
     */
    async cancelOrder(input: { orderId: string }): Promise<Order> {
        const { orderId } = input;
        const db = getDb();

        try {
            const result = await db.transaction(async (trx) => {
                // Update order status
                const updated = await this.update(
                    { id: orderId },
                    {
                        status: 'cancelled',
                        updatedAt: new Date()
                    } as Partial<Order>,
                    trx
                );

                if (!updated) {
                    throw new Error(`Order not found: ${orderId}`);
                }

                // Additional cleanup logic could go here
                // (e.g., restore product stock, process refunds)

                return updated;
            });

            logQuery(this.entityName, 'cancelOrder', { orderId }, result);
            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'cancelOrder', { orderId }, err);
            throw new DbError(this.entityName, 'cancelOrder', { orderId }, err.message);
        }
    }
}

// ============================================================================
// 4. SINGLETON INSTANCE
// ============================================================================

export const orderModel = new OrderModel();

// ============================================================================
// 5. USAGE EXAMPLES
// ============================================================================

/**
 * USAGE EXAMPLES
 *
 * ============================================================================
 * EXAMPLE 1: Complex filtering
 * ============================================================================
 *
 * ```ts
 * const orders = await orderModel.searchOrders({
 *   filters: {
 *     status: ['pending', 'processing'],
 *     minTotal: 50,
 *     maxTotal: 500,
 *     dateFrom: '2024-01-01',
 *     dateTo: '2024-01-31',
 *     customerId: 'customer-uuid'
 *   }
 * });
 *
 * console.log(`Found ${orders.length} orders`);
 * ```
 *
 * ============================================================================
 * EXAMPLE 2: Aggregations and statistics
 * ============================================================================
 *
 * ```ts
 * const stats = await orderModel.getOrderStats({});
 *
 * console.log(`Total Orders: ${stats.totalOrders}`);
 * console.log(`Total Revenue: $${stats.totalRevenue}`);
 * console.log(`Average Order: $${stats.averageOrderValue}`);
 * console.log(`Pending: ${stats.ordersByStatus.pending}`);
 * console.log(`Delivered: ${stats.ordersByStatus.delivered}`);
 * ```
 *
 * ============================================================================
 * EXAMPLE 3: Offset-based pagination
 * ============================================================================
 *
 * ```ts
 * const page1 = await orderModel.findAllPaginated({
 *   page: 1,
 *   pageSize: 20,
 *   filters: { status: 'pending' }
 * });
 *
 * console.log(`Page ${page1.page} of ${page1.totalPages}`);
 * page1.items.forEach(order => {
 *   console.log(`Order ${order.orderNumber}: $${order.total}`);
 * });
 * ```
 *
 * ============================================================================
 * EXAMPLE 4: Cursor-based pagination
 * ============================================================================
 *
 * ```ts
 * let cursor: string | null = null;
 * const allOrders: Order[] = [];
 *
 * do {
 *   const page = await orderModel.findWithCursor({
 *     cursor,
 *     limit: 50
 *   });
 *
 *   allOrders.push(...page.items);
 *   cursor = page.nextCursor;
 * } while (cursor);
 *
 * console.log(`Fetched ${allOrders.length} total orders`);
 * ```
 *
 * ============================================================================
 * EXAMPLE 5: Creating order with transaction
 * ============================================================================
 *
 * ```ts
 * const order = await orderModel.createOrderWithLines({
 *   orderData: {
 *     orderNumber: 'ORD-12345',
 *     customerId: 'customer-uuid',
 *     status: 'pending',
 *     subtotal: '149.98',
 *     tax: '15.00',
 *     total: '164.98'
 *   },
 *   lines: [
 *     {
 *       productId: 'product-1',
 *       productName: 'Wireless Mouse',
 *       quantity: 1,
 *       unitPrice: '49.99',
 *       lineTotal: '49.99'
 *     },
 *     {
 *       productId: 'product-2',
 *       productName: 'Keyboard',
 *       quantity: 1,
 *       unitPrice: '99.99',
 *       lineTotal: '99.99'
 *     }
 *   ]
 * });
 *
 * console.log(`Created order ${order.orderNumber}`);
 * console.log(`With ${order.lines.length} items`);
 * ```
 *
 * ============================================================================
 * EXAMPLE 6: Top products report
 * ============================================================================
 *
 * ```ts
 * const topProducts = await orderModel.getTopProducts({ limit: 10 });
 *
 * console.log('Top 10 Products:');
 * topProducts.forEach((product, index) => {
 *   console.log(
 *     `${index + 1}. ${product.productName}: ${product.orderCount} orders`
 *   );
 * });
 * ```
 */
