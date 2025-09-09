import { z } from 'zod';
import { PaymentPlanSchema } from './payment-plan.schema.js';
import { PaymentSchema } from './payment.schema.js';
import { SubscriptionSchema } from './subscription.schema.js';

/**
 * Payment Relations Schemas
 *
 * This file contains schemas for payments with related entities:
 * - PaymentWithUser
 * - PaymentWithPlan
 * - PaymentWithSubscription
 * - PaymentPlanWithSubscriptions
 * - SubscriptionWithPayments
 * - Full relations schemas
 */

// Import related schemas (these will be created later)
// For now, we'll define basic summary schemas inline to avoid circular dependencies

// ============================================================================
// RELATED ENTITY SUMMARY SCHEMAS
// ============================================================================

/**
 * User summary schema for relations
 * Contains essential user information for payment contexts
 */
const UserSummarySchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    displayName: z.string().optional(),
    avatar: z.string().optional(),
    isActive: z.boolean(),
    createdAt: z.date(),
    subscription: z
        .object({
            status: z.enum(['active', 'cancelled', 'expired', 'suspended']),
            planName: z.string(),
            endDate: z.date().optional()
        })
        .optional()
});

/**
 * Accommodation summary schema for relations
 * Contains essential accommodation information for payment contexts
 */
const AccommodationSummarySchema = z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    type: z.string(),
    location: z
        .object({
            country: z.string(),
            city: z.string()
        })
        .optional(),
    price: z
        .object({
            basePrice: z.number().min(0),
            currency: z.string()
        })
        .optional()
});

// ============================================================================
// PAYMENT WITH RELATIONS SCHEMAS
// ============================================================================

/**
 * Payment with user information
 * Includes detailed user data for payment context
 */
export const PaymentWithUserSchema = PaymentSchema.extend({
    user: UserSummarySchema.optional(),
    userPaymentHistory: z
        .object({
            totalPayments: z.number().int().min(0),
            totalSpent: z.number().min(0),
            averagePaymentAmount: z.number().min(0),
            lastPaymentDate: z.date().optional(),
            preferredPaymentMethod: z.string().optional(),
            failureRate: z.number().min(0).max(1)
        })
        .optional()
});

/**
 * Payment with plan information
 * Includes detailed plan data and features
 */
export const PaymentWithPlanSchema = PaymentSchema.extend({
    plan: PaymentPlanSchema.optional(),
    planFeatures: z
        .array(
            z.object({
                name: z.string(),
                description: z.string().optional(),
                isIncluded: z.boolean(),
                limit: z.number().optional()
            })
        )
        .optional(),
    planUsage: z
        .object({
            totalSubscribers: z.number().int().min(0),
            activeSubscribers: z.number().int().min(0),
            conversionRate: z.number().min(0).max(1),
            averageLifetime: z.number().min(0) // in days
        })
        .optional()
});

/**
 * Payment with subscription information
 * Includes subscription context and history
 */
export const PaymentWithSubscriptionSchema = PaymentSchema.extend({
    subscription: SubscriptionSchema.optional(),
    subscriptionHistory: z
        .array(
            z.object({
                action: z.enum([
                    'created',
                    'renewed',
                    'upgraded',
                    'downgraded',
                    'cancelled',
                    'reactivated'
                ]),
                date: z.date(),
                previousPlanId: z.string().uuid().optional(),
                newPlanId: z.string().uuid().optional(),
                amount: z.number().min(0).optional()
            })
        )
        .optional(),
    relatedPayments: z
        .array(
            PaymentSchema.pick({
                id: true,
                amount: true,
                status: true,
                createdAt: true
            })
        )
        .optional()
});

/**
 * Payment with refund information
 * Includes detailed refund history and status
 */
export const PaymentWithRefundsSchema = PaymentSchema.extend({
    refunds: z
        .array(
            z.object({
                id: z.string().uuid(),
                amount: z.number().min(0),
                reason: z.string(),
                status: z.enum(['pending', 'processing', 'completed', 'failed']),
                processedAt: z.date().optional(),
                mpRefundId: z.string().optional(),
                createdAt: z.date()
            })
        )
        .optional(),
    refundSummary: z
        .object({
            totalRefunded: z.number().min(0),
            refundableAmount: z.number().min(0),
            refundCount: z.number().int().min(0),
            lastRefundDate: z.date().optional()
        })
        .optional()
});

/**
 * Payment with transaction details
 * Includes detailed transaction and processing information
 */
export const PaymentWithTransactionSchema = PaymentSchema.extend({
    transactionDetails: z
        .object({
            processingTime: z.number().min(0).optional(), // in seconds
            attempts: z.number().int().min(1).default(1),
            lastAttemptAt: z.date().optional(),
            failureReason: z.string().optional(),
            processorFee: z.number().min(0).optional(),
            netAmount: z.number().min(0).optional()
        })
        .optional(),
    merchantDetails: z
        .object({
            merchantId: z.string().optional(),
            merchantName: z.string().optional(),
            processorName: z.string().optional(),
            processorVersion: z.string().optional()
        })
        .optional(),
    securityInfo: z
        .object({
            ipAddress: z.string().optional(),
            userAgent: z.string().optional(),
            fraudScore: z.number().min(0).max(100).optional(),
            riskLevel: z.enum(['low', 'medium', 'high']).optional()
        })
        .optional()
});

// ============================================================================
// PAYMENT PLAN WITH RELATIONS SCHEMAS
// ============================================================================

/**
 * Payment plan with subscriptions
 * Includes active and historical subscription data
 */
export const PaymentPlanWithSubscriptionsSchema = PaymentPlanSchema.extend({
    subscriptions: z
        .array(
            SubscriptionSchema.pick({
                id: true,
                userId: true,
                status: true,
                startDate: true,
                endDate: true,
                autoRenew: true,
                createdAt: true
            })
        )
        .optional(),
    subscriptionStats: z
        .object({
            totalSubscriptions: z.number().int().min(0),
            activeSubscriptions: z.number().int().min(0),
            cancelledSubscriptions: z.number().int().min(0),
            churnRate: z.number().min(0).max(1),
            averageLifetime: z.number().min(0), // in days
            monthlyRecurringRevenue: z.number().min(0)
        })
        .optional(),
    recentSubscribers: z.array(UserSummarySchema).optional()
});

/**
 * Payment plan with revenue analytics
 * Includes detailed revenue and performance metrics
 */
export const PaymentPlanWithRevenueSchema = PaymentPlanSchema.extend({
    revenueAnalytics: z
        .object({
            totalRevenue: z.number().min(0),
            monthlyRevenue: z.number().min(0),
            projectedAnnualRevenue: z.number().min(0),
            revenueGrowthRate: z.number(),
            averageRevenuePerUser: z.number().min(0)
        })
        .optional(),
    revenueByMonth: z
        .array(
            z.object({
                month: z.string(),
                revenue: z.number().min(0),
                newSubscriptions: z.number().int().min(0),
                cancellations: z.number().int().min(0),
                netGrowth: z.number()
            })
        )
        .optional(),
    competitorAnalysis: z
        .object({
            marketPosition: z.enum(['premium', 'standard', 'budget']),
            priceCompetitiveness: z.number().min(0).max(100),
            featureCompetitiveness: z.number().min(0).max(100)
        })
        .optional()
});

/**
 * Payment plan with feature usage
 * Includes feature adoption and usage statistics
 */
export const PaymentPlanWithUsageSchema = PaymentPlanSchema.extend({
    featureUsage: z
        .array(
            z.object({
                featureName: z.string(),
                usageCount: z.number().int().min(0),
                usagePercentage: z.number().min(0).max(100),
                averageUsagePerUser: z.number().min(0)
            })
        )
        .optional(),
    accommodationLimits: z
        .object({
            maxAccommodations: z.number().int().min(0),
            currentUsage: z.number().int().min(0),
            averageUsage: z.number().min(0),
            usageDistribution: z.record(z.string(), z.number().int().min(0)).optional()
        })
        .optional(),
    supportMetrics: z
        .object({
            supportTickets: z.number().int().min(0),
            averageResponseTime: z.number().min(0), // in hours
            satisfactionScore: z.number().min(0).max(5).optional()
        })
        .optional()
});

// ============================================================================
// SUBSCRIPTION WITH RELATIONS SCHEMAS
// ============================================================================

/**
 * Subscription with payments
 * Includes payment history and billing information
 */
export const SubscriptionWithPaymentsSchema = SubscriptionSchema.extend({
    payments: z
        .array(
            PaymentSchema.pick({
                id: true,
                amount: true,
                currency: true,
                status: true,
                paymentMethod: true,
                createdAt: true
            })
        )
        .optional(),
    paymentStats: z
        .object({
            totalPaid: z.number().min(0),
            averagePaymentAmount: z.number().min(0),
            paymentCount: z.number().int().min(0),
            lastPaymentDate: z.date().optional(),
            nextPaymentAmount: z.number().min(0).optional(),
            paymentFailures: z.number().int().min(0)
        })
        .optional(),
    billingHistory: z
        .array(
            z.object({
                billingDate: z.date(),
                amount: z.number().min(0),
                status: z.enum(['paid', 'pending', 'failed', 'refunded']),
                paymentId: z.string().uuid().optional(),
                daysLate: z.number().int().min(0).optional()
            })
        )
        .optional()
});

/**
 * Subscription with user and accommodations
 * Includes user context and accommodation usage
 */
export const SubscriptionWithUserSchema = SubscriptionSchema.extend({
    user: UserSummarySchema.optional(),
    accommodations: z.array(AccommodationSummarySchema).optional(),
    accommodationStats: z
        .object({
            totalAccommodations: z.number().int().min(0),
            activeAccommodations: z.number().int().min(0),
            averageRating: z.number().min(0).max(5).optional(),
            totalBookings: z.number().int().min(0),
            totalRevenue: z.number().min(0)
        })
        .optional(),
    usageMetrics: z
        .object({
            loginFrequency: z.number().min(0), // logins per month
            featureUsage: z.record(z.string(), z.number().int().min(0)).optional(),
            lastActivity: z.date().optional(),
            engagementScore: z.number().min(0).max(100).optional()
        })
        .optional()
});

/**
 * Subscription with trial information
 * Includes trial history and conversion data
 */
export const SubscriptionWithTrialSchema = SubscriptionSchema.extend({
    trialInfo: z
        .object({
            hadTrial: z.boolean(),
            trialStartDate: z.date().optional(),
            trialEndDate: z.date().optional(),
            trialDuration: z.number().int().min(0).optional(), // in days
            convertedFromTrial: z.boolean(),
            trialUsage: z
                .object({
                    accommodationsCreated: z.number().int().min(0),
                    featuresUsed: z.array(z.string()).optional(),
                    loginCount: z.number().int().min(0)
                })
                .optional()
        })
        .optional(),
    conversionMetrics: z
        .object({
            timeToConversion: z.number().int().min(0).optional(), // in days
            conversionTrigger: z.string().optional(),
            conversionValue: z.number().min(0).optional()
        })
        .optional()
});

// ============================================================================
// FULL RELATIONS SCHEMAS
// ============================================================================

/**
 * Payment with all relations
 * Includes all possible related data
 */
export const PaymentWithFullRelationsSchema = PaymentSchema.extend({
    // User information
    user: UserSummarySchema.optional(),
    userPaymentHistory: z
        .object({
            totalPayments: z.number().int().min(0),
            totalSpent: z.number().min(0),
            averagePaymentAmount: z.number().min(0),
            preferredPaymentMethod: z.string().optional(),
            failureRate: z.number().min(0).max(1)
        })
        .optional(),

    // Plan information
    plan: PaymentPlanSchema.optional(),
    planFeatures: z
        .array(
            z.object({
                name: z.string(),
                description: z.string().optional(),
                isIncluded: z.boolean()
            })
        )
        .optional(),

    // Subscription information
    subscription: SubscriptionSchema.optional(),
    relatedPayments: z
        .array(
            PaymentSchema.pick({
                id: true,
                amount: true,
                status: true,
                createdAt: true
            })
        )
        .optional(),

    // Refund information
    refunds: z
        .array(
            z.object({
                id: z.string().uuid(),
                amount: z.number().min(0),
                reason: z.string(),
                status: z.enum(['pending', 'processing', 'completed', 'failed']),
                createdAt: z.date()
            })
        )
        .optional(),

    // Transaction details
    transactionDetails: z
        .object({
            processingTime: z.number().min(0).optional(),
            attempts: z.number().int().min(1).default(1),
            processorFee: z.number().min(0).optional(),
            netAmount: z.number().min(0).optional()
        })
        .optional()
});

/**
 * Payment plan with all relations
 * Includes all possible related data
 */
export const PaymentPlanWithFullRelationsSchema = PaymentPlanSchema.extend({
    // Subscription data
    subscriptions: z
        .array(
            SubscriptionSchema.pick({
                id: true,
                userId: true,
                status: true,
                startDate: true,
                endDate: true,
                createdAt: true
            })
        )
        .optional(),
    subscriptionStats: z
        .object({
            totalSubscriptions: z.number().int().min(0),
            activeSubscriptions: z.number().int().min(0),
            churnRate: z.number().min(0).max(1),
            monthlyRecurringRevenue: z.number().min(0)
        })
        .optional(),

    // Revenue analytics
    revenueAnalytics: z
        .object({
            totalRevenue: z.number().min(0),
            monthlyRevenue: z.number().min(0),
            revenueGrowthRate: z.number(),
            averageRevenuePerUser: z.number().min(0)
        })
        .optional(),

    // Feature usage
    featureUsage: z
        .array(
            z.object({
                featureName: z.string(),
                usageCount: z.number().int().min(0),
                usagePercentage: z.number().min(0).max(100)
            })
        )
        .optional(),

    // Recent subscribers
    recentSubscribers: z.array(UserSummarySchema).optional()
});

/**
 * Subscription with all relations
 * Includes all possible related data
 */
export const SubscriptionWithFullRelationsSchema = SubscriptionSchema.extend({
    // User information
    user: UserSummarySchema.optional(),
    accommodations: z.array(AccommodationSummarySchema).optional(),

    // Plan information
    plan: PaymentPlanSchema.optional(),

    // Payment history
    payments: z
        .array(
            PaymentSchema.pick({
                id: true,
                amount: true,
                currency: true,
                status: true,
                paymentMethod: true,
                createdAt: true
            })
        )
        .optional(),
    paymentStats: z
        .object({
            totalPaid: z.number().min(0),
            paymentCount: z.number().int().min(0),
            lastPaymentDate: z.date().optional(),
            paymentFailures: z.number().int().min(0)
        })
        .optional(),

    // Trial information
    trialInfo: z
        .object({
            hadTrial: z.boolean(),
            trialStartDate: z.date().optional(),
            trialEndDate: z.date().optional(),
            convertedFromTrial: z.boolean()
        })
        .optional(),

    // Usage metrics
    usageMetrics: z
        .object({
            totalAccommodations: z.number().int().min(0),
            loginFrequency: z.number().min(0),
            lastActivity: z.date().optional(),
            engagementScore: z.number().min(0).max(100).optional()
        })
        .optional()
});

// ============================================================================
// ANALYTICS SCHEMAS
// ============================================================================

/**
 * Payment analytics input schema
 * Parameters for generating payment analytics
 */
export const PaymentAnalyticsInputSchema = z.object({
    dateRange: z.object({
        startDate: z.date(),
        endDate: z.date()
    }),
    groupBy: z
        .enum(['day', 'week', 'month', 'quarter'], {
            message: 'zodError.payment.analytics.groupBy.enum'
        })
        .optional()
        .default('month'),
    includeRefunds: z
        .boolean({
            message: 'zodError.payment.analytics.includeRefunds.invalidType'
        })
        .optional()
        .default(true),
    currency: z
        .string({
            message: 'zodError.payment.analytics.currency.invalidType'
        })
        .length(3, { message: 'zodError.payment.analytics.currency.length' })
        .optional(),
    planIds: z.array(z.string().uuid()).optional()
});

/**
 * Payment analytics output schema
 * Returns comprehensive payment analytics
 */
export const PaymentAnalyticsOutputSchema = z.object({
    summary: z.object({
        totalRevenue: z.number().min(0),
        totalPayments: z.number().int().min(0),
        averagePaymentAmount: z.number().min(0),
        successRate: z.number().min(0).max(1),
        refundRate: z.number().min(0).max(1)
    }),
    timeSeriesData: z.array(
        z.object({
            period: z.string(),
            revenue: z.number().min(0),
            paymentCount: z.number().int().min(0),
            refundAmount: z.number().min(0),
            successRate: z.number().min(0).max(1)
        })
    ),
    planBreakdown: z
        .array(
            z.object({
                planId: z.string().uuid(),
                planName: z.string(),
                revenue: z.number().min(0),
                paymentCount: z.number().int().min(0),
                subscriberCount: z.number().int().min(0)
            })
        )
        .optional(),
    paymentMethodBreakdown: z
        .record(
            z.string(),
            z.object({
                count: z.number().int().min(0),
                revenue: z.number().min(0),
                successRate: z.number().min(0).max(1)
            })
        )
        .optional()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PaymentWithUser = z.infer<typeof PaymentWithUserSchema>;
export type PaymentWithPlan = z.infer<typeof PaymentWithPlanSchema>;
export type PaymentWithSubscription = z.infer<typeof PaymentWithSubscriptionSchema>;
export type PaymentWithRefunds = z.infer<typeof PaymentWithRefundsSchema>;
export type PaymentWithTransaction = z.infer<typeof PaymentWithTransactionSchema>;
export type PaymentPlanWithSubscriptions = z.infer<typeof PaymentPlanWithSubscriptionsSchema>;
export type PaymentPlanWithRevenue = z.infer<typeof PaymentPlanWithRevenueSchema>;
export type PaymentPlanWithUsage = z.infer<typeof PaymentPlanWithUsageSchema>;
export type SubscriptionWithPayments = z.infer<typeof SubscriptionWithPaymentsSchema>;
export type SubscriptionWithUser = z.infer<typeof SubscriptionWithUserSchema>;
export type SubscriptionWithTrial = z.infer<typeof SubscriptionWithTrialSchema>;
export type PaymentWithFullRelations = z.infer<typeof PaymentWithFullRelationsSchema>;
export type PaymentPlanWithFullRelations = z.infer<typeof PaymentPlanWithFullRelationsSchema>;
export type SubscriptionWithFullRelations = z.infer<typeof SubscriptionWithFullRelationsSchema>;
export type PaymentAnalyticsInput = z.infer<typeof PaymentAnalyticsInputSchema>;
export type PaymentAnalyticsOutput = z.infer<typeof PaymentAnalyticsOutputSchema>;
