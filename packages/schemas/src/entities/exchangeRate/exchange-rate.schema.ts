import { z } from 'zod';
import { PriceCurrencyEnumSchema } from '../../enums/currency.schema.js';
import { ExchangeRateSourceEnumSchema } from '../../enums/exchange-rate-source.schema.js';
import { ExchangeRateTypeEnumSchema } from '../../enums/exchange-rate-type.schema.js';
import { numericField } from '../../utils/utils.js';

/**
 * Exchange Rate Schema - Main Entity Schema
 *
 * This schema defines the complete structure of an ExchangeRate entity
 * for managing currency conversion rates across the platform.
 */
export const ExchangeRateSchema = z.object({
    // ID field
    id: z.string().uuid({
        message: 'zodError.exchangeRate.id.invalid'
    }),

    // Currency pair
    fromCurrency: PriceCurrencyEnumSchema,
    toCurrency: PriceCurrencyEnumSchema,

    // Rate values
    rate: numericField(
        z
            .number({
                message: 'zodError.exchangeRate.rate.required'
            })
            .positive({
                message: 'zodError.exchangeRate.rate.positive'
            })
    ),

    inverseRate: numericField(
        z
            .number({
                message: 'zodError.exchangeRate.inverseRate.required'
            })
            .positive({
                message: 'zodError.exchangeRate.inverseRate.positive'
            })
    ),

    // Rate metadata
    rateType: ExchangeRateTypeEnumSchema,
    source: ExchangeRateSourceEnumSchema,

    isManualOverride: z.boolean({
        message: 'zodError.exchangeRate.isManualOverride.required'
    }),

    // Timestamps
    expiresAt: z.coerce
        .date({
            message: 'zodError.exchangeRate.expiresAt.invalid'
        })
        .optional()
        .nullable(),

    fetchedAt: z.coerce.date({
        message: 'zodError.exchangeRate.fetchedAt.required'
    }),

    createdAt: z.coerce.date({
        message: 'zodError.common.createdAt.required'
    }),

    updatedAt: z.coerce.date({
        message: 'zodError.common.updatedAt.required'
    })
});
export type ExchangeRate = z.infer<typeof ExchangeRateSchema>;

/**
 * Exchange rates array schema
 */
export const ExchangeRatesArraySchema = z.array(ExchangeRateSchema, {
    message: 'zodError.exchangeRates.required'
});
export type ExchangeRatesArray = z.infer<typeof ExchangeRatesArraySchema>;
