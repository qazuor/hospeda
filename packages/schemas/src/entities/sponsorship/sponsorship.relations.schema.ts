import { z } from 'zod';
import { SponsorshipSchema } from './sponsorship.schema.js';

/**
 * Sponsorship with Entity Details Schema
 * Includes details about the sponsored entity (POST or EVENT)
 */
export const SponsorshipWithEntitySchema = SponsorshipSchema.extend({
    // Entity details (polymorphic based on entityType)
    entity: z
        .object({
            id: z.string().uuid(),
            title: z.string(),
            slug: z.string().optional(),
            status: z.string(),
            createdAt: z.date(),
            updatedAt: z.date()
        })
        .optional() // Optional because entity might be deleted
});

/**
 * Sponsorship with Client Details Schema
 * Includes details about the sponsoring client
 */
export const SponsorshipWithClientSchema = SponsorshipSchema.extend({
    // Client details
    client: z.object({
        id: z.string().uuid(),
        name: z.string(),
        billingEmail: z.string().email()
    })
});

/**
 * Sponsorship with Full Details Schema
 * Includes both entity and client details
 */
export const SponsorshipWithFullDetailsSchema = SponsorshipWithClientSchema.extend({
    // Entity details (polymorphic)
    entity: z
        .object({
            id: z.string().uuid(),
            title: z.string(),
            slug: z.string().optional(),
            status: z.string(),
            createdAt: z.date(),
            updatedAt: z.date()
        })
        .optional()
});

/**
 * Sponsorship Performance Metrics Schema
 * Extended metrics and analytics for sponsorships
 */
export const SponsorshipPerformanceSchema = SponsorshipSchema.extend({
    // Performance calculations
    clickThroughRate: z
        .number()
        .min(0, { message: 'zodError.sponsorship.clickThroughRate.min' })
        .max(100, { message: 'zodError.sponsorship.clickThroughRate.max' })
        .default(0),

    costPerImpression: z
        .number()
        .nonnegative({ message: 'zodError.sponsorship.costPerImpression.nonnegative' })
        .optional(),

    costPerClick: z
        .number()
        .nonnegative({ message: 'zodError.sponsorship.costPerClick.nonnegative' })
        .optional(),

    budgetUtilization: z
        .number()
        .min(0, { message: 'zodError.sponsorship.budgetUtilization.min' })
        .max(100, { message: 'zodError.sponsorship.budgetUtilization.max' })
        .optional(),

    // Status flags
    isActive: z.boolean(),
    isExpired: z.boolean(),
    isOverBudget: z.boolean(),

    // Time-based metrics
    daysRemaining: z.number().int().optional(),
    totalDuration: z.number().int().positive(),
    percentageComplete: z
        .number()
        .min(0, { message: 'zodError.sponsorship.percentageComplete.min' })
        .max(100, { message: 'zodError.sponsorship.percentageComplete.max' })
});

/**
 * Sponsorship Analytics Summary Schema
 * Aggregated analytics data for multiple sponsorships
 */
export const SponsorshipAnalyticsSummarySchema = z.object({
    // Time period
    fromDate: z.date(),
    toDate: z.date(),

    // Filters applied
    clientId: z.string().uuid().optional(),
    entityType: z.string().optional(),

    // Aggregate metrics
    totalSponsorships: z.number().int().nonnegative(),
    activeSponsorships: z.number().int().nonnegative(),
    totalBudget: z.number().int().nonnegative(),
    totalSpent: z.number().int().nonnegative(),
    totalImpressions: z.number().int().nonnegative(),
    totalClicks: z.number().int().nonnegative(),

    // Calculated metrics
    averageCTR: z.number().min(0).max(100),
    averageCostPerImpression: z.number().nonnegative().optional(),
    averageCostPerClick: z.number().nonnegative().optional(),
    budgetUtilizationRate: z.number().min(0).max(100),

    // Performance by entity type
    performanceByEntityType: z
        .array(
            z.object({
                entityType: z.string(),
                count: z.number().int().nonnegative(),
                totalImpressions: z.number().int().nonnegative(),
                totalClicks: z.number().int().nonnegative(),
                averageCTR: z.number().min(0).max(100)
            })
        )
        .default([]),

    // Top performing sponsorships
    topPerformingSponsorships: z
        .array(
            SponsorshipPerformanceSchema.pick({
                id: true,
                entityType: true,
                entityId: true,
                impressionCount: true,
                clickCount: true,
                clickThroughRate: true
            })
        )
        .max(10)
        .default([])
});

/**
 * Entity Sponsorship Status Schema
 * Status of sponsorship for a specific entity
 */
export const EntitySponsorshipStatusSchema = z.object({
    entityId: z.string().uuid(),
    entityType: z.string(),

    // Current sponsorship status
    isSponsored: z.boolean(),
    activeSponsorshipsCount: z.number().int().nonnegative(),

    // Current active sponsorship (if any)
    currentSponsorship: SponsorshipSchema.optional(),

    // All sponsorships for this entity
    allSponsorships: z.array(SponsorshipSchema).default([]),

    // Priority of current sponsorship
    currentPriority: z.number().int().min(0).max(100).optional(),

    // Expires at (for current sponsorship)
    expiresAt: z.date().optional()
});

export type SponsorshipWithEntity = z.infer<typeof SponsorshipWithEntitySchema>;
export type SponsorshipWithClient = z.infer<typeof SponsorshipWithClientSchema>;
export type SponsorshipWithFullDetails = z.infer<typeof SponsorshipWithFullDetailsSchema>;
export type SponsorshipPerformance = z.infer<typeof SponsorshipPerformanceSchema>;
export type SponsorshipAnalyticsSummary = z.infer<typeof SponsorshipAnalyticsSummarySchema>;
export type EntitySponsorshipStatus = z.infer<typeof EntitySponsorshipStatusSchema>;
