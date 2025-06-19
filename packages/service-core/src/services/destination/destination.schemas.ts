import {
    DestinationFilterInputSchema,
    DestinationSchema
} from '@repo/schemas/entities/destination/destination.schema.js';
import type { NewDestinationInputType, UpdateDestinationInputType } from '@repo/types';
import type { z } from 'zod';

// Export type for search filters
export type SearchDestinationFilters = z.infer<typeof DestinationFilterInputSchema>;
export { DestinationFilterInputSchema };

/**
 * Input schema for creating a new destination.
 * Omits id, createdAt, updatedAt, deletedAt, createdById, updatedById, deletedById.
 */
export const DestinationCreateInputSchema = DestinationSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true
}) as z.ZodType<NewDestinationInputType>;

/**
 * Input type for creating a new destination.
 */
export type DestinationCreateInput = z.infer<typeof DestinationCreateInputSchema>;

/**
 * Input schema for updating a destination. All fields are optional for patching.
 */
export const DestinationUpdateInputSchema = (
    DestinationCreateInputSchema as unknown as z.ZodObject<z.ZodRawShape>
).partial() as z.ZodType<UpdateDestinationInputType>;

/**
 * Input type for updating a destination.
 */
export type DestinationUpdateInput = z.infer<typeof DestinationUpdateInputSchema>;
