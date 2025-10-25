import { z } from 'zod';
import { CampaignStatusSchema } from '../../enums/index.js';
import { CampaignSchema } from './campaign.schema.js';

/**
 * Create Campaign Schema
 * For creating new marketing campaigns with required fields
 */
export const CreateCampaignSchema = CampaignSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true
})
    .extend({
        // Override performance and settings to make them truly optional for creation
        performance: z
            .object({
                impressions: z.number().int().min(0).default(0),
                clicks: z.number().int().min(0).default(0),
                conversions: z.number().int().min(0).default(0),
                clickThroughRate: z.number().min(0).max(1).default(0),
                conversionRate: z.number().min(0).max(1).default(0),
                costPerClick: z.number().min(0).default(0),
                costPerConversion: z.number().min(0).default(0),
                returnOnAdSpend: z.number().min(0).default(0)
            })
            .optional(),

        settings: z
            .object({
                priority: z.number().int().min(1).max(5).default(3),
                isTestCampaign: z.boolean().default(false),
                allowOptOut: z.boolean().default(true),
                trackingEnabled: z.boolean().default(true),
                notes: z.string().max(1000).optional(),
                tags: z.array(z.string().max(50)).max(20).default([])
            })
            .optional()
    })
    .refine(
        (data) => {
            // Validate that audience targeting has at least one criteria
            const targeting = data.targetAudience;
            return !!(
                targeting.countries?.length ||
                targeting.regions?.length ||
                targeting.cities?.length ||
                targeting.ageRange ||
                targeting.interests?.length ||
                targeting.languages?.length ||
                targeting.userSegments?.length
            );
        },
        {
            message: 'zodError.campaign.targeting.noCriteria',
            path: ['targetAudience']
        }
    )
    .refine(
        (data) => {
            // Validate budget consistency
            if (data.budget.dailyBudget) {
                return data.budget.dailyBudget <= data.budget.totalBudget;
            }
            return true;
        },
        {
            message: 'zodError.campaign.budget.daily.exceedsTotal',
            path: ['budget', 'dailyBudget']
        }
    )
    .refine(
        (data) => {
            // Validate schedule dates
            if (data.schedule.endDate) {
                return data.schedule.startDate < data.schedule.endDate;
            }
            return true;
        },
        {
            message: 'zodError.campaign.schedule.invalidDateRange',
            path: ['schedule']
        }
    );

/**
 * Update Campaign Schema
 * For updating existing campaigns with partial data
 */
export const UpdateCampaignSchema = CreateCampaignSchema.partial()
    .extend({
        // Some fields that should not be updated after creation
        // Performance metrics are automatically updated by the system
        performance: z
            .object({
                impressions: z.number().int().min(0),
                clicks: z.number().int().min(0),
                conversions: z.number().int().min(0),
                clickThroughRate: z.number().min(0).max(1),
                conversionRate: z.number().min(0).max(1),
                costPerClick: z.number().min(0),
                costPerConversion: z.number().min(0),
                returnOnAdSpend: z.number().min(0)
            })
            .partial()
            .optional(),

        // Settings can be updated
        settings: z
            .object({
                priority: z.number().int().min(1).max(5),
                isTestCampaign: z.boolean(),
                allowOptOut: z.boolean(),
                trackingEnabled: z.boolean(),
                notes: z.string().max(1000).optional(),
                tags: z.array(z.string().max(50)).max(20)
            })
            .partial()
            .optional()
    })
    .refine(
        (data) => {
            // Only validate targeting if provided
            if (data.targetAudience) {
                const targeting = data.targetAudience;
                return !!(
                    targeting.countries?.length ||
                    targeting.regions?.length ||
                    targeting.cities?.length ||
                    targeting.ageRange ||
                    targeting.interests?.length ||
                    targeting.languages?.length ||
                    targeting.userSegments?.length
                );
            }
            return true;
        },
        {
            message: 'zodError.campaign.targeting.noCriteria',
            path: ['targetAudience']
        }
    )
    .refine(
        (data) => {
            // Validate budget consistency if budget is provided
            if (data.budget?.dailyBudget && data.budget?.totalBudget) {
                return data.budget.dailyBudget <= data.budget.totalBudget;
            }
            return true;
        },
        {
            message: 'zodError.campaign.budget.daily.exceedsTotal',
            path: ['budget']
        }
    )
    .refine(
        (data) => {
            // Validate schedule dates if both are provided
            if (data.schedule?.startDate && data.schedule?.endDate) {
                return data.schedule.startDate < data.schedule.endDate;
            }
            return true;
        },
        {
            message: 'zodError.campaign.schedule.invalidDateRange',
            path: ['schedule']
        }
    );

/**
 * Campaign Status Update Schema
 * For updating only the campaign status (common operation)
 */
export const UpdateCampaignStatusSchema = z.object({
    status: CampaignStatusSchema,
    notes: z.string().max(500).optional().describe('Optional reason for status change')
});

/**
 * Campaign Budget Update Schema
 * For updating campaign budget during active campaigns
 */
export const UpdateCampaignBudgetSchema = z
    .object({
        totalBudget: z.number().positive().max(1000000).optional(),
        dailyBudget: z.number().positive().max(50000).optional(),
        costPerAction: z.number().positive().max(1000).optional(),
        bidStrategy: z
            .enum(['manual', 'automatic', 'target_cpa', 'maximize_conversions'])
            .optional()
    })
    .refine(
        (data) => {
            // Validate budget consistency if both are provided
            if (data.dailyBudget && data.totalBudget) {
                return data.dailyBudget <= data.totalBudget;
            }
            return true;
        },
        {
            message: 'zodError.campaign.budget.daily.exceedsTotal',
            path: ['dailyBudget']
        }
    );

/**
 * Campaign Performance Update Schema
 * For system updates to campaign performance metrics
 */
export const UpdateCampaignPerformanceSchema = z
    .object({
        impressions: z.number().int().min(0).optional(),
        clicks: z.number().int().min(0).optional(),
        conversions: z.number().int().min(0).optional(),
        clickThroughRate: z.number().min(0).max(1).optional(),
        conversionRate: z.number().min(0).max(1).optional(),
        costPerClick: z.number().min(0).optional(),
        costPerConversion: z.number().min(0).optional(),
        returnOnAdSpend: z.number().min(0).optional()
    })
    .refine(
        (data) => {
            // If clicks provided, impressions should be >= clicks
            if (data.clicks !== undefined && data.impressions !== undefined) {
                return data.impressions >= data.clicks;
            }
            return true;
        },
        {
            message: 'zodError.campaign.performance.clicksExceedImpressions',
            path: ['clicks']
        }
    )
    .refine(
        (data) => {
            // If conversions provided, clicks should be >= conversions
            if (data.conversions !== undefined && data.clicks !== undefined) {
                return data.clicks >= data.conversions;
            }
            return true;
        },
        {
            message: 'zodError.campaign.performance.conversionsExceedClicks',
            path: ['conversions']
        }
    );

export type CreateCampaign = z.infer<typeof CreateCampaignSchema>;
export type UpdateCampaign = z.infer<typeof UpdateCampaignSchema>;
export type UpdateCampaignStatus = z.infer<typeof UpdateCampaignStatusSchema>;
export type UpdateCampaignBudget = z.infer<typeof UpdateCampaignBudgetSchema>;
export type UpdateCampaignPerformance = z.infer<typeof UpdateCampaignPerformanceSchema>;
