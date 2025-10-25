import { z } from 'zod';
import { ClientIdSchema, PricingPlanIdSchema } from '../../common/id.schema.js';

/**
 * Purchase Query Schema
 *
 * Schema for filtering and searching purchases with various criteria.
 */
export const PurchaseQuerySchema = z.object({
    // Filtering by relationships
    clientId: ClientIdSchema.optional(),
    pricingPlanId: PricingPlanIdSchema.optional(),

    // Date range filtering for purchase date
    purchasedAtFrom: z.coerce.date().optional(),
    purchasedAtTo: z.coerce.date().optional(),

    // Amount filtering (if needed for future extensions)
    amountFrom: z.coerce.number().optional(),
    amountTo: z.coerce.number().optional(),

    // Pagination and sorting
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(['createdAt', 'purchasedAt', 'clientId']).default('purchasedAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),

    // Lifecycle and audit
    includeDeleted: z.boolean().default(false),
    createdAfter: z.coerce.date().optional(),
    createdBefore: z.coerce.date().optional()
});

export type PurchaseQuery = z.infer<typeof PurchaseQuerySchema>;

/**
 * Purchase List Query Schema
 *
 * Simplified schema for basic purchase listing with minimal filters.
 */
export const PurchaseListQuerySchema = PurchaseQuerySchema.pick({
    clientId: true,
    page: true,
    pageSize: true,
    sortBy: true,
    sortOrder: true,
    includeDeleted: true
});

export type PurchaseListQuery = z.infer<typeof PurchaseListQuerySchema>;

/**
 * Purchase Stats Query Schema
 *
 * Schema for purchase statistics and aggregation queries.
 */
export const PurchaseStatsQuerySchema = z.object({
    clientId: ClientIdSchema.optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    groupBy: z.enum(['day', 'month', 'pricingPlan', 'client']).default('month')
});

export type PurchaseStatsQuery = z.infer<typeof PurchaseStatsQuerySchema>;
