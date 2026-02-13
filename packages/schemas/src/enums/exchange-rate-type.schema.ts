import { z } from 'zod';
import { ExchangeRateTypeEnum } from './exchange-rate-type.enum.js';

/**
 * Exchange rate type enum schema for validation
 */
export const ExchangeRateTypeEnumSchema = z.nativeEnum(ExchangeRateTypeEnum, {
    error: () => ({ message: 'zodError.enums.exchangeRateType.invalid' })
});
export type ExchangeRateTypeSchema = z.infer<typeof ExchangeRateTypeEnumSchema>;
