import { z } from 'zod';

/**
 * Schema for querying billing usage for a specific limit key.
 * Used to fetch current consumption for a named resource limit (e.g. 'accommodation_count').
 *
 * @example
 * ```ts
 * const query: BillingUsageQuery = { limitKey: 'accommodation_count' };
 * ```
 */
export const BillingUsageQuerySchema = z.object({
    /** The limit key identifying the resource to query usage for (e.g. 'accommodation_count') */
    limitKey: z
        .string({
            message: 'zodError.billing.query.usage.limitKey.invalidType'
        })
        .min(1, { message: 'zodError.billing.query.usage.limitKey.min' })
        .max(100, { message: 'zodError.billing.query.usage.limitKey.max' })
});

/** TypeScript type inferred from BillingUsageQuerySchema */
export type BillingUsageQuery = z.infer<typeof BillingUsageQuerySchema>;

/**
 * Schema for querying billing metrics with optional filters.
 * Supports filtering by live/sandbox mode and the number of historical months to include.
 *
 * @example
 * ```ts
 * const query: BillingMetricsQuery = { livemode: true, months: 6 };
 * ```
 */
export const BillingMetricsQuerySchema = z.object({
    /** When true, returns only live-mode data; when false, returns sandbox data */
    livemode: z
        .boolean({
            message: 'zodError.billing.query.metrics.livemode.invalidType'
        })
        .optional(),
    /** Number of historical months to include in the metrics response (1-24) */
    months: z
        .number({
            message: 'zodError.billing.query.metrics.months.invalidType'
        })
        .int({ message: 'zodError.billing.query.metrics.months.int' })
        .min(1, { message: 'zodError.billing.query.metrics.months.min' })
        .max(24, { message: 'zodError.billing.query.metrics.months.max' })
        .optional()
});

/** TypeScript type inferred from BillingMetricsQuerySchema */
export type BillingMetricsQuery = z.infer<typeof BillingMetricsQuerySchema>;
