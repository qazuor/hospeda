import type { EventLocationType } from '@repo/types';
import { z } from 'zod';

import { BaseLocationSchema } from '../common.schema';

/**
 * Zod schema for event location data.
 */
export const EventLocationSchema: z.ZodType<EventLocationType> = BaseLocationSchema.extend({
    id: z.string().uuid({
        message: 'error:event.location.idInvalid'
    }),
    street: z.string().optional(),
    number: z.string().optional(),
    floor: z.string().optional(),
    apartment: z.string().optional(),
    neighborhood: z.string().optional(),
    city: z.string({ required_error: 'error:event.location.cityRequired' }),
    deparment: z.string().optional(),
    placeName: z.string().optional()
});
