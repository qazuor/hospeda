import { z } from 'zod';
import { BasePriceSchema } from '../../common.schema.js';

/**
 * Zod schema for a accommodation discount info
 */
export const AccommodationDiscountInfoSchema = z.object({
    price: BasePriceSchema.optional(),
    percent: z
        .number({ required_error: 'error:accommodation.discount.percent.required' })
        .min(0, { message: 'error:accommodation.discount.percent.min_value' })
        .max(5, { message: 'error:accommodation.discount.percent.max_value' }),
    isIncluded: z
        .boolean({
            required_error: 'error:accommodation.discount.isIncluded.required',
            invalid_type_error: 'error:accommodation.discount.isIncluded.invalid_type'
        })
        .optional(),
    isOptional: z
        .boolean({
            required_error: 'error:accommodation.discount.isOptional.required',
            invalid_type_error: 'error:accommodation.discount.isOptional.invalid_type'
        })
        .optional(),
    isPercent: z
        .boolean({
            required_error: 'error:accommodation.discount.isPercent.required',
            invalid_type_error: 'error:accommodation.discount.isPercent.invalid_type'
        })
        .optional(),
    isPerStay: z
        .boolean({
            required_error: 'error:accommodation.discount.isPerStay.required',
            invalid_type_error: 'error:accommodation.discount.isPerStay.invalid_type'
        })
        .optional(),
    isPerNight: z
        .boolean({
            required_error: 'error:accommodation.discount.isPerNight.required',
            invalid_type_error: 'error:accommodation.discount.isPerNight.invalid_type'
        })
        .optional(),
    isPerGuest: z
        .boolean({
            required_error: 'error:accommodation.discount.isPerGuest.required',
            invalid_type_error: 'error:accommodation.discount.isPerGuest.invalid_type'
        })
        .optional()
});

export type AccommodationDiscountInfoInput = z.infer<typeof AccommodationDiscountInfoSchema>;
