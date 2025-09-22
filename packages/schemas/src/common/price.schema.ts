import { z } from 'zod';
import { PriceCurrencyEnumSchema } from '../enums/index.js';

/**
 * Price Schema
 * Represents pricing information with amount and currency
 */
export const PriceSchema = z.object({
    price: z
        .number({
            message: 'zodError.common.price.price.required'
        })
        .positive({
            message: 'zodError.common.price.price.positive'
        })
        .optional(),
    currency: PriceCurrencyEnumSchema.optional()
});
export type PriceType = z.infer<typeof PriceSchema>;

/**
 * Price fields (using PriceSchema structure)
 */
export const PriceFields = {
    price: PriceSchema.optional()
} as const;
export type PriceFieldsType = typeof PriceFields;
