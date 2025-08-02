import { PriceCurrencyEnum } from '@repo/types';
import { z } from 'zod';

export const PriceCurrencyEnumSchema = z.nativeEnum(PriceCurrencyEnum, {
    error: () => ({ message: 'zodError.enums.priceCurrency.invalid' })
});
