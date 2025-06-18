import { AccommodationSchema } from '@repo/schemas';
import { z } from 'zod';

/**
 * Zod schema for creating a new accommodation.
 * Omits system fields (id, createdAt, updatedAt, deletedAt, createdById, updatedById, deletedById).
 * Used for validating input when creating a new accommodation.
 */
export const NewAccommodationInputSchema = AccommodationSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true
});

/**
 * Zod schema for updating an accommodation.
 * All fields are optional, based on NewAccommodationInputSchema.
 * Used for validating input when updating an accommodation.
 */
export const UpdateAccommodationInputSchema = NewAccommodationInputSchema.partial();

/**
 * Zod schema for validating search filters for accommodations.
 * All fields are optional and type-checked.
 * Used for validating input in advanced search and filtering operations.
 *
 * Fields:
 * - type: string (optional)
 * - destinationId: string (optional)
 * - amenityIds: string[] (optional)
 * - featureIds: string[] (optional)
 * - name: string (optional)
 * - slug: string (optional)
 */
export const SearchAccommodationFiltersSchema = z.object({
    type: z.string().optional(),
    destinationId: z.string().optional(),
    amenityIds: z.array(z.string()).optional(),
    featureIds: z.array(z.string()).optional(),
    name: z.string().optional(),
    slug: z.string().optional()
});
