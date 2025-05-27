import { z } from 'zod';

/**
 * Accommodation Extra Info schema definition using Zod for validation.
 * Represents additional information for an accommodation.
 */
export const ExtraInfoSchema = z.object({
    capacity: z
        .number({
            required_error: 'zodError.accommodation.extrainfo.capacity.required',
            invalid_type_error: 'zodError.accommodation.extrainfo.capacity.invalidType'
        })
        .min(1, { message: 'zodError.accommodation.extrainfo.capacity.min' })
        .max(100, { message: 'zodError.accommodation.extrainfo.capacity.max' }),
    minNights: z
        .number({
            required_error: 'zodError.accommodation.extrainfo.minNights.required',
            invalid_type_error: 'zodError.accommodation.extrainfo.minNights.invalidType'
        })
        .min(1, { message: 'zodError.accommodation.extrainfo.minNights.min' })
        .max(365, { message: 'zodError.accommodation.extrainfo.minNights.max' }),
    maxNights: z
        .number({
            required_error: 'zodError.accommodation.extrainfo.maxNights.required',
            invalid_type_error: 'zodError.accommodation.extrainfo.maxNights.invalidType'
        })
        .min(1, { message: 'zodError.accommodation.extrainfo.maxNights.min' })
        .max(365, { message: 'zodError.accommodation.extrainfo.maxNights.max' })
        .optional(),
    bedrooms: z
        .number({
            required_error: 'zodError.accommodation.extrainfo.bedrooms.required',
            invalid_type_error: 'zodError.accommodation.extrainfo.bedrooms.invalidType'
        })
        .min(0, { message: 'zodError.accommodation.extrainfo.bedrooms.min' })
        .max(20, { message: 'zodError.accommodation.extrainfo.bedrooms.max' }),
    beds: z
        .number({
            required_error: 'zodError.accommodation.extrainfo.beds.required',
            invalid_type_error: 'zodError.accommodation.extrainfo.beds.invalidType'
        })
        .min(0, { message: 'zodError.accommodation.extrainfo.beds.min' })
        .max(50, { message: 'zodError.accommodation.extrainfo.beds.max' })
        .optional(),
    bathrooms: z
        .number({
            required_error: 'zodError.accommodation.extrainfo.bathrooms.required',
            invalid_type_error: 'zodError.accommodation.extrainfo.bathrooms.invalidType'
        })
        .min(0, { message: 'zodError.accommodation.extrainfo.bathrooms.min' })
        .max(20, { message: 'zodError.accommodation.extrainfo.bathrooms.max' }),
    smokingAllowed: z
        .boolean({
            required_error: 'zodError.accommodation.extrainfo.smokingAllowed.required',
            invalid_type_error: 'zodError.accommodation.extrainfo.smokingAllowed.invalidType'
        })
        .optional(),
    extraInfo: z
        .array(
            z
                .string({
                    required_error: 'zodError.accommodation.extrainfo.extraInfo.required',
                    invalid_type_error: 'zodError.accommodation.extrainfo.extraInfo.invalidType'
                })
                .min(3, { message: 'zodError.accommodation.extrainfo.extraInfo.min' })
                .max(200, { message: 'zodError.accommodation.extrainfo.extraInfo.max' })
        )
        .optional()
});
