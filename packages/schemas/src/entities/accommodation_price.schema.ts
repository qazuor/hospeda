import type { AccommodationPriceType } from '@repo/types';
import type { z } from 'zod';

import { BasePriceSchema } from '../common.schema';
import { AdditionalFeesSchema } from './accommodation_additional_fees.schema';
import { DiscountsSchema } from './accommodation_discounts.schema';

/**
 * Zod schema for accommodation price.
 * Includes base price, additional fees and discounts.
 */
export const AccommodationPriceSchema: z.ZodType<AccommodationPriceType> = BasePriceSchema.extend({
    additionalFees: AdditionalFeesSchema.optional(),
    discounts: DiscountsSchema.optional()
});
