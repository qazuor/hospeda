import { z } from 'zod';
import { HttpFieldFactories } from '../../utils/http-field.factory.js';
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
 */
export const HttpUpdateCampaignSchema = HttpCreateCampaignSchema.partial();

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
