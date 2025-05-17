import type { z } from 'zod';
import { BasePriceSchema } from '../../common.schema.js';
import { AccommodationAdditionalFeesSchema } from './additionalFees.schema.js';
import { AccommodationDiscountsSchema } from './discounts.schema.js';

/**
 * Zod schema for a accommodation price info.
 */
export const AccommodationPriceSchema = BasePriceSchema.extend({
    additionalFees: AccommodationAdditionalFeesSchema.optional(),
    discounts: AccommodationDiscountsSchema.optional()
});

export type AccommodationPriceInput = z.infer<typeof AccommodationPriceSchema>;
