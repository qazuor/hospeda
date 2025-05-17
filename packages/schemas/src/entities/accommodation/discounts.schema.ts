import { z } from 'zod';
import { AccommodationDiscountInfoSchema } from './discountInfo.schema.js';
import { AccommodationOtherDiscountSchema } from './otherDiscount.schema.js';

/**
 * Zod schema for a accommodation discounts.
 */
export const AccommodationDiscountsSchema = z.object({
    weekly: AccommodationDiscountInfoSchema.optional(),
    monthly: AccommodationDiscountInfoSchema.optional(),
    lastMinute: AccommodationDiscountInfoSchema.optional(),
    others: z.array(AccommodationOtherDiscountSchema).optional()
});

export type AccommodationDiscountsInput = z.infer<typeof AccommodationDiscountsSchema>;
