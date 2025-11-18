import { z } from 'zod';
import { BenefitPartnerIdSchema, ClientIdSchema } from '../../common/id.schema.js';
import { PaginationSchema, SortingSchema } from '../../common/pagination.schema.js';
import { BenefitCategorySchema } from '../../enums/benefit-category.schema.js';

/**
 * Benefit Partner Query Schema
 *
 * Schema for querying benefit partner entries with various filters, pagination, and sorting options.
 */
export const BenefitPartnerQuerySchema = z.object({
    // Partner ID filter
    id: z.union([BenefitPartnerIdSchema, z.array(BenefitPartnerIdSchema)]).optional(),

    // Client filter
    clientId: z.union([ClientIdSchema, z.array(ClientIdSchema)]).optional(),

    // Category filter
    category: z.union([BenefitCategorySchema, z.array(BenefitCategorySchema)]).optional(),

    // Status filter
    isActive: z.boolean().optional(),

    // Name search (partial match)
    name: z.string().min(1, { message: 'zodError.benefitPartner.query.name.min' }).optional(),

    // Description search (partial match)
    description: z
        .string()
        .min(1, { message: 'zodError.benefitPartner.query.description.min' })
        .optional(),

    // Priority range filters
    priorityMin: z
        .number()
        .int({ message: 'zodError.benefitPartner.query.priorityMin.int' })
        .optional(),

    priorityMax: z
        .number()
        .int({ message: 'zodError.benefitPartner.query.priorityMax.int' })
        .optional(),

    // Pagination and sorting
    ...PaginationSchema.shape,
    ...SortingSchema.extend({
        sortBy: z
            .enum(['name', 'category', 'priority', 'isActive', 'createdAt', 'updatedAt'])
            .default('createdAt')
    }).shape
});

/**
 * Benefit Partner Search Schema
 *
 * Schema for full-text search across benefit partner entries with optional filters.
 */
export const BenefitPartnerSearchSchema = BenefitPartnerQuerySchema.extend({
    // Text search query
    q: z
        .string()
        .min(2, { message: 'zodError.benefitPartner.search.query.min' })
        .max(200, { message: 'zodError.benefitPartner.search.query.max' })
        .optional()
});

/**
 * Type exports for Benefit Partner query operations
 */
export type BenefitPartnerQuery = z.infer<typeof BenefitPartnerQuerySchema>;
export type BenefitPartnerSearch = z.infer<typeof BenefitPartnerSearchSchema>;
