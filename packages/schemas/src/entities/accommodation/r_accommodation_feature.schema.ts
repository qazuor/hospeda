import { z } from 'zod';

/**
 * Zod schema accommodation/feature relationship.
 */
export const AccommodationFeatureRelationSchema = z.object({
    accommodationId: z
        .string()
        .uuid({ message: 'error:accommodation_feature.accommodationId.invalid' }),
    featureId: z.string().uuid({ message: 'error:accommodation_feature.featureId.invalid' })
});

export type AccommodationFeatureRelationInput = z.infer<typeof AccommodationFeatureRelationSchema>;
