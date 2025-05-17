import { z } from 'zod';
import { BasePriceSchema } from '../../common.schema.js';

/**
 * Zod schema for a accommodation adittional fees info.
 */
export const AccommodationAdditionalFeesInfoSchema = z.object({
    price: BasePriceSchema.optional(),
    percent: z
        .number()
        .min(1, 'error:accommodation.additionalFeesInfo.percent.min_lenght')
        .max(100, 'error:accommodation.additionalFeesInfo.percent.max_lenght')
        .optional(),
    isIncluded: z
        .boolean({
            required_error: 'error:accommodation.additionalFeesInfo.isIncluded.required',
            invalid_type_error: 'error:accommodation.additionalFeesInfo.isIncluded.invalid_type'
        })
        .optional(),
    isOptional: z
        .boolean({
            required_error: 'error:accommodation.additionalFeesInfo.isOptional.required',
            invalid_type_error: 'error:accommodation.additionalFeesInfo.isOptional.invalid_type'
        })
        .optional(),
    isPercent: z
        .boolean({
            required_error: 'error:accommodation.additionalFeesInfo.isPercent.required',
            invalid_type_error: 'error:accommodation.additionalFeesInfo.isPercent.invalid_type'
        })
        .optional(),
    isPerStay: z
        .boolean({
            required_error: 'error:accommodation.additionalFeesInfo.isPerStay.required',
            invalid_type_error: 'error:accommodation.additionalFeesInfo.isPerStay.invalid_type'
        })
        .optional(),
    isPerNight: z
        .boolean({
            required_error: 'error:accommodation.additionalFeesInfo.isPerNight.required',
            invalid_type_error: 'error:accommodation.additionalFeesInfo.isPerNight.invalid_type'
        })
        .optional(),
    isPerGuest: z
        .boolean({
            required_error: 'error:accommodation.additionalFeesInfo.isPerGuest.required',
            invalid_type_error: 'error:accommodation.additionalFeesInfo.isPerGuest.invalid_type'
        })
        .optional()
});

export type AccommodationAdditionalFeesInfoInput = z.infer<
    typeof AccommodationAdditionalFeesInfoSchema
>;
