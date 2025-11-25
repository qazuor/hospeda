import { z } from 'zod';
import { CampaignChannelSchema, CampaignStatusSchema } from '../../enums/index.js';
import { HttpFieldFactories } from '../../utils/http-field.factory.js';
import type { CreateCampaign, UpdateCampaign } from './campaign.crud.schema.js';
import {
    BulkCampaignOperationSchema,
    CampaignAnalyticsSchema,
    SearchCampaignsSchema
} from './campaign.query.schema.js';

/**
 * HTTP Create Campaign Schema
 * Simplified coercion for campaign creation via HTTP
 */
export const HttpCreateCampaignSchema = z.object({
    clientId: z.string().uuid(),
    name: z.string().min(3).max(200),
    description: z.string().min(10).max(2000),
    status: z.string(),

    // Parse channels from comma-separated string
    channels: z.union([
        z.string().transform((str) => str.split(',').filter(Boolean)),
        z.array(z.string())
    ]),

    // Budget with coercion
    'budget.totalBudget': z.coerce.number().positive().max(1000000),
    'budget.dailyBudget': z.coerce.number().positive().max(50000).optional(),
    'budget.currency': z.string().length(3).default('USD'),
    'budget.bidStrategy': z
        .enum(['manual', 'automatic', 'target_cpa', 'maximize_conversions'])
        .default('automatic'),

    // Schedule with date coercion
    'schedule.startDate': z.coerce.date(),
    'schedule.endDate': z.coerce.date().optional(),
    'schedule.timezone': z.string().default('UTC'),

    // Content
    'content.subject': z.string().min(5).max(200),
    'content.bodyTemplate': z.string().min(20).max(10000),
    'content.callToAction': z.string().min(3).max(100),
    'content.landingPageUrl': z.string().url().optional(),

    // Targeting (simplified)
    'targetAudience.countries': z
        .string()
        .transform((str) => str.split(',').filter(Boolean))
        .optional(),
    'targetAudience.languages': z
        .string()
        .transform((str) => str.split(',').filter(Boolean))
        .optional()
});

/**
 * HTTP Update Campaign Schema
 * Simplified update schema for HTTP
 * Note: We remove defaults from create schema to avoid validation issues
 */
export const HttpUpdateCampaignSchema = HttpCreateCampaignSchema.partial().extend({
    // Override fields with defaults to remove the defaults for updates
    'budget.currency': z.string().length(3).optional(),
    'budget.bidStrategy': z
        .enum(['manual', 'automatic', 'target_cpa', 'maximize_conversions'])
        .optional(),
    'schedule.timezone': z.string().optional()
});

/**
 * HTTP Search Campaigns Schema
 * Coerces HTTP query parameters for campaign search
 */
export const HttpSearchCampaignsSchema = SearchCampaignsSchema.extend({
    // Coerce pagination
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),

    // Coerce numeric filters
    minBudget: z.coerce.number().positive().max(1000000).optional(),
    maxBudget: z.coerce.number().positive().max(1000000).optional(),
    minImpressions: z.coerce.number().int().min(0).optional(),
    maxImpressions: z.coerce.number().int().min(0).optional(),
    minClicks: z.coerce.number().int().min(0).optional(),
    maxClicks: z.coerce.number().int().min(0).optional(),
    minConversions: z.coerce.number().int().min(0).optional(),
    maxConversions: z.coerce.number().int().min(0).optional(),
    minClickThroughRate: z.coerce.number().min(0).max(1).optional(),
    maxClickThroughRate: z.coerce.number().min(0).max(1).optional(),
    minConversionRate: z.coerce.number().min(0).max(1).optional(),
    maxConversionRate: z.coerce.number().min(0).max(1).optional(),
    priority: z.coerce.number().int().min(1).max(5).optional(),
    minPriority: z.coerce.number().int().min(1).max(5).optional(),
    maxPriority: z.coerce.number().int().min(1).max(5).optional(),

    // Coerce date filters
    createdAfter: HttpFieldFactories.dateField('createdAfter'),
    createdBefore: HttpFieldFactories.dateField('createdBefore'),
    startedAfter: HttpFieldFactories.dateField('startedAfter'),
    startedBefore: HttpFieldFactories.dateField('startedBefore'),
    endingAfter: HttpFieldFactories.dateField('endingAfter'),
    endingBefore: HttpFieldFactories.dateField('endingBefore'),

    // Coerce boolean filters
    isTestCampaign: HttpFieldFactories.booleanField('isTestCampaign'),
    allowOptOut: HttpFieldFactories.booleanField('allowOptOut'),
    trackingEnabled: HttpFieldFactories.booleanField('trackingEnabled'),
    includeDeleted: HttpFieldFactories.booleanField('includeDeleted'),
    includePerformance: HttpFieldFactories.booleanField('includePerformance'),
    includeSettings: HttpFieldFactories.booleanField('includeSettings'),
    hasNotes: HttpFieldFactories.booleanField('hasNotes'),

    // Parse array filters from comma-separated strings
    statuses: z
        .union([z.string().transform((str) => str.split(',').filter(Boolean)), z.array(z.string())])
        .optional(),

    channels: z
        .union([z.string().transform((str) => str.split(',').filter(Boolean)), z.array(z.string())])
        .optional(),

    targetCountries: z
        .union([z.string().transform((str) => str.split(',').filter(Boolean)), z.array(z.string())])
        .pipe(z.array(z.string().length(2)).max(50))
        .optional(),

    targetRegions: z
        .union([z.string().transform((str) => str.split(',').filter(Boolean)), z.array(z.string())])
        .pipe(z.array(z.string().max(100)).max(100))
        .optional(),

    targetLanguages: z
        .union([z.string().transform((str) => str.split(',').filter(Boolean)), z.array(z.string())])
        .pipe(z.array(z.string().length(2)).max(20))
        .optional(),

    targetSegments: z
        .union([z.string().transform((str) => str.split(',').filter(Boolean)), z.array(z.string())])
        .pipe(
            z
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
        )
        .optional(),

    tags: z
        .union([z.string().transform((str) => str.split(',').filter(Boolean)), z.array(z.string())])
        .pipe(z.array(z.string().max(50)).max(20))
        .optional()
});

/**
 * HTTP Campaign Analytics Schema
 * Coerces HTTP parameters for campaign analytics
 */
export const HttpCampaignAnalyticsSchema = CampaignAnalyticsSchema.extend({
    // Coerce date range
    fromDate: z.coerce.date(),
    toDate: z.coerce.date(),

    // Coerce numeric thresholds
    minClickThroughRate: z.coerce.number().min(0).max(1).optional(),
    minConversionRate: z.coerce.number().min(0).max(1).optional(),
    minROAS: z.coerce.number().min(0).optional(),

    // Parse array parameters
    groupBy: z
        .union([z.string().transform((str) => str.split(',').filter(Boolean)), z.array(z.string())])
        .pipe(
            z
                .array(
                    z.enum([
                        'status',
                        'channel',
                        'priority',
                        'day',
                        'week',
                        'month',
                        'country',
                        'segment'
                    ])
                )
                .max(5)
        )
        .optional(),

    campaignIds: z
        .union([z.string().transform((str) => str.split(',').filter(Boolean)), z.array(z.string())])
        .pipe(z.array(z.string().uuid()).max(100))
        .optional(),

    statuses: z
        .union([z.string().transform((str) => str.split(',').filter(Boolean)), z.array(z.string())])
        .optional(),

    channels: z
        .union([z.string().transform((str) => str.split(',').filter(Boolean)), z.array(z.string())])
        .optional(),

    countries: z
        .union([z.string().transform((str) => str.split(',').filter(Boolean)), z.array(z.string())])
        .pipe(z.array(z.string().length(2)).max(50))
        .optional(),

    // Coerce boolean flags
    includeImpressions: HttpFieldFactories.booleanField('includeImpressions'),
    includeClicks: HttpFieldFactories.booleanField('includeClicks'),
    includeConversions: HttpFieldFactories.booleanField('includeConversions'),
    includeSpending: HttpFieldFactories.booleanField('includeSpending'),
    includeROAS: HttpFieldFactories.booleanField('includeROAS'),
    includeComparison: HttpFieldFactories.booleanField('includeComparison')
});

/**
 * HTTP Bulk Campaign Operation Schema
 * For processing bulk operations from HTTP requests
 */
export const HttpBulkCampaignOperationSchema = BulkCampaignOperationSchema.extend({
    // Parse campaign IDs from comma-separated string or JSON array
    campaignIds: z
        .union([
            z.string().transform((str) => {
                try {
                    const parsed = JSON.parse(str);
                    return Array.isArray(parsed) ? parsed : str.split(',').filter(Boolean);
                } catch {
                    return str.split(',').filter(Boolean);
                }
            }),
            z.array(z.string())
        ])
        .pipe(z.array(z.string().uuid()).min(1).max(100)),

    // Coerce boolean flags
    force: HttpFieldFactories.booleanField('force'),
    skipValidation: HttpFieldFactories.booleanField('skipValidation'),

    // Coerce batch size
    batchSize: z.coerce.number().int().min(1).max(50).default(10),

    // Parse operation data from JSON string
    operationData: z
        .union([
            z.string().transform((str, ctx) => {
                try {
                    return JSON.parse(str);
                } catch {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'zodError.campaign.bulk.operationData.invalidJson'
                    });
                    return z.NEVER;
                }
            }),
            z.record(z.string(), z.unknown())
        ])
        .optional()
});

export type HttpCreateCampaign = z.infer<typeof HttpCreateCampaignSchema>;
export type HttpUpdateCampaign = z.infer<typeof HttpUpdateCampaignSchema>;
export type HttpSearchCampaigns = z.infer<typeof HttpSearchCampaignsSchema>;
export type HttpCampaignAnalytics = z.infer<typeof HttpCampaignAnalyticsSchema>;
export type HttpBulkCampaignOperation = z.infer<typeof HttpBulkCampaignOperationSchema>;

/**
 * Transform HTTP Campaign Create data to Domain format.
 * Converts dot notation to nested objects.
 */
export function httpToDomainCampaignCreate(httpData: HttpCreateCampaign): CreateCampaign {
    // Parse channels to proper enum array
    const channelsArray = Array.isArray(httpData.channels) ? httpData.channels : [];
    const channels = channelsArray.map((ch) => CampaignChannelSchema.parse(ch));

    // Handle dates - convert to Date objects if they're strings
    const startDate = httpData['schedule.startDate'];
    const endDate = httpData['schedule.endDate'];

    return {
        clientId: httpData.clientId,
        name: httpData.name,
        description: httpData.description,
        status: CampaignStatusSchema.parse(httpData.status),
        channels,

        // Budget: Convert dot notation to nested object
        budget: {
            totalBudget: httpData['budget.totalBudget'],
            dailyBudget: httpData['budget.dailyBudget'],
            spentAmount: 0, // Default for create
            currency: httpData['budget.currency'],
            bidStrategy: httpData['budget.bidStrategy'],
            costPerAction: undefined // Optional, not in HTTP schema
        },

        // Schedule: Convert dot notation to nested object
        // Convert ISO strings to Date objects (domain schema expects Date)
        schedule: {
            startDate: startDate instanceof Date ? startDate : new Date(startDate),
            endDate: endDate instanceof Date ? endDate : endDate ? new Date(endDate) : undefined,
            timezone: httpData['schedule.timezone']
        },

        // Content: Convert dot notation to nested object
        content: {
            subject: httpData['content.subject'],
            bodyTemplate: httpData['content.bodyTemplate'],
            callToAction: httpData['content.callToAction'],
            landingPageUrl: httpData['content.landingPageUrl'],
            assets: [] // Default empty array
        },

        // Target Audience: Convert dot notation to nested object
        targetAudience: {
            countries: httpData['targetAudience.countries'],
            regions: undefined, // Optional, not in HTTP schema
            cities: undefined, // Optional, not in HTTP schema
            ageRange: undefined, // Optional, not in HTTP schema
            interests: undefined, // Optional, not in HTTP schema
            languages: httpData['targetAudience.languages'],
            userSegments: undefined // Optional, not in HTTP schema
        },

        // Performance and settings are optional for create
        performance: undefined,
        settings: undefined
    };
}

/**
 * Transform HTTP Campaign Update data to Domain format.
 * Converts dot notation to nested objects.
 */
export function httpToDomainCampaignUpdate(httpData: HttpUpdateCampaign): UpdateCampaign {
    const result: UpdateCampaign = {};

    // Simple fields
    if (httpData.name !== undefined) result.name = httpData.name;
    if (httpData.description !== undefined) result.description = httpData.description;
    if (httpData.status !== undefined) result.status = CampaignStatusSchema.parse(httpData.status);
    if (httpData.channels !== undefined) {
        const channelsArray = Array.isArray(httpData.channels) ? httpData.channels : [];
        result.channels = channelsArray.map((ch) => CampaignChannelSchema.parse(ch));
    }

    // Budget: Convert dot notation to nested object (partial)
    const budgetFields = [
        'budget.totalBudget',
        'budget.dailyBudget',
        'budget.currency',
        'budget.bidStrategy'
    ] as const;
    const hasBudgetFields = budgetFields.some((field) => httpData[field] !== undefined);

    if (hasBudgetFields) {
        const budget: Partial<NonNullable<UpdateCampaign['budget']>> = {};
        if (httpData['budget.totalBudget'] !== undefined)
            budget.totalBudget = httpData['budget.totalBudget'];
        if (httpData['budget.dailyBudget'] !== undefined)
            budget.dailyBudget = httpData['budget.dailyBudget'];
        if (httpData['budget.currency'] !== undefined)
            budget.currency = httpData['budget.currency'];
        if (httpData['budget.bidStrategy'] !== undefined)
            budget.bidStrategy = httpData['budget.bidStrategy'];
        result.budget = budget as NonNullable<UpdateCampaign['budget']>;
    }

    // Schedule: Convert dot notation to nested object (partial)
    const scheduleFields = ['schedule.startDate', 'schedule.endDate', 'schedule.timezone'] as const;
    const hasScheduleFields = scheduleFields.some((field) => httpData[field] !== undefined);

    if (hasScheduleFields) {
        const schedule: Partial<NonNullable<UpdateCampaign['schedule']>> = {};
        // Convert ISO strings to Date objects (domain schema expects Date)
        if (httpData['schedule.startDate'] !== undefined) {
            const startDate = httpData['schedule.startDate'];
            schedule.startDate = startDate instanceof Date ? startDate : new Date(startDate);
        }
        if (httpData['schedule.endDate'] !== undefined) {
            const endDate = httpData['schedule.endDate'];
            schedule.endDate = endDate instanceof Date ? endDate : new Date(endDate);
        }
        if (httpData['schedule.timezone'] !== undefined)
            schedule.timezone = httpData['schedule.timezone'];
        result.schedule = schedule as NonNullable<UpdateCampaign['schedule']>;
    }

    // Content: Convert dot notation to nested object (partial)
    const contentFields = [
        'content.subject',
        'content.bodyTemplate',
        'content.callToAction',
        'content.landingPageUrl'
    ] as const;
    const hasContentFields = contentFields.some((field) => httpData[field] !== undefined);

    if (hasContentFields) {
        const content: Partial<NonNullable<UpdateCampaign['content']>> = {};
        if (httpData['content.subject'] !== undefined)
            content.subject = httpData['content.subject'];
        if (httpData['content.bodyTemplate'] !== undefined)
            content.bodyTemplate = httpData['content.bodyTemplate'];
        if (httpData['content.callToAction'] !== undefined)
            content.callToAction = httpData['content.callToAction'];
        if (httpData['content.landingPageUrl'] !== undefined)
            content.landingPageUrl = httpData['content.landingPageUrl'];
        result.content = content as NonNullable<UpdateCampaign['content']>;
    }

    // Target Audience: Convert dot notation to nested object (partial)
    const targetAudienceFields = ['targetAudience.countries', 'targetAudience.languages'] as const;
    const hasTargetAudienceFields = targetAudienceFields.some(
        (field) => httpData[field] !== undefined
    );

    if (hasTargetAudienceFields) {
        const targetAudience: Partial<NonNullable<UpdateCampaign['targetAudience']>> = {};
        if (httpData['targetAudience.countries'] !== undefined)
            targetAudience.countries = httpData['targetAudience.countries'];
        if (httpData['targetAudience.languages'] !== undefined)
            targetAudience.languages = httpData['targetAudience.languages'];
        result.targetAudience = targetAudience;
    }

    return result;
}
