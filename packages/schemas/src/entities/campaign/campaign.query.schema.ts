import { z } from 'zod';
import { PaginationSchema, SortingSchema } from '../../common/pagination.schema.js';
import { CampaignChannelSchema, CampaignStatusSchema } from '../../enums/index.js';

/**
 * Search Campaigns Schema
 * Comprehensive filtering and searching for campaigns
 */
export const SearchCampaignsSchema = z
    .object({
        // Base pagination and sorting
        ...PaginationSchema.shape,
        ...SortingSchema.shape,

        // Text search
        q: z
            .string()
            .min(1)
            .max(200)
            .optional()
            .describe('Search in campaign name and description'),

        // Status filtering
        status: CampaignStatusSchema.optional().describe('Filter by campaign status'),
        statuses: z
            .array(CampaignStatusSchema)
            .max(10)
            .optional()
            .describe('Filter by multiple statuses'),

        // Channel filtering
        channel: CampaignChannelSchema.optional().describe('Filter by specific channel'),
        channels: z
            .array(CampaignChannelSchema)
            .max(10)
            .optional()
            .describe('Filter by multiple channels'),

        // Budget filtering
        minBudget: z.number().positive().max(1000000).optional().describe('Minimum total budget'),
        maxBudget: z.number().positive().max(1000000).optional().describe('Maximum total budget'),

        // Date filtering
        createdAfter: z.coerce.date().optional().describe('Created after this date'),
        createdBefore: z.coerce.date().optional().describe('Created before this date'),
        startedAfter: z.coerce.date().optional().describe('Started after this date'),
        startedBefore: z.coerce.date().optional().describe('Started before this date'),
        endingAfter: z.coerce.date().optional().describe('Ending after this date'),
        endingBefore: z.coerce.date().optional().describe('Ending before this date'),

        // Performance filtering
        minImpressions: z.number().int().min(0).optional().describe('Minimum impressions'),
        maxImpressions: z.number().int().min(0).optional().describe('Maximum impressions'),
        minClicks: z.number().int().min(0).optional().describe('Minimum clicks'),
        maxClicks: z.number().int().min(0).optional().describe('Maximum clicks'),
        minConversions: z.number().int().min(0).optional().describe('Minimum conversions'),
        maxConversions: z.number().int().min(0).optional().describe('Maximum conversions'),
        minClickThroughRate: z
            .number()
            .min(0)
            .max(1)
            .optional()
            .describe('Minimum click-through rate'),
        maxClickThroughRate: z
            .number()
            .min(0)
            .max(1)
            .optional()
            .describe('Maximum click-through rate'),
        minConversionRate: z.number().min(0).max(1).optional().describe('Minimum conversion rate'),
        maxConversionRate: z.number().min(0).max(1).optional().describe('Maximum conversion rate'),

        // Targeting filtering
        targetCountries: z
            .array(z.string().length(2))
            .max(50)
            .optional()
            .describe('Filter by target countries'),
        targetRegions: z
            .array(z.string().max(100))
            .max(100)
            .optional()
            .describe('Filter by target regions'),
        targetLanguages: z
            .array(z.string().length(2))
            .max(20)
            .optional()
            .describe('Filter by target languages'),
        targetSegments: z
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
            .describe('Filter by user segments'),

        // Campaign settings filtering
        priority: z.number().int().min(1).max(5).optional().describe('Filter by priority level'),
        minPriority: z.number().int().min(1).max(5).optional().describe('Minimum priority level'),
        maxPriority: z.number().int().min(1).max(5).optional().describe('Maximum priority level'),
        isTestCampaign: z.boolean().optional().describe('Filter test campaigns'),
        allowOptOut: z.boolean().optional().describe('Filter by opt-out setting'),
        trackingEnabled: z.boolean().optional().describe('Filter by tracking setting'),

        // Advanced filtering
        tags: z.array(z.string().max(50)).max(20).optional().describe('Filter by campaign tags'),
        hasNotes: z.boolean().optional().describe('Filter campaigns with/without notes'),
        bidStrategy: z
            .enum(['manual', 'automatic', 'target_cpa', 'maximize_conversions'])
            .optional()
            .describe('Filter by bid strategy'),

        // Creator filtering
        createdBy: z.string().uuid().optional().describe('Filter by creator user ID'),
        updatedBy: z.string().uuid().optional().describe('Filter by last updater user ID'),

        // Include/exclude options
        includeDeleted: z.boolean().default(false).describe('Include soft-deleted campaigns'),
        includePerformance: z.boolean().default(true).describe('Include performance metrics'),
        includeSettings: z.boolean().default(false).describe('Include settings object')
    })
    .refine(
        (data) => {
            // Validate budget range
            if (data.minBudget && data.maxBudget) {
                return data.minBudget <= data.maxBudget;
            }
            return true;
        },
        {
            message: 'zodError.campaign.search.invalidBudgetRange',
            path: ['minBudget']
        }
    )
    .refine(
        (data) => {
            // Validate date ranges
            if (data.createdAfter && data.createdBefore) {
                return data.createdAfter <= data.createdBefore;
            }
            return true;
        },
        {
            message: 'zodError.campaign.search.invalidCreatedDateRange',
            path: ['createdAfter']
        }
    )
    .refine(
        (data) => {
            // Validate performance ranges
            if (data.minImpressions && data.maxImpressions) {
                return data.minImpressions <= data.maxImpressions;
            }
            return true;
        },
        {
            message: 'zodError.campaign.search.invalidImpressionsRange',
            path: ['minImpressions']
        }
    );

/**
 * Campaign Analytics Schema
 * For generating campaign analytics and reports
 */
export const CampaignAnalyticsSchema = z
    .object({
        // Date range for analytics
        fromDate: z.coerce.date().describe('Start date for analytics'),
        toDate: z.coerce.date().describe('End date for analytics'),

        // Grouping options
        groupBy: z
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
            .optional()
            .describe('Group analytics by these dimensions'),

        // Filter options
        campaignIds: z
            .array(z.string().uuid())
            .max(100)
            .optional()
            .describe('Specific campaign IDs to analyze'),
        statuses: z
            .array(CampaignStatusSchema)
            .max(10)
            .optional()
            .describe('Filter by campaign statuses'),
        channels: z.array(CampaignChannelSchema).max(10).optional().describe('Filter by channels'),
        countries: z.array(z.string().length(2)).max(50).optional().describe('Filter by countries'),

        // Metrics to include
        includeImpressions: z.boolean().default(true).describe('Include impression metrics'),
        includeClicks: z.boolean().default(true).describe('Include click metrics'),
        includeConversions: z.boolean().default(true).describe('Include conversion metrics'),
        includeSpending: z.boolean().default(true).describe('Include spending metrics'),
        includeROAS: z.boolean().default(true).describe('Include ROAS metrics'),
        includeComparison: z.boolean().default(false).describe('Include period comparison'),

        // Performance thresholds
        minClickThroughRate: z.number().min(0).max(1).optional().describe('Minimum CTR threshold'),
        minConversionRate: z
            .number()
            .min(0)
            .max(1)
            .optional()
            .describe('Minimum conversion rate threshold'),
        minROAS: z.number().min(0).optional().describe('Minimum ROAS threshold')
    })
    .refine(
        (data) => {
            return data.fromDate <= data.toDate;
        },
        {
            message: 'zodError.campaign.analytics.invalidDateRange',
            path: ['fromDate']
        }
    )
    .refine(
        (data) => {
            // Limit date range to 2 years maximum
            const diffMs = data.toDate.getTime() - data.fromDate.getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            return diffDays <= 730;
        },
        {
            message: 'zodError.campaign.analytics.dateRangeTooLarge',
            path: ['toDate']
        }
    );

/**
 * Bulk Campaign Operations Schema
 * For bulk operations on multiple campaigns
 */
export const BulkCampaignOperationSchema = z
    .object({
        // Operation type
        operation: z
            .enum([
                'activate',
                'pause',
                'cancel',
                'delete',
                'update_priority',
                'update_budget',
                'archive'
            ])
            .describe('Bulk operation to perform'),

        // Campaign selection
        campaignIds: z
            .array(z.string().uuid())
            .min(1)
            .max(100)
            .describe('Campaign IDs to operate on'),

        // Operation parameters
        operationData: z
            .record(z.string(), z.unknown())
            .optional()
            .describe('Additional data for the operation'),

        // Execution options
        force: z
            .boolean()
            .default(false)
            .describe('Force operation even if campaigns are in conflicting states'),
        skipValidation: z.boolean().default(false).describe('Skip individual campaign validation'),
        batchSize: z
            .number()
            .int()
            .min(1)
            .max(50)
            .default(10)
            .describe('Number of campaigns to process per batch'),

        // Audit information
        reason: z.string().max(500).optional().describe('Reason for bulk operation'),
        performedBy: z.string().uuid().describe('User ID performing the operation')
    })
    .refine(
        (data) => {
            // Validate operation-specific data
            if (data.operation === 'update_priority' && data.operationData) {
                const priority = data.operationData.priority;
                return typeof priority === 'number' && priority >= 1 && priority <= 5;
            }
            return true;
        },
        {
            message: 'zodError.campaign.bulk.invalidPriorityData',
            path: ['operationData']
        }
    )
    .refine(
        (data) => {
            // Validate budget update data
            if (data.operation === 'update_budget' && data.operationData) {
                const { totalBudget, dailyBudget } = data.operationData;
                if (totalBudget && dailyBudget) {
                    return Number(dailyBudget) <= Number(totalBudget);
                }
            }
            return true;
        },
        {
            message: 'zodError.campaign.bulk.invalidBudgetData',
            path: ['operationData']
        }
    );

export type SearchCampaigns = z.infer<typeof SearchCampaignsSchema>;
export type CampaignAnalytics = z.infer<typeof CampaignAnalyticsSchema>;
export type BulkCampaignOperation = z.infer<typeof BulkCampaignOperationSchema>;
