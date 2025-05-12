import type { AccommodationFeaturesType } from '@repo/types';
import { z } from 'zod';

import { BaseEntitySchema } from '../common.schema';

/**
 * Zod schema for accommodation feature item.
 */
export const AccommodationFeaturesSchema: z.ZodType<AccommodationFeaturesType> =
    BaseEntitySchema.extend({
        accommodationId: z.string().uuid({
            message: 'error:accommodationFeature.accommodationIdInvalid'
        }),
        description: z.string().optional(),
        icon: z.string({ required_error: 'error:accommodationFeature.iconRequired' }).optional()
    });
