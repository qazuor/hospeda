import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { CampaignIdSchema } from '../../common/id.schema.js';
import { CampaignChannelSchema, CampaignStatusSchema } from '../../enums/index.js';

/**
 * Campaign Schema
 *
 * Defines marketing campaigns with budget management, audience targeting,
 * and multi-channel delivery. Supports comprehensive analytics and performance tracking.
 */
export const CampaignSchema = z.object({
    // Base fields
    id: CampaignIdSchema,
    ...BaseAuditFields,

    // Basic campaign information
    name: z
        .string()
        .min(3, { message: 'zodError.campaign.name.tooShort' })
        .max(200, { message: 'zodError.campaign.name.tooLong' })
        .describe('Campaign name for identification and reporting'),

    description: z
        .string()
        .min(10, { message: 'zodError.campaign.description.tooShort' })
        .max(2000, { message: 'zodError.campaign.description.tooLong' })
        .describe('Detailed campaign description and objectives'),

    // Campaign status and lifecycle
    status: CampaignStatusSchema.describe('Current campaign status'),

    // Campaign targeting and channels
    channels: z
        .array(CampaignChannelSchema)
        .min(1, { message: 'zodError.campaign.channels.minRequired' })
        .max(5, { message: 'zodError.campaign.channels.maxAllowed' })
        .describe('Marketing channels for campaign delivery'),

    // Audience targeting
    targetAudience: z.object({
        countries: z.array(z.string().length(2)).max(50).optional(),
        regions: z.array(z.string().max(100)).max(100).optional(),
        cities: z.array(z.string().max(100)).max(200).optional(),
        ageRange: z
            .object({
                min: z.number().int().min(13).max(120),
                max: z.number().int().min(13).max(120)
            })
            .refine((data) => data.min <= data.max)
            .optional(),
        interests: z.array(z.string().max(100)).max(50).optional(),
        languages: z.array(z.string().length(2)).max(20).optional(),
        userSegments: z
            .array(
                z.enum([
                    'new_users',
                    'returning_users',
                    'premium_users',
                    'hosts',
                    'guests',
                    'inactive_users'
                ])
            )
            .max(6)
            .optional()
    }),

    // Budget and spending
    budget: z
        .object({
            totalBudget: z.number().positive().max(1000000),
            dailyBudget: z.number().positive().max(50000).optional(),
            spentAmount: z.number().min(0).default(0),
            currency: z.string().length(3).default('USD'),
            costPerAction: z.number().positive().max(1000).optional(),
            bidStrategy: z
                .enum(['manual', 'automatic', 'target_cpa', 'maximize_conversions'])
                .default('automatic')
        })
        .refine((data) => data.spentAmount <= data.totalBudget)
        .refine((data) => !data.dailyBudget || data.dailyBudget <= data.totalBudget),

    // Campaign scheduling
    schedule: z
        .object({
            startDate: z.date(),
            endDate: z.date().optional(),
            timezone: z.string().default('UTC')
        })
        .refine((data) => !data.endDate || data.startDate < data.endDate),

    // Campaign content and messaging
    content: z.object({
        subject: z.string().min(5).max(200),
        bodyTemplate: z.string().min(20).max(10000),
        callToAction: z.string().min(3).max(100),
        landingPageUrl: z.string().url().optional(),
        assets: z
            .array(
                z.object({
                    type: z.enum(['image', 'video', 'gif', 'document']),
                    url: z.string().url(),
                    altText: z.string().max(200).optional(),
                    size: z.number().int().positive().optional()
                })
            )
            .max(10)
            .default([])
    }),

    // Performance tracking (optional)
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

    // Campaign settings (optional)
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
});

export type Campaign = z.infer<typeof CampaignSchema>;
