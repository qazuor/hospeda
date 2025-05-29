import { z } from 'zod';
import { CurrencyEnumSchema } from '../enums/index.js';

export const PriceSchema = z.object({
    price: z
        .number({
            required_error: 'zodError.common.price.price.required',
            invalid_type_error: 'zodError.common.price.price.invalidType'
        })
        .optional(),
    currency: CurrencyEnumSchema.refine((val: string) => CurrencyEnumSchema.options.includes(val), {
        message: 'zodError.common.price.currency.invalidEnum'
    }).optional()
});
