import { z } from 'zod';
import { SlugRegex } from '../../utils/utils';
import { AccommodationDiscountInfoSchema } from './discountInfo.schema';

/**
 * Zod schema for a accommodation other discount.
 */
export const AccommodationOtherDiscountSchema = AccommodationDiscountInfoSchema.extend({
    name: z
        .string()
        .min(1, 'error:accommodation.otherDiscount.name.min_lenght')
        .max(20, 'error:accommodation.otherDiscount.name.max_lenght')
        .regex(SlugRegex, {
            message: 'error:accommodation.otherDiscount.name.pattern'
        })
        .optional(),
    displayName: z
        .string()
        .min(1, 'error:accommodation.otherDiscount.displayName.min_lenght')
        .max(20, 'error:accommodation.otherDiscount.displayName.max_lenght')
        .optional()
});

export type AccommodationOtherDiscountInput = z.infer<typeof AccommodationOtherDiscountSchema>;
