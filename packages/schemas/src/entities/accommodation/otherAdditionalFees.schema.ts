import { z } from 'zod';
import { SlugRegex } from '../../utils/utils.js';
import { AccommodationAdditionalFeesInfoSchema } from './additionalFeesInfo.schema.js';

/**
 * Zod schema for a accommodation other additional fee.
 */
export const AccommodationOtherAdditionalFeesSchema = AccommodationAdditionalFeesInfoSchema.extend({
    name: z
        .string()
        .min(1, 'error:accommodation.otherAdditionalFee.name.min_lenght')
        .max(20, 'error:accommodation.otherAdditionalFee.name.max_lenght')
        .regex(SlugRegex, {
            message: 'error:accommodation.otherAdditionalFee.name.pattern'
        })
        .optional(),
    displayName: z
        .string()
        .min(1, 'error:accommodation.otherAdditionalFee.displayName.min_lenght')
        .max(20, 'error:accommodation.otherAdditionalFee.displayName.max_lenght')
        .optional()
});

export type AccommodationOtherAdditionalFeesInput = z.infer<
    typeof AccommodationOtherAdditionalFeesSchema
>;
