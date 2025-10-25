import { z } from 'zod';
import { ClientSchema } from './client.schema.js';

/**
 * Client Relations Schemas
 *
 * This file contains schemas for clients with related entities:
 * - ClientWithUser
 * - ClientWithSubscriptions
 * - ClientWithAccessRights
 * - ClientWithFull (all relations)
 */

// ============================================================================
// RELATED ENTITY SUMMARY SCHEMAS
// ============================================================================

/**
 * User summary schema for relations
 * Contains essential user information (associated user)
 */
const UserSummarySchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    displayName: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    role: z.string(),
    isActive: z.boolean()
});

/**
 * Subscription summary schema for relations
 * Contains essential subscription information
 */
const SubscriptionSummarySchema = z.object({
    id: z.string().uuid(),
    planId: z.string().uuid(),
    planName: z.string(),
    status: z.string(),
    currentPeriodStart: z.date(),
    currentPeriodEnd: z.date(),
    isActive: z.boolean(),
    billingCycle: z.string().optional(),
    amount: z.number().optional(),
    currency: z.string().optional()
});

/**
 * Access Right summary schema for relations
 * Contains essential access right information
 */
const AccessRightSummarySchema = z.object({
    id: z.string().uuid(),
    resourceType: z.string(),
    resourceId: z.string().uuid().optional(),
    action: z.string(),
    permission: z.string(),
    isActive: z.boolean(),
    expiresAt: z.date().optional(),
    grantedAt: z.date(),
    grantedById: z.string().uuid().optional()
});

// ============================================================================
// CLIENT WITH RELATIONS SCHEMAS
// ============================================================================

/**
 * Client with user information
 * Includes the related user data
 */
export const ClientWithUserSchema = ClientSchema.extend({
    user: UserSummarySchema.nullable() // Nullable to match the base schema
});
export type ClientWithUser = z.infer<typeof ClientWithUserSchema>;

/**
 * Client with subscriptions
 * Includes an array of related subscriptions
 */
export const ClientWithSubscriptionsSchema = ClientSchema.extend({
    subscriptions: z.array(SubscriptionSummarySchema).optional(),
    subscriptionsCount: z.number().int().min(0).optional(),
    activeSubscriptionsCount: z.number().int().min(0).optional()
});
export type ClientWithSubscriptions = z.infer<typeof ClientWithSubscriptionsSchema>;

/**
 * Client with access rights
 * Includes an array of related access rights
 */
export const ClientWithAccessRightsSchema = ClientSchema.extend({
    accessRights: z.array(AccessRightSummarySchema).optional(),
    accessRightsCount: z.number().int().min(0).optional(),
    activeAccessRightsCount: z.number().int().min(0).optional()
});
export type ClientWithAccessRights = z.infer<typeof ClientWithAccessRightsSchema>;

/**
 * Client with basic relations
 * Includes user information
 */
export const ClientWithBasicRelationsSchema = ClientSchema.extend({
    user: UserSummarySchema.nullable()
});
export type ClientWithBasicRelations = z.infer<typeof ClientWithBasicRelationsSchema>;

/**
 * Client with business relations
 * Includes subscriptions and access rights
 */
export const ClientWithBusinessRelationsSchema = ClientSchema.extend({
    subscriptions: z.array(SubscriptionSummarySchema).optional(),
    subscriptionsCount: z.number().int().min(0).optional(),
    activeSubscriptionsCount: z.number().int().min(0).optional(),
    accessRights: z.array(AccessRightSummarySchema).optional(),
    accessRightsCount: z.number().int().min(0).optional(),
    activeAccessRightsCount: z.number().int().min(0).optional()
});
export type ClientWithBusinessRelations = z.infer<typeof ClientWithBusinessRelationsSchema>;

/**
 * Client with full relations
 * Includes all possible related data: user, subscriptions, and access rights
 */
export const ClientWithFullRelationsSchema = ClientSchema.extend({
    // User relation
    user: UserSummarySchema.nullable(),

    // Subscription relations
    subscriptions: z.array(SubscriptionSummarySchema).optional(),
    subscriptionsCount: z.number().int().min(0).optional(),
    activeSubscriptionsCount: z.number().int().min(0).optional(),

    // Access rights relations
    accessRights: z.array(AccessRightSummarySchema).optional(),
    accessRightsCount: z.number().int().min(0).optional(),
    activeAccessRightsCount: z.number().int().min(0).optional()
});
export type ClientWithFullRelations = z.infer<typeof ClientWithFullRelationsSchema>;

// ============================================================================
// AGGREGATED SCHEMAS FOR SPECIFIC USE CASES
// ============================================================================

/**
 * Client overview schema for dashboard/listing views
 * Contains client with essential related data for quick overview
 */
export const ClientOverviewSchema = ClientSchema.extend({
    user: UserSummarySchema.pick({
        id: true,
        email: true,
        displayName: true,
        isActive: true
    }).nullable(),
    activeSubscriptionsCount: z.number().int().min(0).optional(),
    totalAccessRights: z.number().int().min(0).optional()
});
export type ClientOverview = z.infer<typeof ClientOverviewSchema>;

/**
 * Client detail schema for detailed views
 * Contains comprehensive client information with key relations
 */
export const ClientDetailSchema = ClientSchema.extend({
    user: UserSummarySchema.nullable(),
    subscriptions: z
        .array(
            SubscriptionSummarySchema.pick({
                id: true,
                planName: true,
                status: true,
                currentPeriodEnd: true,
                isActive: true
            })
        )
        .optional(),
    recentAccessRights: z
        .array(
            AccessRightSummarySchema.pick({
                id: true,
                resourceType: true,
                action: true,
                permission: true,
                isActive: true,
                grantedAt: true
            })
        )
        .optional()
});
export type ClientDetail = z.infer<typeof ClientDetailSchema>;

// ============================================================================
// RELATION CONFIGURATION SCHEMAS
// ============================================================================

/**
 * Schema for configuring which relations to include in API responses
 */
export const ClientRelationConfigSchema = z.object({
    includeUser: z.boolean().default(false),
    includeSubscriptions: z.boolean().default(false),
    includeAccessRights: z.boolean().default(false),

    // Pagination for relations
    subscriptionsLimit: z.number().int().min(1).max(100).default(10),
    accessRightsLimit: z.number().int().min(1).max(100).default(10),

    // Additional filters for relations
    onlyActiveSubscriptions: z.boolean().default(false),
    onlyActiveAccessRights: z.boolean().default(false)
});
export type ClientRelationConfig = z.infer<typeof ClientRelationConfigSchema>;
