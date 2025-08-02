import { z } from 'zod';

/**
 * Accommodation Extra Info schema definition using Zod for validation.
 * Represents additional information for an accommodation.
 */
export const ExtraInfoSchema = z.object({
    capacity: z
        .number({
            message: 'zodError.accommodation.extrainfo.capacity.required'
        })
        .min(1, { message: 'zodError.accommodation.extrainfo.capacity.min' })
        .max(100, { message: 'zodError.accommodation.extrainfo.capacity.max' }),
    minNights: z
        .number({
            message: 'zodError.accommodation.extrainfo.minNights.required'
        })
        .min(1, { message: 'zodError.accommodation.extrainfo.minNights.min' })
        .max(365, { message: 'zodError.accommodation.extrainfo.minNights.max' }),
    maxNights: z
        .number({
            message: 'zodError.accommodation.extrainfo.maxNights.required'
        })
        .min(1, { message: 'zodError.accommodation.extrainfo.maxNights.min' })
        .max(365, { message: 'zodError.accommodation.extrainfo.maxNights.max' })
        .optional(),
    bedrooms: z
        .number({
            message: 'zodError.accommodation.extrainfo.bedrooms.required'
        })
        .min(0, { message: 'zodError.accommodation.extrainfo.bedrooms.min' })
        .max(20, { message: 'zodError.accommodation.extrainfo.bedrooms.max' }),
    beds: z
        .number({
            message: 'zodError.accommodation.extrainfo.beds.required'
        })
        .min(0, { message: 'zodError.accommodation.extrainfo.beds.min' })
        .max(50, { message: 'zodError.accommodation.extrainfo.beds.max' })
        .optional(),
    bathrooms: z
        .number({
            message: 'zodError.accommodation.extrainfo.bathrooms.required'
        })
        .min(0, { message: 'zodError.accommodation.extrainfo.bathrooms.min' })
        .max(20, { message: 'zodError.accommodation.extrainfo.bathrooms.max' }),
    smokingAllowed: z
        .boolean({
            message: 'zodError.accommodation.extrainfo.smokingAllowed.required'
        })
        .optional(),
    extraInfo: z
        .array(
            z
                .string({
                    message: 'zodError.accommodation.extrainfo.extraInfo.required'
                })
                .min(3, { message: 'zodError.accommodation.extrainfo.extraInfo.min' })
                .max(200, { message: 'zodError.accommodation.extrainfo.extraInfo.max' })
        )
        .optional()
});
