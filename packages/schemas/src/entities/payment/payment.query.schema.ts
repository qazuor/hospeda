import { z } from 'zod';
import { BaseSearchSchema, PaginationSchema } from '../../common/search.schemas.js';
import { PaymentPlanSchema } from './payment-plan.schema.js';
import { PaymentSchema } from './payment.schema.js';
import { SubscriptionSchema } from './subscription.schema.js';

/**
 * Payment Query Schemas
 *
 * This file contains all schemas related to querying payments:
 * - Payment List/Search/Summary/Stats
 * - PaymentPlan List/Search/Summary/Stats
 * - Subscription List/Search/Summary/Stats
 * - Filters for all entities
 */

// ============================================================================
// PAYMENT FILTER SCHEMAS
// ============================================================================

/**
 * Schema for payment-specific filters
 * Used in list and search operations
 */
export const PaymentFiltersSchema = z.object({
    // Status filters
    status: z
        .enum(['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'], {
            message: 'zodError.payment.filters.status.enum'
        })
        .optional(),

    statuses: z
        .array(z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded']))
        .optional(),

    // User filters
    userId: z
        .string({
            message: 'zodError.payment.filters.userId.invalidType'
        })
        .uuid({ message: 'zodError.payment.filters.userId.uuid' })
        .optional(),

    userIds: z.array(z.string().uuid()).optional(),

    // Plan filters
    planId: z
        .string({
            message: 'zodError.payment.filters.planId.invalidType'
        })
        .uuid({ message: 'zodError.payment.filters.planId.uuid' })
        .optional(),

    planIds: z.array(z.string().uuid()).optional(),

    // Amount filters
    minAmount: z
        .number({
            message: 'zodError.payment.filters.minAmount.invalidType'
        })
        .min(0, { message: 'zodError.payment.filters.minAmount.min' })
        .optional(),

    maxAmount: z
        .number({
            message: 'zodError.payment.filters.maxAmount.invalidType'
        })
        .min(0, { message: 'zodError.payment.filters.maxAmount.min' })
        .optional(),

    // Currency filters
    currency: z
        .string({
            message: 'zodError.payment.filters.currency.invalidType'
        })
        .length(3, { message: 'zodError.payment.filters.currency.length' })
        .optional(),

    currencies: z.array(z.string().length(3)).optional(),

    // Date filters
    createdAfter: z
        .date({
            message: 'zodError.payment.filters.createdAfter.invalidType'
        })
        .optional(),

    createdBefore: z
        .date({
            message: 'zodError.payment.filters.createdBefore.invalidType'
        })
        .optional(),

    // Payment method filters
    paymentMethod: z
        .string({
            message: 'zodError.payment.filters.paymentMethod.invalidType'
        })
        .optional(),

    paymentMethods: z.array(z.string()).optional(),

    // Mercado Pago specific filters
    mpPaymentId: z
        .string({
            message: 'zodError.payment.filters.mpPaymentId.invalidType'
        })
        .optional(),

    mpStatus: z
        .string({
            message: 'zodError.payment.filters.mpStatus.invalidType'
        })
        .optional(),

    // Refund filters
    hasRefunds: z
        .boolean({
            message: 'zodError.payment.filters.hasRefunds.invalidType'
        })
        .optional(),

    isRefunded: z
        .boolean({
            message: 'zodError.payment.filters.isRefunded.invalidType'
        })
        .optional(),

    // Failure filters
    hasFailed: z
        .boolean({
            message: 'zodError.payment.filters.hasFailed.invalidType'
        })
        .optional(),

    failureReason: z
        .string({
            message: 'zodError.payment.filters.failureReason.invalidType'
        })
        .optional()
});

// ============================================================================
// PAYMENT PLAN FILTER SCHEMAS
// ============================================================================

/**
 * Schema for payment plan-specific filters
 * Used in list and search operations
 */
export const PaymentPlanFiltersSchema = z.object({
    // Status filters
    isActive: z
        .boolean({
            message: 'zodError.paymentPlan.filters.isActive.invalidType'
        })
        .optional(),

    // Price filters
    minPrice: z
        .number({
            message: 'zodError.paymentPlan.filters.minPrice.invalidType'
        })
        .min(0, { message: 'zodError.paymentPlan.filters.minPrice.min' })
        .optional(),

    maxPrice: z
        .number({
            message: 'zodError.paymentPlan.filters.maxPrice.invalidType'
        })
        .min(0, { message: 'zodError.paymentPlan.filters.maxPrice.min' })
        .optional(),

    // Currency filters
    currency: z
        .string({
            message: 'zodError.paymentPlan.filters.currency.invalidType'
        })
        .length(3, { message: 'zodError.paymentPlan.filters.currency.length' })
        .optional(),

    // Billing cycle filters
    billingCycle: z
        .enum(['monthly', 'quarterly', 'yearly'], {
            message: 'zodError.paymentPlan.filters.billingCycle.enum'
        })
        .optional(),

    billingCycles: z.array(z.enum(['monthly', 'quarterly', 'yearly'])).optional(),

    // Feature filters
    hasFeature: z
        .string({
            message: 'zodError.paymentPlan.filters.hasFeature.invalidType'
        })
        .optional(),

    // Date filters
    createdAfter: z
        .date({
            message: 'zodError.paymentPlan.filters.createdAfter.invalidType'
        })
        .optional(),

    createdBefore: z
        .date({
            message: 'zodError.paymentPlan.filters.createdBefore.invalidType'
        })
        .optional(),

    // Popularity filters
    minSubscriberCount: z
        .number({
            message: 'zodError.paymentPlan.filters.minSubscriberCount.invalidType'
        })
        .int({ message: 'zodError.paymentPlan.filters.minSubscriberCount.int' })
        .min(0, { message: 'zodError.paymentPlan.filters.minSubscriberCount.min' })
        .optional(),

    isPopular: z
        .boolean({
            message: 'zodError.paymentPlan.filters.isPopular.invalidType'
        })
        .optional()
});

// ============================================================================
// SUBSCRIPTION FILTER SCHEMAS
// ============================================================================

/**
 * Schema for subscription-specific filters
 * Used in list and search operations
 */
export const SubscriptionFiltersSchema = z.object({
    // Status filters
    status: z
        .enum(['active', 'cancelled', 'expired', 'suspended'], {
            message: 'zodError.subscription.filters.status.enum'
        })
        .optional(),

    statuses: z.array(z.enum(['active', 'cancelled', 'expired', 'suspended'])).optional(),

    // User filters
    userId: z
        .string({
            message: 'zodError.subscription.filters.userId.invalidType'
        })
        .uuid({ message: 'zodError.subscription.filters.userId.uuid' })
        .optional(),

    userIds: z.array(z.string().uuid()).optional(),

    // Plan filters
    planId: z
        .string({
            message: 'zodError.subscription.filters.planId.invalidType'
        })
        .uuid({ message: 'zodError.subscription.filters.planId.uuid' })
        .optional(),

    planIds: z.array(z.string().uuid()).optional(),

    // Date filters
    startedAfter: z
        .date({
            message: 'zodError.subscription.filters.startedAfter.invalidType'
        })
        .optional(),

    startedBefore: z
        .date({
            message: 'zodError.subscription.filters.startedBefore.invalidType'
        })
        .optional(),

    expiresAfter: z
        .date({
            message: 'zodError.subscription.filters.expiresAfter.invalidType'
        })
        .optional(),

    expiresBefore: z
        .date({
            message: 'zodError.subscription.filters.expiresBefore.invalidType'
        })
        .optional(),

    // Billing filters
    nextBillingAfter: z
        .date({
            message: 'zodError.subscription.filters.nextBillingAfter.invalidType'
        })
        .optional(),

    nextBillingBefore: z
        .date({
            message: 'zodError.subscription.filters.nextBillingBefore.invalidType'
        })
        .optional(),

    // Renewal filters
    autoRenew: z
        .boolean({
            message: 'zodError.subscription.filters.autoRenew.invalidType'
        })
        .optional(),

    // Trial filters
    isTrialActive: z
        .boolean({
            message: 'zodError.subscription.filters.isTrialActive.invalidType'
        })
        .optional(),

    hadTrial: z
        .boolean({
            message: 'zodError.subscription.filters.hadTrial.invalidType'
        })
        .optional(),

    // Cancellation filters
    isCancelled: z
        .boolean({
            message: 'zodError.subscription.filters.isCancelled.invalidType'
        })
        .optional(),

    cancelledAfter: z
        .date({
            message: 'zodError.subscription.filters.cancelledAfter.invalidType'
        })
        .optional(),

    cancelledBefore: z
        .date({
            message: 'zodError.subscription.filters.cancelledBefore.invalidType'
        })
        .optional()
});

// ============================================================================
// PAYMENT LIST SCHEMAS
// ============================================================================

/**
 * Schema for payment list input parameters
 * Includes pagination and filters
 */
export const PaymentListInputSchema = PaginationSchema.extend({
    filters: PaymentFiltersSchema.optional(),
    sortBy: z
        .enum(['createdAt', 'amount', 'status', 'updatedAt'], {
            message: 'zodError.payment.list.sortBy.enum'
        })
        .optional()
        .default('createdAt'),
    sortOrder: z
        .enum(['asc', 'desc'], {
            message: 'zodError.payment.list.sortOrder.enum'
        })
        .optional()
        .default('desc'),
    groupByStatus: z
        .boolean({
            message: 'zodError.payment.list.groupByStatus.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for individual payment items in lists
 * Contains essential fields for list display
 */
export const PaymentListItemSchema = PaymentSchema.pick({
    id: true,
    userId: true,
    planId: true,
    amount: true,
    currency: true,
    status: true,
    paymentMethod: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Schema for payment list output
 * Uses generic paginated response with list items
 */
export const PaymentListOutputSchema = z.object({
    items: z.array(PaymentListItemSchema),
    pagination: z.object({
        page: z.number().min(1),
        pageSize: z.number().min(1).max(100),
        total: z.number().min(0),
        totalPages: z.number().min(0)
    }),
    groupedByStatus: z.record(z.string(), z.array(PaymentListItemSchema)).optional()
});

// ============================================================================
// PAYMENT SEARCH SCHEMAS
// ============================================================================

/**
 * Schema for payment search input parameters
 * Extends base search with payment-specific filters
 */
export const PaymentSearchInputSchema = BaseSearchSchema.extend({
    filters: PaymentFiltersSchema.optional(),
    query: z
        .string({
            message: 'zodError.payment.search.query.invalidType'
        })
        .min(1, { message: 'zodError.payment.search.query.min' })
        .max(100, { message: 'zodError.payment.search.query.max' })
        .optional(),
    searchInMetadata: z
        .boolean({
            message: 'zodError.payment.search.searchInMetadata.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for individual payment search results
 * Extends list item with search score
 */
export const PaymentSearchResultSchema = PaymentListItemSchema.extend({
    score: z
        .number({
            message: 'zodError.payment.search.score.invalidType'
        })
        .min(0, { message: 'zodError.payment.search.score.min' })
        .max(1, { message: 'zodError.payment.search.score.max' })
        .optional(),
    matchedFields: z
        .array(z.enum(['id', 'userId', 'planId', 'paymentMethod', 'mpPaymentId']))
        .optional()
});

/**
 * Schema for payment search output
 * Uses generic paginated response with search results
 */
export const PaymentSearchOutputSchema = z.object({
    items: z.array(PaymentSearchResultSchema),
    pagination: z.object({
        page: z.number().min(1),
        pageSize: z.number().min(1).max(100),
        total: z.number().min(0),
        totalPages: z.number().min(0)
    }),
    searchInfo: z
        .object({
            query: z.string().optional(),
            executionTime: z.number().min(0).optional(),
            totalResults: z.number().min(0),
            searchedInMetadata: z.boolean().optional()
        })
        .optional()
});

// ============================================================================
// PAYMENT PLAN LIST/SEARCH SCHEMAS
// ============================================================================

/**
 * Schema for payment plan list input parameters
 */
export const PaymentPlanListInputSchema = PaginationSchema.extend({
    filters: PaymentPlanFiltersSchema.optional(),
    sortBy: z
        .enum(['name', 'price', 'createdAt', 'subscriberCount'], {
            message: 'zodError.paymentPlan.list.sortBy.enum'
        })
        .optional()
        .default('name'),
    sortOrder: z
        .enum(['asc', 'desc'], {
            message: 'zodError.paymentPlan.list.sortOrder.enum'
        })
        .optional()
        .default('asc'),
    includeInactive: z
        .boolean({
            message: 'zodError.paymentPlan.list.includeInactive.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for individual payment plan items in lists
 */
export const PaymentPlanListItemSchema = PaymentPlanSchema.pick({
    id: true,
    slug: true,
    name: true,
    description: true,
    price: true,
    currency: true,
    billingCycle: true,
    isActive: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Schema for payment plan list output
 */
export const PaymentPlanListOutputSchema = z.object({
    items: z.array(PaymentPlanListItemSchema),
    pagination: z.object({
        page: z.number().min(1),
        pageSize: z.number().min(1).max(100),
        total: z.number().min(0),
        totalPages: z.number().min(0)
    })
});

// ============================================================================
// SUBSCRIPTION LIST/SEARCH SCHEMAS
// ============================================================================

/**
 * Schema for subscription list input parameters
 */
export const SubscriptionListInputSchema = PaginationSchema.extend({
    filters: SubscriptionFiltersSchema.optional(),
    sortBy: z
        .enum(['createdAt', 'startDate', 'endDate', 'nextBillingDate', 'status'], {
            message: 'zodError.subscription.list.sortBy.enum'
        })
        .optional()
        .default('createdAt'),
    sortOrder: z
        .enum(['asc', 'desc'], {
            message: 'zodError.subscription.list.sortOrder.enum'
        })
        .optional()
        .default('desc'),
    groupByStatus: z
        .boolean({
            message: 'zodError.subscription.list.groupByStatus.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for individual subscription items in lists
 */
export const SubscriptionListItemSchema = SubscriptionSchema.pick({
    id: true,
    userId: true,
    planId: true,
    status: true,
    startDate: true,
    endDate: true,
    nextBillingDate: true,
    autoRenew: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Schema for subscription list output
 */
export const SubscriptionListOutputSchema = z.object({
    items: z.array(SubscriptionListItemSchema),
    pagination: z.object({
        page: z.number().min(1),
        pageSize: z.number().min(1).max(100),
        total: z.number().min(0),
        totalPages: z.number().min(0)
    }),
    groupedByStatus: z.record(z.string(), z.array(SubscriptionListItemSchema)).optional()
});

// ============================================================================
// SUMMARY SCHEMAS
// ============================================================================

/**
 * Schema for payment summary
 */
export const PaymentSummarySchema = PaymentSchema.pick({
    id: true,
    userId: true,
    planId: true,
    amount: true,
    currency: true,
    status: true,
    paymentMethod: true,
    createdAt: true
});

/**
 * Schema for payment plan summary
 */
export const PaymentPlanSummarySchema = PaymentPlanSchema.pick({
    id: true,
    slug: true,
    name: true,
    description: true,
    price: true,
    currency: true,
    billingCycle: true,
    isActive: true
});

/**
 * Schema for subscription summary
 */
export const SubscriptionSummarySchema = SubscriptionSchema.pick({
    id: true,
    userId: true,
    planId: true,
    status: true,
    startDate: true,
    endDate: true,
    autoRenew: true
});

// ============================================================================
// STATS SCHEMAS
// ============================================================================

/**
 * Schema for payment statistics
 */
export const PaymentStatsSchema = z.object({
    // Basic statistics
    totalPayments: z.number().int().min(0).default(0),
    totalRevenue: z.number().min(0).default(0),
    averagePaymentAmount: z.number().min(0).default(0),

    // Status distribution
    statusDistribution: z.object({
        pending: z.number().int().min(0).default(0),
        processing: z.number().int().min(0).default(0),
        completed: z.number().int().min(0).default(0),
        failed: z.number().int().min(0).default(0),
        cancelled: z.number().int().min(0).default(0),
        refunded: z.number().int().min(0).default(0)
    }),

    // Revenue by period
    revenueByMonth: z
        .array(
            z.object({
                month: z.string(),
                revenue: z.number().min(0),
                paymentCount: z.number().int().min(0)
            })
        )
        .optional(),

    // Payment methods
    paymentMethodDistribution: z.record(z.string(), z.number().int().min(0)).optional(),

    // Refund statistics
    totalRefunds: z.number().int().min(0).default(0),
    totalRefundAmount: z.number().min(0).default(0),
    refundRate: z.number().min(0).max(1).default(0),

    // Failure statistics
    failureRate: z.number().min(0).max(1).default(0),
    topFailureReasons: z
        .array(
            z.object({
                reason: z.string(),
                count: z.number().int().min(0)
            })
        )
        .optional()
});

/**
 * Schema for subscription statistics
 */
export const SubscriptionStatsSchema = z.object({
    // Basic statistics
    totalSubscriptions: z.number().int().min(0).default(0),
    activeSubscriptions: z.number().int().min(0).default(0),
    cancelledSubscriptions: z.number().int().min(0).default(0),

    // Churn and retention
    churnRate: z.number().min(0).max(1).default(0),
    retentionRate: z.number().min(0).max(1).default(0),

    // Revenue metrics
    monthlyRecurringRevenue: z.number().min(0).default(0),
    annualRecurringRevenue: z.number().min(0).default(0),
    averageRevenuePerUser: z.number().min(0).default(0),

    // Plan distribution
    planDistribution: z.record(z.string(), z.number().int().min(0)).optional(),

    // Growth metrics
    newSubscriptionsThisMonth: z.number().int().min(0).default(0),
    cancellationsThisMonth: z.number().int().min(0).default(0),
    netGrowthRate: z.number().default(0)
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PaymentFilters = z.infer<typeof PaymentFiltersSchema>;
export type PaymentPlanFilters = z.infer<typeof PaymentPlanFiltersSchema>;
export type SubscriptionFilters = z.infer<typeof SubscriptionFiltersSchema>;

export type PaymentListInput = z.infer<typeof PaymentListInputSchema>;
export type PaymentListItem = z.infer<typeof PaymentListItemSchema>;
export type PaymentListOutput = z.infer<typeof PaymentListOutputSchema>;
export type PaymentSearchInput = z.infer<typeof PaymentSearchInputSchema>;
export type PaymentSearchResult = z.infer<typeof PaymentSearchResultSchema>;
export type PaymentSearchOutput = z.infer<typeof PaymentSearchOutputSchema>;

export type PaymentPlanListInput = z.infer<typeof PaymentPlanListInputSchema>;
export type PaymentPlanListItem = z.infer<typeof PaymentPlanListItemSchema>;
export type PaymentPlanListOutput = z.infer<typeof PaymentPlanListOutputSchema>;

export type SubscriptionListInput = z.infer<typeof SubscriptionListInputSchema>;
export type SubscriptionListItem = z.infer<typeof SubscriptionListItemSchema>;
export type SubscriptionListOutput = z.infer<typeof SubscriptionListOutputSchema>;

export type PaymentSummary = z.infer<typeof PaymentSummarySchema>;
export type PaymentPlanSummary = z.infer<typeof PaymentPlanSummarySchema>;
export type SubscriptionSummary = z.infer<typeof SubscriptionSummarySchema>;

export type PaymentStats = z.infer<typeof PaymentStatsSchema>;
export type SubscriptionStats = z.infer<typeof SubscriptionStatsSchema>;
