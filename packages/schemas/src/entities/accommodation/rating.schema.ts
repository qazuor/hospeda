import { z } from 'zod';

/**
 * Zod schema for a accommodation rating info.
 */
export const AccommodationRatingSchema = z.object({
    cleanliness: z
        .number({ required_error: 'error:accommodation.rating.cleanliness.required' })
        .min(0, { message: 'error:accommodation.rating.cleanliness.min_value' })
        .max(5, { message: 'error:accommodation.rating.cleanliness.max_value' })
        .optional(),
    hospitality: z
        .number({ required_error: 'error:accommodation.rating.hospitality.required' })
        .min(0, { message: 'error:accommodation.rating.hospitality.min_value' })
        .max(5, { message: 'error:accommodation.rating.hospitality.max_value' })
        .optional(),
    services: z
        .number({ required_error: 'error:accommodation.rating.services.required' })
        .min(0, { message: 'error:accommodation.rating.services.min_value' })
        .max(5, { message: 'error:accommodation.rating.services.max_value' })
        .optional(),
    accuracy: z
        .number({ required_error: 'error:accommodation.rating.accuracy.required' })
        .min(0, { message: 'error:accommodation.rating.accuracy.min_value' })
        .max(5, { message: 'error:accommodation.rating.accuracy.max_value' })
        .optional(),
    communication: z
        .number({ required_error: 'error:accommodation.rating.communication.required' })
        .min(0, { message: 'error:accommodation.rating.communication.min_value' })
        .max(5, { message: 'error:accommodation.rating.communication.max_value' })
        .optional(),
    location: z
        .number({ required_error: 'error:accommodation.rating.location.required' })
        .min(0, { message: 'error:accommodation.rating.location.min_value' })
        .max(5, { message: 'error:accommodation.rating.location.max_value' })
        .optional()
});

export type AccommodationRatingInput = z.infer<typeof AccommodationRatingSchema>;
