import { z } from 'zod';
import { ProfessionalServiceCategorySchema } from '../../enums/index.js';

/**
 * Search Professional Services Schema
 *
 * Schema for searching and filtering professional services with pagination.
 */
export const SearchProfessionalServicesSchema = z
    .object({
        // Text search
        q: z.string().min(1).max(200).optional().describe('Search in service name and description'),

        // Category filtering
        category: ProfessionalServiceCategorySchema.optional(),
        categories: z
            .array(ProfessionalServiceCategorySchema)
            .max(8)
            .optional()
            .describe('Filter by multiple categories'),

        // Status filtering
        isActive: z.boolean().optional().describe('Filter by active status'),

        // Pricing filtering
        minPrice: z.number().min(0).optional().describe('Minimum base price filter'),

        maxPrice: z.number().positive().optional().describe('Maximum base price filter'),

        billingUnit: z
            .enum(['hour', 'day', 'project', 'month'])
            .optional()
            .describe('Filter by billing unit'),

        currency: z.string().length(3).optional().describe('Filter by currency'),

        // Pagination
        page: z.number().int().min(1).default(1).describe('Page number for pagination'),

        pageSize: z.number().int().min(1).max(100).default(20).describe('Number of items per page'),

        // Sorting
        sortBy: z
            .enum(['name', 'category', 'basePrice', 'createdAt', 'updatedAt'])
            .default('createdAt')
            .describe('Field to sort by'),

        sortOrder: z.enum(['asc', 'desc']).default('desc').describe('Sort order')
    })
    .refine((data) => !data.minPrice || !data.maxPrice || data.minPrice <= data.maxPrice, {
        message: 'zodError.professionalService.search.invalidPriceRange',
        path: ['maxPrice']
    });

export type SearchProfessionalServices = z.infer<typeof SearchProfessionalServicesSchema>;

/**
 * Professional Service Analytics Schema
 *
 * Schema for aggregated analytics and statistics.
 */
export const ProfessionalServiceAnalyticsSchema = z
    .object({
        // Time period for analytics
        startDate: z.coerce.date().optional().describe('Start date for analytics period'),

        endDate: z.coerce.date().optional().describe('End date for analytics period'),

        // Grouping options
        groupBy: z
            .enum(['category', 'billingUnit', 'currency', 'month', 'week'])
            .optional()
            .describe('Group analytics by specified field'),

        // Metrics to include
        includeMetrics: z
            .array(z.enum(['orders', 'revenue', 'avgOrderValue', 'popularServices']))
            .default(['orders', 'revenue'])
            .describe('Metrics to include in analytics')
    })
    .refine((data) => !data.startDate || !data.endDate || data.startDate <= data.endDate, {
        message: 'zodError.professionalService.analytics.invalidDateRange',
        path: ['endDate']
    });

export type ProfessionalServiceAnalytics = z.infer<typeof ProfessionalServiceAnalyticsSchema>;

/**
 * Bulk Professional Service Operation Schema
 *
 * Schema for performing bulk operations on multiple services.
 */
export const BulkProfessionalServiceOperationSchema = z.object({
    // Service IDs to operate on
    serviceIds: z
        .array(z.string().uuid())
        .min(1, { message: 'zodError.professionalService.bulk.minServices' })
        .max(100, { message: 'zodError.professionalService.bulk.maxServices' })
        .describe('List of service IDs to operate on'),

    // Operation to perform
    operation: z
        .enum(['activate', 'deactivate', 'updateCategory', 'updatePricing'])
        .describe('Bulk operation to perform'),

    // Operation-specific data
    data: z
        .object({
            isActive: z.boolean().optional(),
            category: ProfessionalServiceCategorySchema.optional(),
            pricingMultiplier: z.number().positive().max(10).optional(),
            adminInfo: z.record(z.string(), z.unknown()).optional()
        })
        .optional()
        .describe('Data for the bulk operation')
});

export type BulkProfessionalServiceOperation = z.infer<
    typeof BulkProfessionalServiceOperationSchema
>;
