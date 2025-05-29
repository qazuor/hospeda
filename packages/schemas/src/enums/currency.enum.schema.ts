import { PriceCurrencyEnum } from '@repo/types';
import { z } from 'zod';

export const PriceCurrencyEnumSchema = z.enum(
    Object.values(PriceCurrencyEnum) as [string, ...string[]],
    {
        errorMap: () => ({ message: 'zodError.enums.priceCurrency.invalid' })
    }
);
