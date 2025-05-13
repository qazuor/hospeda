import { z } from 'zod';

/**
 * Zod schema for a accommodation extra info.
 */
export const AccommodationExtraInfoSchema = z.object({
    capacity: z
        .number({ required_error: 'error:accommodation.extraInfo.capacity.required' })
        .min(1, { message: 'error:accommodation.extraInfo.capacity.min_value' }),
    minNights: z
        .number({ required_error: 'error:accommodation.extraInfo.minNights.required' })
        .min(1, { message: 'error:accommodation.extraInfo.minNights.min_value' }),
    maxNights: z
        .number({ required_error: 'error:accommodation.extraInfo.maxNights.required' })
        .min(1, { message: 'error:accommodation.extraInfo.maxNights.min_value' })
        .optional(),
    bedrooms: z.number({ required_error: 'error:accommodation.extraInfo.bedrooms.required' }),
    beds: z
        .number({ required_error: 'error:accommodation.extraInfo.beds.required' })
        .min(1, { message: 'error:accommodation.extraInfo.beds.min_value' })
        .optional(),
    bathrooms: z
        .number({ required_error: 'error:accommodation.extraInfo.bathrooms.required' })
        .min(1, { message: 'error:accommodation.extraInfo.bathrooms.min_value' }),
    smokingAllowed: z
        .boolean({
            required_error: 'error:accommodation.extraInfo.smokingAllowed.required',
            invalid_type_error: 'error:accommodation.extraInfo.smokingAllowed.invalid_type'
        })
        .optional(),
    extraInfo: z
        .array(
            z
                .string()
                .min(10, 'error:accommodation.extraInfo.extraInfo.min_lenght')
                .max(150, 'error:accommodation.extraInfo.extraInfo.max_lenght')
        )
        .optional()
});

export type AccommodationExtraInfoInput = z.infer<typeof AccommodationExtraInfoSchema>;
