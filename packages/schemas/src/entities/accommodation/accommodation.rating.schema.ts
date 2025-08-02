import { z } from 'zod';

/**
 * Accommodation Rating schema definition using Zod for validation.
 * Represents rating information for an accommodation.
 */
export const AccommodationRatingSchema = z.object({
    cleanliness: z
        .number({
            message: 'zodError.accommodation.rating.cleanliness.required'
        })
        .min(1, { message: 'zodError.accommodation.rating.cleanliness.min' })
        .max(5, { message: 'zodError.accommodation.rating.cleanliness.max' }),
    hospitality: z
        .number({
            message: 'zodError.accommodation.rating.hospitality.required'
        })
        .min(1, { message: 'zodError.accommodation.rating.hospitality.min' })
        .max(5, { message: 'zodError.accommodation.rating.hospitality.max' }),
    services: z
        .number({
            message: 'zodError.accommodation.rating.services.required'
        })
        .min(1, { message: 'zodError.accommodation.rating.services.min' })
        .max(5, { message: 'zodError.accommodation.rating.services.max' }),
    accuracy: z
        .number({
            message: 'zodError.accommodation.rating.accuracy.required'
        })
        .min(1, { message: 'zodError.accommodation.rating.accuracy.min' })
        .max(5, { message: 'zodError.accommodation.rating.accuracy.max' }),
    communication: z
        .number({
            message: 'zodError.accommodation.rating.communication.required'
        })
        .min(1, { message: 'zodError.accommodation.rating.communication.min' })
        .max(5, { message: 'zodError.accommodation.rating.communication.max' }),
    location: z
        .number({
            message: 'zodError.accommodation.rating.location.required'
        })
        .min(1, { message: 'zodError.accommodation.rating.location.min' })
        .max(5, { message: 'zodError.accommodation.rating.location.max' })
});
