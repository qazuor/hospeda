import { z } from 'zod';
import { ClientIdSchema, PricingPlanIdSchema } from '../../common/id.schema.js';
import { SubscriptionStatusEnumSchema } from '../../enums/subscription-status.schema.js';

/**
 * Subscription Query Schema
 *
 * Schema for filtering and searching subscriptions with various criteria.
 */
export const SubscriptionQuerySchema = z.object({
    // Filtering by relationships
    clientId: ClientIdSchema.optional(),
    pricingPlanId: PricingPlanIdSchema.optional(),

    // Status filtering
    status: SubscriptionStatusEnumSchema.optional(),
    statuses: z.array(SubscriptionStatusEnumSchema).optional(),

    // Date range filtering
    startAtFrom: z.coerce.date().optional(),
    startAtTo: z.coerce.date().optional(),
    endAtFrom: z.coerce.date().optional(),
    endAtTo: z.coerce.date().optional(),

    // Trial filtering
    hasActiveTrial: z.boolean().optional(),
    trialExpiredBefore: z.coerce.date().optional(),
    trialExpiresAfter: z.coerce.date().optional(),

    // Subscription state flags
    isActive: z.boolean().optional(),
    isExpired: z.boolean().optional(),
    isCancelled: z.boolean().optional(),

    // Pagination and sorting
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(['createdAt', 'startAt', 'endAt', 'status']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),

    // Lifecycle and audit
    includeDeleted: z.boolean().default(false),
    createdAfter: z.coerce.date().optional(),
    createdBefore: z.coerce.date().optional()
});

export type SubscriptionQuery = z.infer<typeof SubscriptionQuerySchema>;

/**
 * Subscription List Query Schema
 *
 * Simplified schema for basic subscription listing with minimal filters.
 */
export const SubscriptionListQuerySchema = SubscriptionQuerySchema.pick({
    clientId: true,
    status: true,
    page: true,
    pageSize: true,
    sortBy: true,
    sortOrder: true,
    includeDeleted: true
});

export type SubscriptionListQuery = z.infer<typeof SubscriptionListQuerySchema>;

/**
 * Subscription Stats Query Schema
 *
 * Schema for subscription statistics and aggregation queries.
 */
export const SubscriptionStatsQuerySchema = z.object({
    clientId: ClientIdSchema.optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    groupBy: z.enum(['status', 'month', 'pricingPlan']).default('status')
});

export type SubscriptionStatsQuery = z.infer<typeof SubscriptionStatsQuerySchema>;
