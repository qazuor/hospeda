import { z } from 'zod';
import { ClientAccessRightSchema } from './client-access-right.schema.js';

/**
 * ClientAccessRight Relations Schemas
 *
 * This file contains schemas for client access rights with related entities:
 * - ClientAccessRightWithClient
 * - ClientAccessRightWithSubscription
 * - ClientAccessRightWithFull (all relations)
 */

// ============================================================================
// RELATED ENTITY SUMMARY SCHEMAS
// ============================================================================

/**
 * Client summary schema for relations
 * Contains essential client information
 */
const ClientSummarySchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    billingEmail: z.string().email(),
    userId: z.string().uuid().nullable(),
    lifecycleState: z.string(),
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
 * Subscription item summary schema for relations
 * Contains essential subscription item information
 */
const SubscriptionItemSummarySchema = z.object({
    id: z.string().uuid(),
    subscriptionId: z.string().uuid(),
    productId: z.string().uuid(),
    productName: z.string(),
    quantity: z.number().int().min(0),
    unitPrice: z.number().min(0),
    currency: z.string(),
    isActive: z.boolean()
});

/**
 * User summary schema for relations (audit purposes)
 * Contains essential user information
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

// ============================================================================
// CLIENT ACCESS RIGHT WITH RELATIONS SCHEMAS
// ============================================================================

/**
 * ClientAccessRight with client information
 * Includes the related client data
 */
export const ClientAccessRightWithClientSchema = ClientAccessRightSchema.extend({
    client: ClientSummarySchema
});
export type ClientAccessRightWithClient = z.infer<typeof ClientAccessRightWithClientSchema>;

/**
 * ClientAccessRight with subscription information
 * Includes the related subscription item and subscription data
 */
export const ClientAccessRightWithSubscriptionSchema = ClientAccessRightSchema.extend({
    subscriptionItem: SubscriptionItemSummarySchema.optional(),
    subscription: SubscriptionSummarySchema.optional()
});
export type ClientAccessRightWithSubscription = z.infer<
    typeof ClientAccessRightWithSubscriptionSchema
>;

/**
 * ClientAccessRight with audit information
 * Includes the users who created, updated, and deleted the record
 */
export const ClientAccessRightWithAuditSchema = ClientAccessRightSchema.extend({
    createdBy: UserSummarySchema.nullable(),
    updatedBy: UserSummarySchema.nullable(),
    deletedBy: UserSummarySchema.nullable()
});
export type ClientAccessRightWithAudit = z.infer<typeof ClientAccessRightWithAuditSchema>;

/**
 * ClientAccessRight with basic relations
 * Includes client and subscription item information
 */
export const ClientAccessRightWithBasicRelationsSchema = ClientAccessRightSchema.extend({
    client: ClientSummarySchema,
    subscriptionItem: SubscriptionItemSummarySchema.optional()
});
export type ClientAccessRightWithBasicRelations = z.infer<
    typeof ClientAccessRightWithBasicRelationsSchema
>;

/**
 * ClientAccessRight with full relations
 * Includes all possible related data: client, subscription, audit info
 */
export const ClientAccessRightWithFullRelationsSchema = ClientAccessRightSchema.extend({
    // Primary relations
    client: ClientSummarySchema,
    subscriptionItem: SubscriptionItemSummarySchema.optional(),
    subscription: SubscriptionSummarySchema.optional(),

    // Audit relations
    createdBy: UserSummarySchema.nullable(),
    updatedBy: UserSummarySchema.nullable(),
    deletedBy: UserSummarySchema.nullable()
});
export type ClientAccessRightWithFullRelations = z.infer<
    typeof ClientAccessRightWithFullRelationsSchema
>;

// ============================================================================
// AGGREGATED SCHEMAS FOR SPECIFIC USE CASES
// ============================================================================

/**
 * ClientAccessRight overview schema for dashboard/listing views
 * Contains access right with essential related data for quick overview
 */
export const ClientAccessRightOverviewSchema = ClientAccessRightSchema.extend({
    client: ClientSummarySchema.pick({
        id: true,
        name: true,
        billingEmail: true,
        isActive: true
    }),
    subscriptionItem: SubscriptionItemSummarySchema.pick({
        id: true,
        productName: true,
        isActive: true
    }).optional(),

    // Computed status fields
    isCurrentlyValid: z.boolean(),
    daysUntilExpiration: z.number().int().nullable(),
    statusLabel: z.string() // e.g., "Active", "Expired", "Expiring Soon"
});
export type ClientAccessRightOverview = z.infer<typeof ClientAccessRightOverviewSchema>;

/**
 * ClientAccessRight detail schema for detailed views
 * Contains comprehensive access right information with key relations
 */
export const ClientAccessRightDetailSchema = ClientAccessRightSchema.extend({
    client: ClientSummarySchema,
    subscriptionItem: SubscriptionItemSummarySchema.optional(),
    subscription: SubscriptionSummarySchema.pick({
        id: true,
        planName: true,
        status: true,
        currentPeriodEnd: true,
        isActive: true
    }).optional(),
    createdBy: UserSummarySchema.pick({
        id: true,
        email: true,
        displayName: true
    }).nullable(),

    // Additional computed fields
    validityStatus: z.object({
        isValid: z.boolean(),
        reason: z.string().optional(), // Why it's invalid if applicable
        expiresInDays: z.number().int().nullable(),
        hasExpired: z.boolean(),
        willExpireSoon: z.boolean() // Within 30 days
    })
});
export type ClientAccessRightDetail = z.infer<typeof ClientAccessRightDetailSchema>;

// ============================================================================
// RELATION CONFIGURATION SCHEMAS
// ============================================================================

/**
 * Schema for configuring which relations to include in API responses
 */
export const ClientAccessRightRelationConfigSchema = z.object({
    includeClient: z.boolean().default(false),
    includeSubscriptionItem: z.boolean().default(false),
    includeSubscription: z.boolean().default(false),
    includeAuditInfo: z.boolean().default(false),

    // Additional computed fields
    includeValidityStatus: z.boolean().default(false),
    includeStatusLabels: z.boolean().default(false)
});
export type ClientAccessRightRelationConfig = z.infer<typeof ClientAccessRightRelationConfigSchema>;

// ============================================================================
// GROUPED SCHEMAS FOR REPORTING
// ============================================================================

/**
 * Schema for client access rights grouped by client
 * Useful for client-specific dashboards and reports
 */
export const ClientAccessRightsByClientSchema = z.object({
    client: ClientSummarySchema,
    accessRights: z.array(ClientAccessRightSchema),
    summary: z.object({
        total: z.number().int().min(0),
        active: z.number().int().min(0),
        expired: z.number().int().min(0),
        expiringSoon: z.number().int().min(0)
    })
});
export type ClientAccessRightsByClient = z.infer<typeof ClientAccessRightsByClientSchema>;

/**
 * Schema for client access rights grouped by feature
 * Useful for feature usage analytics and reporting
 */
export const ClientAccessRightsByFeatureSchema = z.object({
    feature: z.string(),
    accessRights: z.array(ClientAccessRightWithClientSchema),
    summary: z.object({
        totalClients: z.number().int().min(0),
        activeClients: z.number().int().min(0),
        totalAccessRights: z.number().int().min(0),
        activeAccessRights: z.number().int().min(0)
    })
});
export type ClientAccessRightsByFeature = z.infer<typeof ClientAccessRightsByFeatureSchema>;
