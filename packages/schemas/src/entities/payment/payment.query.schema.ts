import { z } from 'zod';
import { HttpPaginationSchema, HttpSortingSchema, HttpQueryFields } from '../../api/http/base-http.schema.js';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { type OpenApiSchemaMetadata, applyOpenApiMetadata } from '../../utils/openapi.utils.js';
import { PaymentPlanSchema } from './payment-plan.schema.js';
import { PaymentSchema } from './payment.schema.js';
import { SubscriptionSchema } from './subscription.schema.js';

/**
 * Payment Query Schemas
 *
 * Standardized query schemas for payment operations following the unified pattern:
 * - BaseSearchSchema: Provides page/pageSize pagination, sortBy/sortOrder sorting, and 'q' search
 * - Entity-specific filters: Additional filtering options for payments, payment plans, and subscriptions
 * - PaginationResultSchema: Unified response format with data array and pagination metadata
 */

// ============================================================================
// PAYMENT FILTER SCHEMAS
// ============================================================================

/**
 * Payment-specific filters that extend the base search functionality
 */
export const PaymentFiltersSchema = z.object({
    // Entity relation filters
    userId: z.string().uuid().optional(),
    planId: z.string().uuid().optional(),
    userIds: z.array(z.string().uuid()).optional(),
    planIds: z.array(z.string().uuid()).optional(),

    // Status filters
    status: z
        .enum(['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'])
        .optional(),
    statuses: z
        .array(z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded']))
        .optional(),

    // Amount filters
    minAmount: z.number().min(0).optional(),
    maxAmount: z.number().min(0).optional(),
    amount: z.number().min(0).optional(),

    // Currency filters
    currency: z.string().length(3).optional(),
    currencies: z.array(z.string().length(3)).optional(),

    // Date filters
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),
    processedAfter: z.date().optional(),
    processedBefore: z.date().optional(),

    // Payment method filters
    paymentMethod: z.string().optional(),
    paymentMethods: z.array(z.string()).optional(),

    // External provider filters
    mpPaymentId: z.string().optional(),
    mpStatus: z.string().optional(),
    stripePaymentIntentId: z.string().optional(),

    // Status flags
    hasRefunds: z.boolean().optional(),
    isRefunded: z.boolean().optional(),
    hasFailed: z.boolean().optional(),
    isCompleted: z.boolean().optional(),

    // Failure analysis
    failureReason: z.string().optional(),
    hasFailureReason: z.boolean().optional(),

    // Metadata filters
    hasMetadata: z.boolean().optional(),
    metadataKey: z.string().optional(),
    metadataValue: z.string().optional()
});

// ============================================================================
// PAYMENT PLAN FILTER SCHEMAS
// ============================================================================

/**
 * PaymentPlan-specific filters that extend the base search functionality
 */
export const PaymentPlanFiltersSchema = z.object({
    // Status filters
    isActive: z.boolean().optional(),
    isPublic: z.boolean().optional(),
    isRecommended: z.boolean().optional(),

    // Price filters
    minPrice: z.number().min(0).optional(),
    maxPrice: z.number().min(0).optional(),
    price: z.number().min(0).optional(),

    // Currency filters
    currency: z.string().length(3).optional(),
    currencies: z.array(z.string().length(3)).optional(),

    // Billing cycle filters
    billingCycle: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
    billingCycles: z.array(z.enum(['monthly', 'quarterly', 'yearly'])).optional(),

    // Feature filters
    hasFeature: z.string().optional(),
    featureCount: z.number().int().min(0).optional(),
    minFeatureCount: z.number().int().min(0).optional(),

    // Popularity filters
    minSubscriberCount: z.number().int().min(0).optional(),
    maxSubscriberCount: z.number().int().min(0).optional(),
    isPopular: z.boolean().optional(),

    // Date filters
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),

    // Category filters
    category: z.string().optional(),
    categories: z.array(z.string()).optional(),

    // Trial filters
    hasTrialPeriod: z.boolean().optional(),
    minTrialDays: z.number().int().min(0).optional(),
    maxTrialDays: z.number().int().min(0).optional()
});

// ============================================================================
// SUBSCRIPTION FILTER SCHEMAS
// ============================================================================

/**
 * Subscription-specific filters that extend the base search functionality
 */
export const SubscriptionFiltersSchema = z.object({
    // Entity relation filters
    userId: z.string().uuid().optional(),
    planId: z.string().uuid().optional(),
    userIds: z.array(z.string().uuid()).optional(),
    planIds: z.array(z.string().uuid()).optional(),

    // Status filters
    status: z.enum(['active', 'cancelled', 'expired', 'suspended', 'pending']).optional(),
    statuses: z
        .array(z.enum(['active', 'cancelled', 'expired', 'suspended', 'pending']))
        .optional(),

    // Date filters
    startedAfter: z.date().optional(),
    startedBefore: z.date().optional(),
    expiresAfter: z.date().optional(),
    expiresBefore: z.date().optional(),
    nextBillingAfter: z.date().optional(),
    nextBillingBefore: z.date().optional(),

    // Renewal filters
    autoRenew: z.boolean().optional(),
    willRenew: z.boolean().optional(),
    hasAutoRenewal: z.boolean().optional(),

    // Trial filters
    isTrialActive: z.boolean().optional(),
    hadTrial: z.boolean().optional(),
    inTrialPeriod: z.boolean().optional(),
    trialEndedAfter: z.date().optional(),
    trialEndedBefore: z.date().optional(),

    // Cancellation filters
    isCancelled: z.boolean().optional(),
    cancelledAfter: z.date().optional(),
    cancelledBefore: z.date().optional(),
    cancellationReason: z.string().optional(),

    // Billing filters
    billingCycle: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
    nextBillingIn: z.number().int().min(0).optional(), // days
    isOverdue: z.boolean().optional(),

    // Usage filters
    hasUsageData: z.boolean().optional(),
    isOverUsageLimit: z.boolean().optional()
});

// ============================================================================
// MAIN SEARCH SCHEMAS
// ============================================================================

/**
 * Complete payment search schema combining base search with payment-specific filters
 */
export const PaymentSearchSchema = BaseSearchSchema.extend({
    filters: PaymentFiltersSchema.optional(),
    searchInMetadata: z.boolean().default(false).optional()
});

/**
 * Complete payment plan search schema combining base search with plan-specific filters
 */
export const PaymentPlanSearchSchema = BaseSearchSchema.extend({
    filters: PaymentPlanFiltersSchema.optional(),
    includeInactive: z.boolean().default(false).optional()
});

/**
 * Complete subscription search schema combining base search with subscription-specific filters
 */
export const SubscriptionSearchSchema = BaseSearchSchema.extend({
    filters: SubscriptionFiltersSchema.optional(),
    includeExpired: z.boolean().default(false).optional(),
    groupByStatus: z.boolean().default(false).optional()
});

// ============================================================================
// SPECIALIZED QUERY SCHEMAS
// ============================================================================

/**
 * Schema for listing payments by user
 */
export const PaymentsByUserSchema = z.object({
    userId: z.string().uuid(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10),
    sortBy: z.enum(['createdAt', 'amount', 'status']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    status: z
        .enum(['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'])
        .optional()
});

/**
 * Schema for payment statistics by period
 */
export const PaymentStatsSchema = z.object({
    dateFrom: z.date().optional(),
    dateTo: z.date().optional(),
    groupBy: z.enum(['day', 'week', 'month', 'year']).default('month'),
    currency: z.string().length(3).optional(),
    planId: z.string().uuid().optional()
});

/**
 * Schema for subscription analytics
 */
export const SubscriptionAnalyticsSchema = z.object({
    dateFrom: z.date().optional(),
    dateTo: z.date().optional(),
    groupBy: z.enum(['day', 'week', 'month', 'year']).default('month'),
    planId: z.string().uuid().optional(),
    includeChurnMetrics: z.boolean().default(true)
});

// ============================================================================
// RESULT ITEM SCHEMAS
// ============================================================================

/**
 * Payment list item schema - contains essential fields for list display
 */
export const PaymentListItemSchema = PaymentSchema.pick({
    id: true,
    userId: true,
    planId: true,
    amount: true,
    currency: true,
    status: true,
    paymentMethod: true,
    mpPaymentId: true,
    failureReason: true,
    processedAt: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Payment search result item - extends list item with search relevance score
 */
export const PaymentSearchResultItemSchema = PaymentListItemSchema.extend({
    score: z.number().min(0).max(1).optional(),
    matchedFields: z.array(z.string()).optional()
});

/**
 * PaymentPlan list item schema - contains essential fields for list display
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
    isRecommended: true,
    trialPeriodDays: true,
    subscriberCount: true,
    createdAt: true,
    updatedAt: true
});

/**
 * PaymentPlan search result item - extends list item with search relevance score
 */
export const PaymentPlanSearchResultItemSchema = PaymentPlanListItemSchema.extend({
    score: z.number().min(0).max(1).optional()
});

/**
 * Subscription list item schema - contains essential fields for list display
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
    isTrialActive: true,
    cancellationReason: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Subscription search result item - extends list item with search relevance score
 */
export const SubscriptionSearchResultItemSchema = SubscriptionListItemSchema.extend({
    score: z.number().min(0).max(1).optional()
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Payment list response using standardized pagination format
 */
export const PaymentListResponseSchema = PaginationResultSchema(PaymentListItemSchema);

/**
 * Payment search response using standardized pagination format with search results
 */
export const PaymentSearchResponseSchema = PaginationResultSchema(PaymentSearchResultItemSchema);

/**
 * PaymentPlan list response using standardized pagination format
 */
export const PaymentPlanListResponseSchema = PaginationResultSchema(PaymentPlanListItemSchema);

/**
 * PaymentPlan search response using standardized pagination format with search results
 */
export const PaymentPlanSearchResponseSchema = PaginationResultSchema(
    PaymentPlanSearchResultItemSchema
);

/**
 * Subscription list response using standardized pagination format
 */
export const SubscriptionListResponseSchema = PaginationResultSchema(SubscriptionListItemSchema);

/**
 * Subscription search response using standardized pagination format with search results
 */
export const SubscriptionSearchResponseSchema = PaginationResultSchema(
    SubscriptionSearchResultItemSchema
);

// ============================================================================
// SUMMARY AND STATS SCHEMAS
// ============================================================================

/**
 * Payment summary schema for quick display
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
 * PaymentPlan summary schema for quick display
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
 * Subscription summary schema for quick display
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

/**
 * Payment statistics response schema
 */
export const PaymentStatsResponseSchema = z.object({
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
    revenueByPeriod: z
        .array(
            z.object({
                period: z.string(),
                revenue: z.number().min(0),
                paymentCount: z.number().int().min(0)
            })
        )
        .optional(),

    // Payment method distribution
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
 * Subscription analytics response schema
 */
export const SubscriptionAnalyticsResponseSchema = z.object({
    totalSubscriptions: z.number().int().min(0).default(0),
    activeSubscriptions: z.number().int().min(0).default(0),
    cancelledSubscriptions: z.number().int().min(0).default(0),

    // Churn and retention metrics
    churnRate: z.number().min(0).max(1).default(0),
    retentionRate: z.number().min(0).max(1).default(0),

    // Revenue metrics
    monthlyRecurringRevenue: z.number().min(0).default(0),
    annualRecurringRevenue: z.number().min(0).default(0),
    averageRevenuePerUser: z.number().min(0).default(0),

    // Plan distribution
    planDistribution: z.record(z.string(), z.number().int().min(0)).optional(),

    // Growth metrics by period
    growthByPeriod: z
        .array(
            z.object({
                period: z.string(),
                newSubscriptions: z.number().int().min(0),
                cancellations: z.number().int().min(0),
                netGrowth: z.number(),
                churnRate: z.number().min(0).max(1)
            })
        )
        .optional(),

    // Current period summary
    currentPeriod: z
        .object({
            newSubscriptions: z.number().int().min(0).default(0),
            cancellations: z.number().int().min(0).default(0),
            netGrowthRate: z.number().default(0)
        })
        .optional()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PaymentFilters = z.infer<typeof PaymentFiltersSchema>;
export type PaymentPlanFilters = z.infer<typeof PaymentPlanFiltersSchema>;
export type SubscriptionFilters = z.infer<typeof SubscriptionFiltersSchema>;

export type PaymentSearchInput = z.infer<typeof PaymentSearchSchema>;
export type PaymentPlanSearchInput = z.infer<typeof PaymentPlanSearchSchema>;
export type SubscriptionSearchInput = z.infer<typeof SubscriptionSearchSchema>;

export type PaymentsByUserInput = z.infer<typeof PaymentsByUserSchema>;
export type PaymentStatsInput = z.infer<typeof PaymentStatsSchema>;
export type SubscriptionAnalyticsInput = z.infer<typeof SubscriptionAnalyticsSchema>;

export type PaymentListItem = z.infer<typeof PaymentListItemSchema>;
export type PaymentSearchResultItem = z.infer<typeof PaymentSearchResultItemSchema>;
export type PaymentPlanListItem = z.infer<typeof PaymentPlanListItemSchema>;
export type PaymentPlanSearchResultItem = z.infer<typeof PaymentPlanSearchResultItemSchema>;
export type SubscriptionListItem = z.infer<typeof SubscriptionListItemSchema>;
export type SubscriptionSearchResultItem = z.infer<typeof SubscriptionSearchResultItemSchema>;

export type PaymentListResponse = z.infer<typeof PaymentListResponseSchema>;
export type PaymentSearchResponse = z.infer<typeof PaymentSearchResponseSchema>;
export type PaymentPlanListResponse = z.infer<typeof PaymentPlanListResponseSchema>;
export type PaymentPlanSearchResponse = z.infer<typeof PaymentPlanSearchResponseSchema>;
export type SubscriptionListResponse = z.infer<typeof SubscriptionListResponseSchema>;
export type SubscriptionSearchResponse = z.infer<typeof SubscriptionSearchResponseSchema>;

export type PaymentSummary = z.infer<typeof PaymentSummarySchema>;
export type PaymentPlanSummary = z.infer<typeof PaymentPlanSummarySchema>;
export type SubscriptionSummary = z.infer<typeof SubscriptionSummarySchema>;

export type PaymentStatsResponse = z.infer<typeof PaymentStatsResponseSchema>;
export type SubscriptionAnalyticsResponse = z.infer<typeof SubscriptionAnalyticsResponseSchema>;

// Compatibility aliases for existing code
export type PaymentListInput = PaymentSearchInput;
export type PaymentListOutput = PaymentListResponse;
export type PaymentSearchOutput = PaymentSearchResponse;

export type PaymentPlanListInput = PaymentPlanSearchInput;
export type PaymentPlanListOutput = PaymentPlanListResponse;
export type PaymentPlanSearchOutput = PaymentPlanSearchResponse;

export type SubscriptionListInput = SubscriptionSearchInput;
export type SubscriptionListOutput = SubscriptionListResponse;
export type SubscriptionSearchOutput = SubscriptionSearchResponse;

export type PaymentStats = PaymentStatsResponse;
export type SubscriptionStats = SubscriptionAnalyticsResponse;

// Legacy compatibility exports
export const PaymentListInputSchema = PaymentSearchSchema;
export const PaymentListOutputSchema = PaymentListResponseSchema;
export const PaymentSearchInputSchema = PaymentSearchSchema;
export const PaymentSearchOutputSchema = PaymentSearchResponseSchema;

export const PaymentPlanListInputSchema = PaymentPlanSearchSchema;
export const PaymentPlanListOutputSchema = PaymentPlanListResponseSchema;
export const PaymentPlanSearchInputSchema = PaymentPlanSearchSchema;
export const PaymentPlanSearchOutputSchema = PaymentPlanSearchResponseSchema;

export const SubscriptionListInputSchema = SubscriptionSearchSchema;
export const SubscriptionListOutputSchema = SubscriptionListResponseSchema;
export const SubscriptionSearchInputSchema = SubscriptionSearchSchema;
export const SubscriptionSearchOutputSchema = SubscriptionSearchResponseSchema;

export const PaymentStatsResponseSchemaLegacy = PaymentStatsResponseSchema;
export const SubscriptionStatsSchema = SubscriptionAnalyticsResponseSchema;

// Additional missing legacy exports
export const PaymentSearchResultSchema = PaymentSearchResponseSchema;

// ============================================================================
// HTTP-COMPATIBLE SCHEMAS
// ============================================================================

/**
 * HTTP-compatible payment search schema with query string coercion
 */
export const HttpPaymentSearchSchema = HttpPaginationSchema.merge(HttpSortingSchema).extend({
    // Search
    q: z.string().optional(),

    // Entity relation filters
    userId: z.string().uuid().optional(),
    planId: z.string().uuid().optional(),

    // Status filters
    status: z
        .enum(['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'])
        .optional(),

    // Amount filters with coercion
    minAmount: HttpQueryFields.minAmount(),
    maxAmount: HttpQueryFields.maxAmount(),
    amount: HttpQueryFields.amount(),

    // Currency filters
    currency: z.string().length(3).optional(),

    // Date filters with coercion
    createdAfter: HttpQueryFields.createdAfter(),
    createdBefore: HttpQueryFields.createdBefore(),
    processedAfter: HttpQueryFields.processedAfter(),
    processedBefore: HttpQueryFields.processedBefore(),

    // Method filters
    paymentMethod: z.string().optional(),

    // Array filters (comma-separated)
    userIds: z
        .string()
        .transform((val) => val.split(',').filter(Boolean))
        .optional(),
    planIds: z
        .string()
        .transform((val) => val.split(',').filter(Boolean))
        .optional(),
    statuses: z
        .string()
        .transform((val) => val.split(',').filter(Boolean))
        .optional(),
    currencies: z
        .string()
        .transform((val) => val.split(',').filter(Boolean))
        .optional()
});

export type HttpPaymentSearch = z.infer<typeof HttpPaymentSearchSchema>;

// ============================================================================
// OPENAPI METADATA
// ============================================================================

/**
 * OpenAPI metadata for payment search schema
 */
export const PAYMENT_SEARCH_METADATA: OpenApiSchemaMetadata = {
    ref: 'PaymentSearch',
    description: 'Schema for searching and filtering payments with comprehensive financial filters',
    title: 'Payment Search Parameters',
    example: {
        page: 1,
        pageSize: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        q: 'subscription',
        status: 'completed',
        minAmount: 10,
        maxAmount: 1000,
        currency: 'USD',
        userId: '123e4567-e89b-12d3-a456-426614174000',
        createdAfter: '2025-01-01T00:00:00Z'
    },
    fields: {
        page: {
            description: 'Page number (1-based)',
            example: 1,
            minimum: 1
        },
        pageSize: {
            description: 'Number of items per page',
            example: 20,
            minimum: 1,
            maximum: 100
        },
        q: {
            description: 'Search query (searches description, reference)',
            example: 'subscription',
            maxLength: 100
        },
        status: {
            description: 'Filter by payment status',
            example: 'completed',
            enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded']
        },
        minAmount: {
            description: 'Minimum payment amount',
            example: 10,
            minimum: 0
        },
        maxAmount: {
            description: 'Maximum payment amount',
            example: 1000,
            minimum: 0
        },
        currency: {
            description: 'Filter by currency code (ISO 4217)',
            example: 'USD',
            minLength: 3,
            maxLength: 3
        },
        userId: {
            description: 'Filter by user UUID',
            example: '123e4567-e89b-12d3-a456-426614174000',
            format: 'uuid'
        },
        createdAfter: {
            description: 'Filter payments created after this date',
            example: '2025-01-01T00:00:00Z',
            format: 'date-time'
        }
    },
    tags: ['payments', 'search']
};

/**
 * Payment search schema with OpenAPI metadata applied
 */
export const PaymentSearchSchemaWithMetadata = applyOpenApiMetadata(
    HttpPaymentSearchSchema,
    PAYMENT_SEARCH_METADATA
);
