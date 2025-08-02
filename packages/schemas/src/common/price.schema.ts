import { z } from 'zod';
import { PriceCurrencyEnumSchema } from '../enums/index.js';

export const PriceSchema = z.object({
    price: z
        .number({
            message: 'zodError.common.price.price.required'
        })
        .optional(),
    currency: PriceCurrencyEnumSchema.optional()
});
