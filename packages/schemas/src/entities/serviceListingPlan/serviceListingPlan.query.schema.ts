import { z } from 'zod';
import { ServiceListingPlanIdSchema } from '../../common/id.schema.js';
import { PaginationSchema, SortingSchema } from '../../common/pagination.schema.js';
import { SupportLevelSchema } from '../../enums/support-level.schema.js';

/**
 * Service Listing Plan Query Schema
 *
 * Schema for querying service listing plan entries with various filters, pagination, and sorting options.
 */
export const ServiceListingPlanQuerySchema = z.object({
    // Plan ID filter
    id: z.union([ServiceListingPlanIdSchema, z.array(ServiceListingPlanIdSchema)]).optional(),

    // Status filter
    isActive: z.boolean().optional(),

    // Trial filter
    isTrialAvailable: z.boolean().optional(),

    // Name search (partial match)
    name: z.string().min(1, { message: 'zodError.serviceListingPlan.query.name.min' }).optional(),

    // Description search (partial match)
    description: z
        .string()
        .min(1, { message: 'zodError.serviceListingPlan.query.description.min' })
        .optional(),

    // Price range filters
    priceMin: z
        .number()
        .nonnegative({ message: 'zodError.serviceListingPlan.query.priceMin.nonnegative' })
        .optional(),

    priceMax: z
        .number()
        .nonnegative({ message: 'zodError.serviceListingPlan.query.priceMax.nonnegative' })
        .optional(),

    // Max listings range filters
    maxListingsMin: z
        .number()
        .int({ message: 'zodError.serviceListingPlan.query.maxListingsMin.int' })
        .positive({ message: 'zodError.serviceListingPlan.query.maxListingsMin.positive' })
        .optional(),

    maxListingsMax: z
        .number()
        .int({ message: 'zodError.serviceListingPlan.query.maxListingsMax.int' })
        .positive({ message: 'zodError.serviceListingPlan.query.maxListingsMax.positive' })
        .optional(),

    // Feature filters
    allowPremiumFeatures: z.boolean().optional(),
    allowAnalytics: z.boolean().optional(),
    allowCustomPricing: z.boolean().optional(),
    allowMultiLanguage: z.boolean().optional(),
    allowCustomBranding: z.boolean().optional(),
    allowBookingIntegration: z.boolean().optional(),

    // Support level filter
    supportLevel: z.union([SupportLevelSchema, z.array(SupportLevelSchema)]).optional(),

    // Priority range filters
    priorityMin: z
        .number()
        .int({ message: 'zodError.serviceListingPlan.query.priorityMin.int' })
        .optional(),

    priorityMax: z
        .number()
        .int({ message: 'zodError.serviceListingPlan.query.priorityMax.int' })
        .optional(),

    // Pagination and sorting
    ...PaginationSchema.shape,
    ...SortingSchema.extend({
        sortBy: z
            .enum(['name', 'price', 'priority', 'isActive', 'createdAt', 'updatedAt'])
            .default('createdAt')
    }).shape
});

/**
 * Service Listing Plan Search Schema
 *
 * Schema for full-text search across service listing plan entries with optional filters.
 */
export const ServiceListingPlanSearchSchema = ServiceListingPlanQuerySchema.extend({
    // Text search query
    q: z
        .string()
        .min(2, { message: 'zodError.serviceListingPlan.search.query.min' })
        .max(200, { message: 'zodError.serviceListingPlan.search.query.max' })
        .optional()
});

/**
 * Type exports for Service Listing Plan query operations
 */
export type ServiceListingPlanQuery = z.infer<typeof ServiceListingPlanQuerySchema>;
export type ServiceListingPlanSearch = z.infer<typeof ServiceListingPlanSearchSchema>;
