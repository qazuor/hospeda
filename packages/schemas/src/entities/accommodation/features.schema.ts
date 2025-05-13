import { z } from 'zod';
import { BaseEntitySchema } from '../../common.schema';

/**
 * Zod schema for a accommodation feature entity.
 */
export const AccommodationFeaturesSchema = BaseEntitySchema.extend({
    description: z
        .string()
        .min(10, 'error:accommodation.feature.content.min_lenght')
        .max(150, 'error:accommodation.feature.content.max_lenght')
        .optional(),
    // TODO: ver como mejorar esto. usamos Url o un image upload?
    icon: z.string().min(1, 'error:accommodation.feature.icon.min_lenght').optional()
});

export type AccommodationFeaturesInput = z.infer<typeof AccommodationFeaturesSchema>;
