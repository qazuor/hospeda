import type { DestinationAttractionsType } from '@repo/types';
import { z } from 'zod';

import { BaseEntitySchema } from '../common.schema';

/**
 * Zod schema for a destination attraction.
 */
export const DestinationAttractionsSchema: z.ZodType<DestinationAttractionsType> =
    BaseEntitySchema.extend({
        destinationId: z.string().uuid({
            message: 'error:destinationAttraction.destinationIdInvalid'
        }),
        name: z.string({ required_error: 'error:destinationAttraction.nameRequired' }),
        slug: z.string({ required_error: 'error:destinationAttraction.slugRequired' }),
        description: z.string({
            required_error: 'error:destinationAttraction.descriptionRequired'
        }),
        icon: z.string({ required_error: 'error:destinationAttraction.iconRequired' })
    });
