import { z } from 'zod';

/**
 * Zod schema accommodation/iaData relationship.
 */
export const AccommodationIaDataRelationSchema = z.object({
    accommodationId: z
        .string()
        .uuid({ message: 'error:accommodation_iaData.accommodationId.invalid' }),
    iaDataId: z.string().uuid({ message: 'error:accommodation_iaData.iaDataId.invalid' })
});

export type AccommodationIaDataRelationInput = z.infer<typeof AccommodationIaDataRelationSchema>;
