import { z } from 'zod';

/**
 * Zod schema accommodation/amenity relationship.
 */
export const AccommodationAmenityRelationSchema = z.object({
    accommodationId: z
        .string()
        .uuid({ message: 'error:accommodation_amenity.accommodationId.invalid' }),
    amenityId: z.string().uuid({ message: 'error:accommodation_amenity.amenityId.invalid' })
});

export type AccommodationAmenityRelationInput = z.infer<typeof AccommodationAmenityRelationSchema>;
