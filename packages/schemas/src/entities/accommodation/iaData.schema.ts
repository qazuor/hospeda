import { z } from 'zod';
import { BaseEntitySchema } from '../../common.schema';

/**
 * Zod schema for a accommodation ia data entity.
 */
export const AccommodationIaDataSchema = BaseEntitySchema.extend({
    title: z
        .string()
        .min(5, 'error:accommodation.iaData.title.min_lenght')
        .max(50, 'error:accommodation.iaData.title.max_lenght'),
    content: z
        .string()
        .min(1, 'error:accommodation.iaData.content.min_lenght')
        .max(200, 'error:accommodation.iaData.content.max_lenght'),
    category: z
        .string()
        .min(3, 'error:accommodation.iaData.category.min_lenght')
        .max(25, 'error:accommodation.iaData.category.max_lenght')
        .optional()
});

export type AccommodationIaDataInput = z.infer<typeof AccommodationIaDataSchema>;
