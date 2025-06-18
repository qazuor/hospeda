import { AccommodationSchema } from '@repo/schemas';
import { z } from 'zod';

// Schema for creating an accommodation (creation input)
export const NewAccommodationInputSchema = AccommodationSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true
});

// Schema for updating an accommodation (update input)
export const UpdateAccommodationInputSchema = NewAccommodationInputSchema.partial();

export const SearchAccommodationFiltersSchema = z.object({
    type: z.string().optional(),
    destinationId: z.string().optional(),
    amenityIds: z.array(z.string()).optional(),
    featureIds: z.array(z.string()).optional(),
    name: z.string().optional(),
    slug: z.string().optional()
});
