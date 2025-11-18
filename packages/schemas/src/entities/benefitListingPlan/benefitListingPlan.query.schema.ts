import { z } from 'zod';
import { BenefitListingPlanIdSchema } from '../../common/id.schema.js';
import { PaginationSchema, SortingSchema } from '../../common/pagination.schema.js';

/**
 * Benefit Listing Plan Query Schema
 *
 * Schema for querying benefit listing plan entries with various filters, pagination, and sorting options.
 */
export const BenefitListingPlanQuerySchema = z.object({
    // Plan ID filter
    id: z.union([BenefitListingPlanIdSchema, z.array(BenefitListingPlanIdSchema)]).optional(),

    // Status filter
    isActive: z.boolean().optional(),

    // Name search (partial match)
    name: z.string().min(1, { message: 'zodError.benefitListingPlan.query.name.min' }).optional(),

    // Description search (partial match)
    description: z
        .string()
        .min(1, { message: 'zodError.benefitListingPlan.query.description.min' })
        .optional(),

    // Max listings range filters
    maxListingsMin: z
        .number()
        .int({ message: 'zodError.benefitListingPlan.query.maxListingsMin.int' })
        .positive({ message: 'zodError.benefitListingPlan.query.maxListingsMin.positive' })
        .optional(),

    maxListingsMax: z
        .number()
        .int({ message: 'zodError.benefitListingPlan.query.maxListingsMax.int' })
        .positive({ message: 'zodError.benefitListingPlan.query.maxListingsMax.positive' })
        .optional(),

    // Feature filters
    allowCustomBranding: z.boolean().optional(),
    allowAnalytics: z.boolean().optional(),
    allowPromotions: z.boolean().optional(),

    // Priority range filters
    priorityMin: z
        .number()
        .int({ message: 'zodError.benefitListingPlan.query.priorityMin.int' })
        .optional(),

    priorityMax: z
        .number()
        .int({ message: 'zodError.benefitListingPlan.query.priorityMax.int' })
        .optional(),

    // Pagination and sorting
    ...PaginationSchema.shape,
    ...SortingSchema.extend({
        sortBy: z
            .enum(['name', 'priority', 'isActive', 'createdAt', 'updatedAt'])
            .default('createdAt')
    }).shape
});

/**
 * Benefit Listing Plan Search Schema
 *
 * Schema for full-text search across benefit listing plan entries with optional filters.
 */
export const BenefitListingPlanSearchSchema = BenefitListingPlanQuerySchema.extend({
    // Text search query
    q: z
        .string()
        .min(2, { message: 'zodError.benefitListingPlan.search.query.min' })
        .max(200, { message: 'zodError.benefitListingPlan.search.query.max' })
        .optional()
});

/**
 * Type exports for Benefit Listing Plan query operations
 */
export type BenefitListingPlanQuery = z.infer<typeof BenefitListingPlanQuerySchema>;
export type BenefitListingPlanSearch = z.infer<typeof BenefitListingPlanSearchSchema>;
