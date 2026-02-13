import { z } from 'zod';
import { ExchangeRateSourceEnum } from './exchange-rate-source.enum.js';

/**
 * Exchange rate source enum schema for validation
 */
export const ExchangeRateSourceEnumSchema = z.nativeEnum(ExchangeRateSourceEnum, {
    error: () => ({ message: 'zodError.enums.exchangeRateSource.invalid' })
});
export type ExchangeRateSourceSchema = z.infer<typeof ExchangeRateSourceEnumSchema>;
