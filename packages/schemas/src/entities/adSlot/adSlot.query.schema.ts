import { z } from 'zod';
import { AdSlotIdSchema } from '../../common/id.schema.js';
import {
    BaseSearchSchema,
    PaginationSchema,
    SortingSchema
} from '../../common/pagination.schema.js';

/**
 * AdSlot Query Schemas
 *
 * Comprehensive query and search schemas for ad slots with advanced filtering,
 * performance analytics, availability checks, and reservation management.
 */

// Base search schema for ad slots
export const AdSlotSearchSchema = BaseSearchSchema.extend({
    // Placement filtering
    page: z
        .enum([
            'homepage',
            'search_results',
            'accommodation_detail',
            'booking_flow',
            'user_profile',
            'destination_page',
            'blog_post',
            'email_newsletter'
        ])
        .optional()
        .describe('Filter by page placement'),

    position: z
        .enum([
            'header',
            'sidebar_top',
            'sidebar_bottom',
            'content_top',
            'content_middle',
            'content_bottom',
            'footer',
            'overlay',
            'banner',
            'sponsored_content'
        ])
        .optional()
        .describe('Filter by position within page'),

    priority: z.number().int().min(1).max(10).optional().describe('Filter by display priority'),

    // Format and size filtering
    minWidth: z.number().int().min(50).optional().describe('Minimum width requirement'),

    maxWidth: z.number().int().max(2000).optional().describe('Maximum width requirement'),

    minHeight: z.number().int().min(50).optional().describe('Minimum height requirement'),

    maxHeight: z.number().int().max(2000).optional().describe('Maximum height requirement'),

    allowedFormats: z
        .array(
            z.enum(['banner', 'square', 'rectangle', 'skyscraper', 'leaderboard', 'mobile_banner'])
        )
        .max(6)
        .optional()
        .describe('Filter by allowed ad formats'),

    isResponsive: z.boolean().optional().describe('Filter by responsive capability'),

    // Pricing filtering
    pricingModel: z
        .enum(['cpm', 'cpc', 'cpa', 'fixed_rate'])
        .optional()
        .describe('Filter by pricing model'),

    minPrice: z.number().positive().optional().describe('Minimum base price'),

    maxPrice: z.number().positive().optional().describe('Maximum base price'),

    currency: z.string().length(3).optional().describe('Filter by pricing currency'),

    // Availability filtering
    isActive: z.boolean().optional().describe('Filter by active status'),

    availableAfter: z.date().optional().describe('Available after specific date'),

    availableBefore: z.date().optional().describe('Available before specific date'),

    hasAvailableTimeSlots: z
        .boolean()
        .optional()
        .describe('Filter slots with time slot restrictions'),

    maxReservationsPerDay: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe('Filter by maximum daily reservations'),

    // Targeting filtering
    allowedCountries: z
        .array(z.string().length(2))
        .max(10)
        .optional()
        .describe('Filter by allowed countries'),

    allowedDevices: z
        .array(z.enum(['desktop', 'mobile', 'tablet']))
        .optional()
        .describe('Filter by allowed devices'),

    allowedContentTypes: z
        .array(z.enum(['accommodation', 'destination', 'experience', 'blog', 'general']))
        .optional()
        .describe('Filter by allowed content types'),

    requiresAuthentication: z.boolean().optional().describe('Filter by authentication requirement'),

    allowedUserTypes: z
        .array(z.enum(['guest', 'host', 'premium', 'all']))
        .optional()
        .describe('Filter by allowed user types'),

    // Performance filtering
    minImpressions: z.number().int().min(0).optional().describe('Minimum total impressions'),

    maxImpressions: z.number().int().min(0).optional().describe('Maximum total impressions'),

    minCTR: z.number().min(0).max(1).optional().describe('Minimum click-through rate'),

    maxCTR: z.number().min(0).max(1).optional().describe('Maximum click-through rate'),

    minRevenue: z.number().min(0).optional().describe('Minimum total revenue'),

    maxRevenue: z.number().min(0).optional().describe('Maximum total revenue'),

    minFillRate: z.number().min(0).max(1).optional().describe('Minimum fill rate'),

    // Content restrictions filtering
    blockedCategories: z
        .array(
            z.enum(['adult', 'gambling', 'alcohol', 'tobacco', 'political', 'medical', 'financial'])
        )
        .optional()
        .describe('Filter by blocked content categories'),

    allowExternalLinks: z.boolean().optional().describe('Filter by external link allowance'),

    requiresReview: z.boolean().optional().describe('Filter by review requirement'),

    // Metadata filtering
    tags: z.array(z.string().max(50)).max(10).optional().describe('Filter by tags'),

    category: z.string().max(100).optional().describe('Filter by slot category'),

    isTestSlot: z.boolean().optional().describe('Filter test slots'),

    autoApprove: z.boolean().optional().describe('Filter by auto-approval setting')
});

// Sorting schema for ad slots
export const AdSlotSortingSchema = SortingSchema.extend({
    sortBy: z
        .enum([
            'createdAt',
            'updatedAt',
            'name',
            'priority',
            'basePrice',
            'totalImpressions',
            'totalClicks',
            'totalRevenue',
            'averageCTR',
            'averageRPM',
            'fillRate',
            'lastImpressionAt',
            'availableFrom',
            'availableUntil'
        ])
        .default('priority')
        .describe('Field to sort by')
});

// Pagination schema for ad slots
export const AdSlotPaginationSchema = PaginationSchema.extend({
    pageSize: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe('Number of slots per page (max 100)')
});

// Complete query schema combining all filters
export const AdSlotQuerySchema = z.object({
    search: AdSlotSearchSchema.optional(),
    sort: AdSlotSortingSchema.optional(),
    pagination: AdSlotPaginationSchema.optional(),

    // Additional query options
    includePerformance: z
        .boolean()
        .default(false)
        .describe('Include performance metrics in response'),

    includeInactive: z.boolean().default(false).describe('Include inactive slots in results'),

    includeTestSlots: z.boolean().default(false).describe('Include test slots in results')
});

// Schema for availability checks
export const AdSlotAvailabilityQuerySchema = z
    .object({
        slotIds: z.array(AdSlotIdSchema).min(1).max(50).describe('Slot IDs to check availability'),

        startDate: z.date().describe('Start date for availability check'),

        endDate: z.date().describe('End date for availability check'),

        timeSlots: z
            .array(
                z.object({
                    dayOfWeek: z.number().int().min(0).max(6),
                    startTime: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/),
                    endTime: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/),
                    timezone: z.string().default('UTC')
                })
            )
            .max(21)
            .optional()
            .describe('Specific time slots to check'),

        excludeBlackoutDates: z
            .boolean()
            .default(true)
            .describe('Whether to exclude blackout dates from availability')
    })
    .refine((data) => data.startDate <= data.endDate, {
        message: 'zodError.adSlot.availability.invalidDateRange',
        path: ['endDate']
    });

// Schema for performance analytics queries
export const AdSlotPerformanceQuerySchema = z.object({
    slotIds: z.array(AdSlotIdSchema).min(1).max(20).describe('Slot IDs for performance analysis'),

    dateRange: z
        .object({
            startDate: z.date(),
            endDate: z.date(),
            granularity: z.enum(['hour', 'day', 'week', 'month']).default('day')
        })
        .refine((data) => data.startDate <= data.endDate, {
            message: 'zodError.adSlot.performance.invalidDateRange',
            path: ['endDate']
        }),

    metrics: z
        .array(z.enum(['impressions', 'clicks', 'revenue', 'ctr', 'rpm', 'fillRate']))
        .min(1)
        .max(6)
        .default(['impressions', 'clicks', 'revenue', 'ctr'])
        .describe('Metrics to include in analysis'),

    groupBy: z
        .array(z.enum(['slot', 'page', 'position', 'device', 'country', 'contentType']))
        .max(3)
        .default([])
        .describe('Dimensions to group results by'),

    compareWithPrevious: z
        .boolean()
        .default(false)
        .describe('Include comparison with previous period'),

    includeBenchmarks: z.boolean().default(false).describe('Include industry benchmark data')
});

// Schema for reservation analytics
export const AdSlotReservationAnalyticsSchema = z.object({
    slotIds: z
        .array(AdSlotIdSchema)
        .max(10)
        .optional()
        .describe('Specific slots to analyze (optional)'),

    dateRange: z
        .object({
            startDate: z.date(),
            endDate: z.date()
        })
        .refine((data) => data.startDate <= data.endDate, {
            message: 'zodError.adSlot.reservationAnalytics.invalidDateRange',
            path: ['endDate']
        }),

    analysisType: z
        .enum(['utilization', 'revenue', 'demand', 'competition'])
        .describe('Type of analysis to perform'),

    includeForecasting: z.boolean().default(false).describe('Include demand forecasting data'),

    breakdownBy: z
        .array(z.enum(['placement', 'format', 'pricing', 'targeting']))
        .max(3)
        .default(['placement'])
        .describe('How to break down the analysis')
});

// Schema for slot recommendations
export const AdSlotRecommendationQuerySchema = z.object({
    targetAudience: z
        .object({
            countries: z.array(z.string().length(2)).max(10).optional(),
            devices: z.array(z.enum(['desktop', 'mobile', 'tablet'])).optional(),
            userTypes: z.array(z.enum(['guest', 'host', 'premium', 'all'])).optional(),
            contentTypes: z
                .array(z.enum(['accommodation', 'destination', 'experience', 'blog', 'general']))
                .optional()
        })
        .optional(),

    campaign: z.object({
        budget: z.number().positive().max(100000),
        duration: z.number().int().min(1).max(365),
        objective: z.enum(['awareness', 'traffic', 'conversions', 'revenue']),
        pricingModel: z.enum(['cpm', 'cpc', 'cpa', 'fixed_rate']).optional()
    }),

    preferences: z
        .object({
            preferredPlacements: z
                .array(
                    z.enum([
                        'homepage',
                        'search_results',
                        'accommodation_detail',
                        'booking_flow',
                        'user_profile',
                        'destination_page',
                        'blog_post',
                        'email_newsletter'
                    ])
                )
                .max(8)
                .optional(),

            excludedPlacements: z
                .array(
                    z.enum([
                        'homepage',
                        'search_results',
                        'accommodation_detail',
                        'booking_flow',
                        'user_profile',
                        'destination_page',
                        'blog_post',
                        'email_newsletter'
                    ])
                )
                .max(8)
                .optional(),

            maxPricePerSlot: z.number().positive().optional(),
            minPerformanceThreshold: z
                .object({
                    ctr: z.number().min(0).max(1).optional(),
                    fillRate: z.number().min(0).max(1).optional()
                })
                .optional()
        })
        .optional(),

    includeAlternatives: z
        .boolean()
        .default(true)
        .describe('Include alternative slot recommendations'),

    maxRecommendations: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10)
        .describe('Maximum number of recommendations to return')
});

export type AdSlotSearch = z.infer<typeof AdSlotSearchSchema>;
export type AdSlotSorting = z.infer<typeof AdSlotSortingSchema>;
export type AdSlotPagination = z.infer<typeof AdSlotPaginationSchema>;
export type AdSlotQuery = z.infer<typeof AdSlotQuerySchema>;
export type AdSlotAvailabilityQuery = z.infer<typeof AdSlotAvailabilityQuerySchema>;
export type AdSlotPerformanceQuery = z.infer<typeof AdSlotPerformanceQuerySchema>;
export type AdSlotReservationAnalytics = z.infer<typeof AdSlotReservationAnalyticsSchema>;
export type AdSlotRecommendationQuery = z.infer<typeof AdSlotRecommendationQuerySchema>;
