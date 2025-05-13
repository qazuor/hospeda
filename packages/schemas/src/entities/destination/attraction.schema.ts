import { z } from 'zod';
import { BaseEntitySchema } from '../../common.schema';

/**
 * Zod schema for a destination attraction entity.
 */
export const DestinationAttractionsSchema = BaseEntitySchema.extend({
    name: z
        .string()
        .min(3, 'error:destination.attraction.name.min_lenght')
        .max(30, 'error:destination.attraction.name.max_lenght'),
    slug: z
        .string()
        .min(3, 'error:destination.attraction.slug.min_lenght')
        .max(30, 'error:destination.attraction.slug.max_lenght')
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
            message: 'error:destination.attraction.slug.pattern'
        }),
    description: z
        .string()
        .min(10, 'error:destination.attraction.description.min_lenght')
        .max(100, 'error:destination.attraction.description.max_lenght')
        .optional(),
    // TODO: ver como mejorar esto. usamos Url o un image upload?
    icon: z.string().min(1, 'error:destination.attraction.icon.min_lenght').optional()
});

export type DestinationAttractionsInput = z.infer<typeof DestinationAttractionsSchema>;
