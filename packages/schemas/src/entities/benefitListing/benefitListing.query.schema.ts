import { z } from 'zod';
import {
    BenefitListingPlanIdSchema,
    BenefitPartnerIdSchema,
    ClientIdSchema
} from '../../common/id.schema.js';
import { ListingStatusSchema } from '../../enums/index.js';

/**
 * Search Benefit Listings Schema
 *
 * Schema for searching and filtering benefit listings with pagination.
 */
export const SearchBenefitListingsSchema = z
    .object({
        // Text search
        q: z
            .string()
            .min(1)
            .max(200)
            .optional()
            .describe('Search in benefit details and partner name'),

        // Relationship filtering
        clientId: ClientIdSchema.optional(),
        benefitPartnerId: BenefitPartnerIdSchema.optional(),
        listingPlanId: BenefitListingPlanIdSchema.optional(),

        // Status filtering
        status: ListingStatusSchema.optional(),
        statuses: z
            .array(ListingStatusSchema)
            .max(4)
            .optional()
            .describe('Filter by multiple statuses'),

        // Trial filtering
        isTrial: z.boolean().optional().describe('Filter by trial status'),

        // Date filtering
        activeBetween: z
            .object({
                start: z.coerce.date(),
                end: z.coerce.date()
            })
            .refine((data) => data.start <= data.end, {
                message: 'zodError.benefitListing.search.invalidDateRange'
            })
            .optional()
            .describe('Filter listings active within date range'),

        validFrom: z.coerce.date().optional().describe('Filter listings valid from this date'),

        validUntil: z.coerce.date().optional().describe('Filter listings valid until this date'),

        // Benefit type filtering
        benefitType: z
            .enum(['discount_percentage', 'fixed_discount', 'any'])
            .optional()
            .describe('Filter by benefit type'),

        // Discount filtering
        minDiscountPercentage: z
            .number()
            .min(0)
            .max(100)
            .optional()
            .describe('Minimum discount percentage filter'),

        maxDiscountPercentage: z
            .number()
            .min(0)
            .max(100)
            .optional()
            .describe('Maximum discount percentage filter'),

        minFixedDiscount: z
            .number()
            .min(0)
            .optional()
            .describe('Minimum fixed discount amount filter'),

        maxFixedDiscount: z
            .number()
            .min(0)
            .optional()
            .describe('Maximum fixed discount amount filter'),

        currency: z.string().length(3).optional().describe('Filter by currency'),

        // Partner category filtering
        partnerCategory: z.string().max(100).optional().describe('Filter by partner category'),

        // Pagination
        page: z.number().int().min(1).default(1).describe('Page number for pagination'),

        pageSize: z.number().int().min(1).max(100).default(20).describe('Number of items per page'),

        // Sorting
        sortBy: z
            .enum(['fromDate', 'toDate', 'status', 'discountPercentage', 'createdAt', 'updatedAt'])
            .default('createdAt')
            .describe('Field to sort by'),

        sortOrder: z.enum(['asc', 'desc']).default('desc').describe('Sort order'),

        // Include related data
        includePartner: z
            .boolean()
            .default(false)
            .describe('Include partner information in response')
    })
    .refine(
        (data) =>
            !data.minDiscountPercentage ||
            !data.maxDiscountPercentage ||
            data.minDiscountPercentage <= data.maxDiscountPercentage,
        {
            message: 'zodError.benefitListing.search.invalidDiscountPercentageRange',
            path: ['maxDiscountPercentage']
        }
    )
    .refine(
        (data) =>
            !data.minFixedDiscount ||
            !data.maxFixedDiscount ||
            data.minFixedDiscount <= data.maxFixedDiscount,
        {
            message: 'zodError.benefitListing.search.invalidFixedDiscountRange',
            path: ['maxFixedDiscount']
        }
    );

export type SearchBenefitListings = z.infer<typeof SearchBenefitListingsSchema>;

/**
 * Benefit Listing Analytics Schema
 *
 * Schema for aggregated analytics and statistics.
 */
export const BenefitListingAnalyticsSchema = z
    .object({
        // Time period for analytics
        startDate: z.coerce.date().optional().describe('Start date for analytics period'),

        endDate: z.coerce.date().optional().describe('End date for analytics period'),

        // Grouping options
        groupBy: z
            .enum(['partner', 'category', 'benefitType', 'status', 'month', 'week'])
            .optional()
            .describe('Group analytics by specified field'),

        // Metrics to include
        includeMetrics: z
            .array(
                z.enum([
                    'listings',
                    'activeListings',
                    'redemptions',
                    'avgDiscount',
                    'popularBenefits'
                ])
            )
            .default(['listings', 'activeListings'])
            .describe('Metrics to include in analytics'),

        // Filter specific partners or categories
        partnerIds: z
            .array(BenefitPartnerIdSchema)
            .max(50)
            .optional()
            .describe('Specific partners to include in analytics'),

        categories: z
            .array(z.string().max(100))
            .max(20)
            .optional()
            .describe('Specific categories to include in analytics')
    })
    .refine((data) => !data.startDate || !data.endDate || data.startDate <= data.endDate, {
        message: 'zodError.benefitListing.analytics.invalidDateRange',
        path: ['endDate']
    });

export type BenefitListingAnalytics = z.infer<typeof BenefitListingAnalyticsSchema>;

/**
 * Bulk Benefit Listing Operation Schema
 *
 * Schema for performing bulk operations on multiple benefit listings.
 */
export const BulkBenefitListingOperationSchema = z.object({
    // Listing IDs to operate on
    listingIds: z
        .array(z.string().uuid())
        .min(1, { message: 'zodError.benefitListing.bulk.minListings' })
        .max(100, { message: 'zodError.benefitListing.bulk.maxListings' })
        .describe('List of listing IDs to operate on'),

    // Operation to perform
    operation: z
        .enum(['activate', 'pause', 'archive', 'updateStatus', 'extendTrial', 'updateDiscount'])
        .describe('Bulk operation to perform'),

    // Operation-specific data
    data: z
        .object({
            status: ListingStatusSchema.optional(),
            trialExtensionDays: z.number().int().min(1).max(365).optional(),
            discountPercentage: z.number().min(0).max(100).optional(),
            fixedDiscountAmount: z.number().min(0).optional(),
            currency: z.string().length(3).optional(),
            adminInfo: z.record(z.string(), z.unknown()).optional()
        })
        .optional()
        .describe('Data for the bulk operation')
});

export type BulkBenefitListingOperation = z.infer<typeof BulkBenefitListingOperationSchema>;

/**
 * Benefit Usage Analytics Schema
 *
 * Schema for tracking benefit usage and redemption analytics.
 */
export const BenefitUsageAnalyticsSchema = z
    .object({
        // Listing ID to analyze
        listingId: z.string().uuid().optional(),

        // Partner analysis
        partnerId: BenefitPartnerIdSchema.optional(),

        // Time period for usage analytics
        startDate: z.coerce.date().optional().describe('Start date for usage period'),

        endDate: z.coerce.date().optional().describe('End date for usage period'),

        // Metrics to include
        includeMetrics: z
            .array(
                z.enum([
                    'redemptions',
                    'uniqueUsers',
                    'totalValue',
                    'avgUsagePerUser',
                    'conversionRate'
                ])
            )
            .default(['redemptions', 'uniqueUsers'])
            .describe('Usage metrics to include'),

        // Grouping for time series
        groupBy: z
            .enum(['day', 'week', 'month'])
            .optional()
            .describe('Time grouping for usage trends')
    })
    .refine((data) => !data.startDate || !data.endDate || data.startDate <= data.endDate, {
        message: 'zodError.benefitListing.usage.invalidDateRange',
        path: ['endDate']
    });

export type BenefitUsageAnalytics = z.infer<typeof BenefitUsageAnalyticsSchema>;
