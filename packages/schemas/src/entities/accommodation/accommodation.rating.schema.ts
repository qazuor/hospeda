import { z } from 'zod';

/**
 * Accommodation Rating schema definition using Zod for validation.
 * Represents the rating breakdown for an accommodation (e.g., cleanliness, hospitality, etc.).
 */
export const AccommodationRatingSchema = z.object({
    cleanliness: z
        .number()
        .min(0, { message: 'error:accommodation.rating.cleanliness.min' })
        .max(5, { message: 'error:accommodation.rating.cleanliness.max' }),
    hospitality: z
        .number()
        .min(0, { message: 'error:accommodation.rating.hospitality.min' })
        .max(5, { message: 'error:accommodation.rating.hospitality.max' }),
    services: z
        .number()
        .min(0, { message: 'error:accommodation.rating.services.min' })
        .max(5, { message: 'error:accommodation.rating.services.max' }),
    accuracy: z
        .number()
        .min(0, { message: 'error:accommodation.rating.accuracy.min' })
        .max(5, { message: 'error:accommodation.rating.accuracy.max' }),
    communication: z
        .number()
        .min(0, { message: 'error:accommodation.rating.communication.min' })
        .max(5, { message: 'error:accommodation.rating.communication.max' }),
    location: z
        .number()
        .min(0, { message: 'error:accommodation.rating.location.min' })
        .max(5, { message: 'error:accommodation.rating.location.max' })
});

export type AccommodationRatingInput = z.infer<typeof AccommodationRatingSchema>;
