import { z } from 'zod';
import { ClientIdSchema, DiscountCodeIdSchema } from '../../common/id.schema.js';
import { PaginationSchema } from '../../common/pagination.schema.js';

/**
 * List Discount Code Usages Schema
 * Schema for filtering/searching discount code usage records
 */
export const ListDiscountCodeUsagesSchema = PaginationSchema.extend({
    // Filter by discount code
    discountCodeId: DiscountCodeIdSchema.optional(),

    // Filter by client
    clientId: ClientIdSchema.optional(),

    // Filter by date range
    fromDate: z
        .string()
        .datetime({ message: 'zodError.discountCodeUsage.fromDate.datetime' })
        .optional()
        .or(z.date().optional()),

    toDate: z
        .string()
        .datetime({ message: 'zodError.discountCodeUsage.toDate.datetime' })
        .optional()
        .or(z.date().optional()),

    // Sort options
    sortBy: z.enum(['usageCount', 'firstUsedAt', 'lastUsedAt']).default('lastUsedAt').optional(),

    sortOrder: z.enum(['asc', 'desc']).default('desc').optional()
});

/**
 * Get Usage Stats Query Schema
 * Schema for querying usage statistics
 */
export const GetUsageStatsSchema = z.object({
    discountCodeId: DiscountCodeIdSchema
});

/**
 * Get Usage History Query Schema
 * Schema for querying usage history
 */
export const GetUsageHistorySchema = PaginationSchema.extend({
    discountCodeId: DiscountCodeIdSchema
});

/**
 * Get Usage By Client Query Schema
 * Schema for querying usage by client
 */
export const GetUsageByClientSchema = PaginationSchema.extend({
    clientId: ClientIdSchema
});

/**
 * Get Usage Trends Query Schema
 * Schema for querying usage trends over time
 */
export const GetUsageTrendsSchema = z.object({
    discountCodeId: DiscountCodeIdSchema,
    days: z
        .number()
        .int({ message: 'zodError.discountCodeUsage.days.int' })
        .positive({ message: 'zodError.discountCodeUsage.days.positive' })
        .max(365, { message: 'zodError.discountCodeUsage.days.max' })
        .default(30)
        .optional()
});

/**
 * Get Popular Codes Query Schema
 * Schema for querying popular discount codes
 */
export const GetPopularCodesSchema = z.object({
    limit: z
        .number()
        .int({ message: 'zodError.discountCodeUsage.limit.int' })
        .positive({ message: 'zodError.discountCodeUsage.limit.positive' })
        .max(100, { message: 'zodError.discountCodeUsage.limit.max' })
        .default(10)
        .optional()
});

export type ListDiscountCodeUsages = z.infer<typeof ListDiscountCodeUsagesSchema>;
export type GetUsageStats = z.infer<typeof GetUsageStatsSchema>;
export type GetUsageHistory = z.infer<typeof GetUsageHistorySchema>;
export type GetUsageByClient = z.infer<typeof GetUsageByClientSchema>;
export type GetUsageTrends = z.infer<typeof GetUsageTrendsSchema>;
export type GetPopularCodes = z.infer<typeof GetPopularCodesSchema>;
