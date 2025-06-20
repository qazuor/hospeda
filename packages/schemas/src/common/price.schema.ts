import { z } from 'zod';
import { PriceCurrencyEnumSchema } from '../enums/index.js';

export const PriceSchema = z.object({
    price: z
        .number({
            required_error: 'zodError.common.price.price.required',
            invalid_type_error: 'zodError.common.price.price.invalidType'
        })
        .optional(),
    currency: PriceCurrencyEnumSchema.optional()
});
