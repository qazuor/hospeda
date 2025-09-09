import { z } from 'zod';
import { UserSchema } from './user.schema.js';

/**
 * User Relations Schemas
 *
 * This file contains schemas for users with related entities:
 * - UserWithAccommodations
 * - UserWithSubscriptions
 * - UserWithPermissions
 * - UserWithReviews
 * - UserWithPayments
 * - UserWithFull (all relations)
 */

// Import related schemas (these will be created later)
// For now, we'll define basic summary schemas inline to avoid circular dependencies

// ============================================================================
// RELATED ENTITY SUMMARY SCHEMAS
// ============================================================================

/**
 * Accommodation summary schema for relations
 * Contains essential accommodation information
 */
const AccommodationSummarySchema = z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    summary: z.string(),
    type: z.string(),
    isFeatured: z.boolean(),
    rating: z.number().min(0).max(5).optional(),
    location: z
        .object({
            country: z.string(),
            state: z.string().optional(),
            city: z.string(),
            coordinates: z
                .object({
                    latitude: z.number(),
                    longitude: z.number()
                })
                .optional()
        })
        .optional(),
    createdAt: z.date()
});

/**
 * Subscription summary schema for relations
 * Contains essential subscription information
 */
const SubscriptionSummarySchema = z.object({
    id: z.string().uuid(),
    status: z.string(),
    billingCycle: z.string(),
    amount: z.number().min(0),
    currency: z.string(),
    startDate: z.date(),
    endDate: z.date().optional(),
    nextBillingDate: z.date().optional(),
    paymentPlan: z
        .object({
            id: z.string().uuid(),
            name: z.string(),
            slug: z.string()
        })
        .optional()
});

/**
 * Permission assignment summary schema for relations
 * Contains essential permission information
 */
const PermissionAssignmentSummarySchema = z.object({
    id: z.string().uuid(),
    permission: z.string(),
    resource: z.string().optional(),
    resourceId: z.string().uuid().optional(),
    grantedAt: z.date(),
    expiresAt: z.date().optional(),
    grantedBy: z
        .object({
            id: z.string().uuid(),
            displayName: z.string().optional(),
            email: z.string()
        })
        .optional()
});

/**
 * Review summary schema for relations
 * Contains essential review information
 */
const ReviewSummarySchema = z.object({
    id: z.string().uuid(),
    rating: z.number().min(1).max(5),
    title: z.string().optional(),
    comment: z.string().optional(),
    accommodationId: z.string().uuid(),
    accommodationName: z.string().optional(),
    createdAt: z.date(),
    isVerified: z.boolean().optional()
});

/**
 * Payment summary schema for relations
 * Contains essential payment information
 */
const PaymentSummarySchema = z.object({
    id: z.string().uuid(),
    type: z.string(),
    status: z.string(),
    amount: z.number().min(0),
    currency: z.string(),
    description: z.string().optional(),
    processedAt: z.date().optional(),
    createdAt: z.date(),
    paymentPlan: z
        .object({
            id: z.string().uuid(),
            name: z.string(),
            slug: z.string()
        })
        .optional()
});

// ============================================================================
// USER WITH RELATIONS SCHEMAS
// ============================================================================

/**
 * User with accommodations
 * Includes an array of owned accommodations
 */
export const UserWithAccommodationsSchema = UserSchema.extend({
    accommodations: z.array(AccommodationSummarySchema).optional(),
    accommodationsCount: z.number().int().min(0).optional()
});

/**
 * User with subscriptions
 * Includes subscription information
 */
export const UserWithSubscriptionsSchema = UserSchema.extend({
    subscriptions: z.array(SubscriptionSummarySchema).optional(),
    activeSubscription: SubscriptionSummarySchema.optional(),
    subscriptionsCount: z.number().int().min(0).optional()
});

/**
 * User with permissions
 * Includes permission assignments
 */
export const UserWithPermissionsSchema = UserSchema.extend({
    permissions: z.array(PermissionAssignmentSummarySchema).optional(),
    permissionsCount: z.number().int().min(0).optional()
});

/**
 * User with reviews
 * Includes reviews written by the user
 */
export const UserWithReviewsSchema = UserSchema.extend({
    reviews: z.array(ReviewSummarySchema).optional(),
    reviewsCount: z.number().int().min(0).optional(),
    averageRatingGiven: z.number().min(0).max(5).optional()
});

/**
 * User with payments
 * Includes payment history
 */
export const UserWithPaymentsSchema = UserSchema.extend({
    payments: z.array(PaymentSummarySchema).optional(),
    paymentsCount: z.number().int().min(0).optional(),
    totalSpent: z.number().min(0).optional(),
    lastPayment: PaymentSummarySchema.optional()
});

/**
 * User with business relations
 * Includes accommodations, subscriptions, and payments
 */
export const UserWithBusinessRelationsSchema = UserSchema.extend({
    // Accommodations
    accommodations: z.array(AccommodationSummarySchema).optional(),
    accommodationsCount: z.number().int().min(0).optional(),

    // Subscriptions
    subscriptions: z.array(SubscriptionSummarySchema).optional(),
    activeSubscription: SubscriptionSummarySchema.optional(),
    subscriptionsCount: z.number().int().min(0).optional(),

    // Payments
    payments: z.array(PaymentSummarySchema).optional(),
    paymentsCount: z.number().int().min(0).optional(),
    totalSpent: z.number().min(0).optional(),
    lastPayment: PaymentSummarySchema.optional()
});

/**
 * User with activity relations
 * Includes reviews and permissions
 */
export const UserWithActivityRelationsSchema = UserSchema.extend({
    // Reviews
    reviews: z.array(ReviewSummarySchema).optional(),
    reviewsCount: z.number().int().min(0).optional(),
    averageRatingGiven: z.number().min(0).max(5).optional(),

    // Permissions
    permissions: z.array(PermissionAssignmentSummarySchema).optional(),
    permissionsCount: z.number().int().min(0).optional()
});

/**
 * User with all relations
 * Includes all possible related entities
 */
export const UserWithFullRelationsSchema = UserSchema.extend({
    // Accommodations
    accommodations: z.array(AccommodationSummarySchema).optional(),
    accommodationsCount: z.number().int().min(0).optional(),

    // Subscriptions
    subscriptions: z.array(SubscriptionSummarySchema).optional(),
    activeSubscription: SubscriptionSummarySchema.optional(),
    subscriptionsCount: z.number().int().min(0).optional(),

    // Permissions
    permissions: z.array(PermissionAssignmentSummarySchema).optional(),
    permissionsCount: z.number().int().min(0).optional(),

    // Reviews
    reviews: z.array(ReviewSummarySchema).optional(),
    reviewsCount: z.number().int().min(0).optional(),
    averageRatingGiven: z.number().min(0).max(5).optional(),

    // Payments
    payments: z.array(PaymentSummarySchema).optional(),
    paymentsCount: z.number().int().min(0).optional(),
    totalSpent: z.number().min(0).optional(),
    lastPayment: PaymentSummarySchema.optional()
});

// ============================================================================
// ADMIN SPECIFIC SCHEMAS
// ============================================================================

/**
 * User with admin details
 * Includes sensitive information for admin views
 */
export const UserWithAdminDetailsSchema = UserSchema.extend({
    // Login statistics
    loginHistory: z
        .array(
            z.object({
                loginAt: z.date(),
                ipAddress: z.string().optional(),
                userAgent: z.string().optional(),
                success: z.boolean()
            })
        )
        .optional(),

    // Security information
    securityEvents: z
        .array(
            z.object({
                event: z.string(),
                timestamp: z.date(),
                ipAddress: z.string().optional(),
                details: z.record(z.string(), z.unknown()).optional()
            })
        )
        .optional(),

    // Account flags
    flags: z
        .array(
            z.object({
                type: z.string(),
                reason: z.string().optional(),
                createdAt: z.date(),
                createdBy: z.string().uuid().optional()
            })
        )
        .optional()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UserWithAccommodations = z.infer<typeof UserWithAccommodationsSchema>;
export type UserWithSubscriptions = z.infer<typeof UserWithSubscriptionsSchema>;
export type UserWithPermissions = z.infer<typeof UserWithPermissionsSchema>;
export type UserWithReviews = z.infer<typeof UserWithReviewsSchema>;
export type UserWithPayments = z.infer<typeof UserWithPaymentsSchema>;
export type UserWithBusinessRelations = z.infer<typeof UserWithBusinessRelationsSchema>;
export type UserWithActivityRelations = z.infer<typeof UserWithActivityRelationsSchema>;
export type UserWithFullRelations = z.infer<typeof UserWithFullRelationsSchema>;
export type UserWithAdminDetails = z.infer<typeof UserWithAdminDetailsSchema>;
