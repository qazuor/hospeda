import { z } from 'zod';
import { WithAdminInfoSchema } from '../../common/index.js';

/**
 * Destination Attraction schema definition using Zod for validation.
 * Represents an attraction associated with a destination.
 */
export const DestinationAttractionSchema = WithAdminInfoSchema.extend({
    name: z
        .string()
        .min(3, { message: 'error:destination.attraction.name.min_length' })
        .max(30, { message: 'error:destination.attraction.name.max_length' }),
    slug: z
        .string()
        .min(3, { message: 'error:destination.attraction.slug.min_length' })
        .max(30, { message: 'error:destination.attraction.slug.max_length' })
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
            message: 'error:destination.attraction.slug.pattern'
        }),
    description: z
        .string()
        .min(10, { message: 'error:destination.attraction.description.min_length' })
        .max(100, { message: 'error:destination.attraction.description.max_length' }),
    icon: z.string().min(1, { message: 'error:destination.attraction.icon.min_length' }),
    destinationId: z.string({ message: 'error:destination.attraction.destinationId.required' })
});
