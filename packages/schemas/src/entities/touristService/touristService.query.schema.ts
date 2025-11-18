import { z } from 'zod';
import { ClientIdSchema, TouristServiceIdSchema } from '../../common/id.schema.js';
import { PaginationSchema, SortingSchema } from '../../common/pagination.schema.js';
import { TouristServiceCategorySchema } from '../../enums/tourist-service-category.schema.js';
import { ServiceDifficultySchema } from './touristService.schema.js';

/**
 * Tourist Service Query Schema
 *
 * Schema for querying tourist service entries with various filters, pagination, and sorting options.
 */
export const TouristServiceQuerySchema = z.object({
    // Service ID filter
    id: z.union([TouristServiceIdSchema, z.array(TouristServiceIdSchema)]).optional(),

    // Client filter
    clientId: z.union([ClientIdSchema, z.array(ClientIdSchema)]).optional(),

    // Category filter
    category: z
        .union([TouristServiceCategorySchema, z.array(TouristServiceCategorySchema)])
        .optional(),

    // Status filter
    isActive: z.boolean().optional(),

    // Name search (partial match)
    name: z.string().min(1, { message: 'zodError.touristService.query.name.min' }).optional(),

    // Description search (partial match)
    description: z
        .string()
        .min(1, { message: 'zodError.touristService.query.description.min' })
        .optional(),

    // Difficulty filter
    difficulty: z.union([ServiceDifficultySchema, z.array(ServiceDifficultySchema)]).optional(),

    // Max participants range filters
    maxParticipantsMin: z
        .number()
        .int({ message: 'zodError.touristService.query.maxParticipantsMin.int' })
        .positive({ message: 'zodError.touristService.query.maxParticipantsMin.positive' })
        .optional(),

    maxParticipantsMax: z
        .number()
        .int({ message: 'zodError.touristService.query.maxParticipantsMax.int' })
        .positive({ message: 'zodError.touristService.query.maxParticipantsMax.positive' })
        .optional(),

    // Age range filters
    minAge: z
        .number()
        .int({ message: 'zodError.touristService.query.minAge.int' })
        .nonnegative({ message: 'zodError.touristService.query.minAge.nonnegative' })
        .optional(),

    maxAge: z
        .number()
        .int({ message: 'zodError.touristService.query.maxAge.int' })
        .positive({ message: 'zodError.touristService.query.maxAge.positive' })
        .optional(),

    // Feature filters
    pickupAvailable: z.boolean().optional(),

    // Priority range filters
    priorityMin: z
        .number()
        .int({ message: 'zodError.touristService.query.priorityMin.int' })
        .optional(),

    priorityMax: z
        .number()
        .int({ message: 'zodError.touristService.query.priorityMax.int' })
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
 * Tourist Service Search Schema
 *
 * Schema for full-text search across tourist service entries with optional filters.
 */
export const TouristServiceSearchSchema = TouristServiceQuerySchema.extend({
    // Text search query
    q: z
        .string()
        .min(2, { message: 'zodError.touristService.search.query.min' })
        .max(200, { message: 'zodError.touristService.search.query.max' })
        .optional()
});

/**
 * Type exports for Tourist Service query operations
 */
export type TouristServiceQuery = z.infer<typeof TouristServiceQuerySchema>;
export type TouristServiceSearch = z.infer<typeof TouristServiceSearchSchema>;
