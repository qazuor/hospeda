import type { z } from 'zod';
import { BasePriceSchema } from '../../common.schema';
import { AccommodationAdditionalFeesSchema } from './additionalFees.schema';
import { AccommodationDiscountsSchema } from './discounts.schema';

/**
 * Zod schema for a accommodation price info.
 */
export const AccommodationPriceSchema = BasePriceSchema.extend({
    additionalFees: AccommodationAdditionalFeesSchema.optional(),
    discounts: AccommodationDiscountsSchema.optional()
});

export type AccommodationPriceInput = z.infer<typeof AccommodationPriceSchema>;
