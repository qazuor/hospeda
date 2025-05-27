import { z } from 'zod';

/**
 * Accommodation Rating schema definition using Zod for validation.
 * Represents the rating breakdown for an accommodation (cleanliness, hospitality, etc.).
 */
export const AccommodationRatingSchema = z.object({
    /** Cleanliness rating (1-5) */
    cleanliness: z
        .number({
            required_error: 'zodError.accommodation.rating.cleanliness.required',
            invalid_type_error: 'zodError.accommodation.rating.cleanliness.invalidType'
        })
        .min(1, { message: 'zodError.accommodation.rating.cleanliness.min' })
        .max(5, { message: 'zodError.accommodation.rating.cleanliness.max' }),
    /** Hospitality rating (1-5) */
    hospitality: z
        .number({
            required_error: 'zodError.accommodation.rating.hospitality.required',
            invalid_type_error: 'zodError.accommodation.rating.hospitality.invalidType'
        })
        .min(1, { message: 'zodError.accommodation.rating.hospitality.min' })
        .max(5, { message: 'zodError.accommodation.rating.hospitality.max' }),
    /** Services rating (1-5) */
    services: z
        .number({
            required_error: 'zodError.accommodation.rating.services.required',
            invalid_type_error: 'zodError.accommodation.rating.services.invalidType'
        })
        .min(1, { message: 'zodError.accommodation.rating.services.min' })
        .max(5, { message: 'zodError.accommodation.rating.services.max' }),
    /** Accuracy rating (1-5) */
    accuracy: z
        .number({
            required_error: 'zodError.accommodation.rating.accuracy.required',
            invalid_type_error: 'zodError.accommodation.rating.accuracy.invalidType'
        })
        .min(1, { message: 'zodError.accommodation.rating.accuracy.min' })
        .max(5, { message: 'zodError.accommodation.rating.accuracy.max' }),
    /** Communication rating (1-5) */
    communication: z
        .number({
            required_error: 'zodError.accommodation.rating.communication.required',
            invalid_type_error: 'zodError.accommodation.rating.communication.invalidType'
        })
        .min(1, { message: 'zodError.accommodation.rating.communication.min' })
        .max(5, { message: 'zodError.accommodation.rating.communication.max' }),
    /** Location rating (1-5) */
    location: z
        .number({
            required_error: 'zodError.accommodation.rating.location.required',
            invalid_type_error: 'zodError.accommodation.rating.location.invalidType'
        })
        .min(1, { message: 'zodError.accommodation.rating.location.min' })
        .max(5, { message: 'zodError.accommodation.rating.location.max' })
});
