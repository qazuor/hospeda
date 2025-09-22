import { z } from 'zod';
import { PriceCurrencyEnum } from './currency.enum.js';

export const PriceCurrencyEnumSchema = z.nativeEnum(PriceCurrencyEnum, {
    error: () => ({ message: 'zodError.enums.priceCurrency.invalid' })
});
export type PriceCurrencySchema = z.infer<typeof PriceCurrencyEnumSchema>;
