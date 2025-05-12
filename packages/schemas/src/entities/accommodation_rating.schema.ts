import type { AccommodationRatingType } from '@repo/types';
import { z } from 'zod';

/**
 * Zod schema for accommodation rating categories.
 * Validates values between 0 and 5 with custom error messages.
 */
export const AccommodationRatingSchema: z.ZodType<AccommodationRatingType> = z.object({
    cleanliness: z
        .number({ required_error: 'error:accommodation.rating.cleanlinessRequired' })
        .min(0, { message: 'error:accommodation.rating.cleanlinessMin' })
        .max(5, { message: 'error:accommodation.rating.cleanlinessMax' }),

    hospitality: z
        .number({ required_error: 'error:accommodation.rating.hospitalityRequired' })
        .min(0, { message: 'error:accommodation.rating.hospitalityMin' })
        .max(5, { message: 'error:accommodation.rating.hospitalityMax' }),

    services: z
        .number({ required_error: 'error:accommodation.rating.servicesRequired' })
        .min(0, { message: 'error:accommodation.rating.servicesMin' })
        .max(5, { message: 'error:accommodation.rating.servicesMax' }),

    accuracy: z
        .number({ required_error: 'error:accommodation.rating.accuracyRequired' })
        .min(0, { message: 'error:accommodation.rating.accuracyMin' })
        .max(5, { message: 'error:accommodation.rating.accuracyMax' }),

    communication: z
        .number({ required_error: 'error:accommodation.rating.communicationRequired' })
        .min(0, { message: 'error:accommodation.rating.communicationMin' })
        .max(5, { message: 'error:accommodation.rating.communicationMax' }),

    location: z
        .number({ required_error: 'error:accommodation.rating.locationRequired' })
        .min(0, { message: 'error:accommodation.rating.locationMin' })
        .max(5, { message: 'error:accommodation.rating.locationMax' })
});
