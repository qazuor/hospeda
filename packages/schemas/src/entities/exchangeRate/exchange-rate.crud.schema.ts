import { z } from 'zod';
import { PriceCurrencyEnumSchema } from '../../enums/currency.schema.js';
import { ExchangeRateSourceEnumSchema } from '../../enums/exchange-rate-source.schema.js';
import { ExchangeRateTypeEnumSchema } from '../../enums/exchange-rate-type.schema.js';
import { ExchangeRateSchema } from './exchange-rate.schema.js';

/**
 * Exchange Rate CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for exchange rates:
 * - Create (input/output)
 * - Update (input/output)
 * - Delete (input/output)
 * - Restore (input/output)
 * - Search (input)
 * - Convert (input/output)
 */

// ============================================================================
// CREATE SCHEMAS
// ============================================================================

/**
 * Schema for creating a new exchange rate
 * Omits auto-generated fields like id and timestamps
 */
export const ExchangeRateCreateInputSchema = ExchangeRateSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Schema for exchange rate creation response
 * Returns the complete exchange rate object
 */
export const ExchangeRateCreateOutputSchema = ExchangeRateSchema;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating an exchange rate
 * Makes all fields partial for flexible updates
 */
export const ExchangeRateUpdateInputSchema = ExchangeRateSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true
}).partial();

/**
 * Schema for exchange rate update response
 * Returns the complete updated exchange rate object
 */
export const ExchangeRateUpdateOutputSchema = ExchangeRateSchema;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for exchange rate deletion input
 * Requires ID and optional force flag for hard delete
 */
export const ExchangeRateDeleteInputSchema = z.object({
    id: z
        .string({
            message: 'zodError.exchangeRate.delete.id.required'
        })
        .uuid({
            message: 'zodError.exchangeRate.delete.id.uuid'
        }),
    force: z
        .boolean({
            message: 'zodError.exchangeRate.delete.force.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for exchange rate deletion response
 * Returns success status and optional deletion timestamp
 */
export const ExchangeRateDeleteOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.exchangeRate.delete.success.required'
        })
        .default(true),
    deletedAt: z
        .date({
            message: 'zodError.exchangeRate.delete.deletedAt.invalidType'
        })
        .optional()
});

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for exchange rate restoration input
 * Requires only the exchange rate ID
 */
export const ExchangeRateRestoreInputSchema = z.object({
    id: z
        .string({
            message: 'zodError.exchangeRate.restore.id.required'
        })
        .uuid({
            message: 'zodError.exchangeRate.restore.id.uuid'
        })
});

/**
 * Schema for exchange rate restoration response
 * Returns the complete restored exchange rate object
 */
export const ExchangeRateRestoreOutputSchema = ExchangeRateSchema;

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Schema for searching exchange rates
 * All filters are optional for flexible querying
 */
export const ExchangeRateSearchInputSchema = z.object({
    fromCurrency: PriceCurrencyEnumSchema.optional(),
    toCurrency: PriceCurrencyEnumSchema.optional(),
    rateType: ExchangeRateTypeEnumSchema.optional(),
    source: ExchangeRateSourceEnumSchema.optional(),
    isManualOverride: z
        .boolean({
            message: 'zodError.exchangeRate.search.isManualOverride.invalidType'
        })
        .optional(),
    /** Filter rates fetched on or after this date */
    fromDate: z.coerce
        .date({ message: 'zodError.exchangeRate.search.fromDate.invalidDate' })
        .optional(),
    /** Filter rates fetched on or before this date */
    toDate: z.coerce.date({ message: 'zodError.exchangeRate.search.toDate.invalidDate' }).optional()
});

// ============================================================================
// CONVERT SCHEMAS
// ============================================================================

/**
 * Schema for currency conversion input
 * Requires source currency, target currency, and amount to convert
 */
export const ExchangeRateConvertInputSchema = z.object({
    from: PriceCurrencyEnumSchema,
    to: PriceCurrencyEnumSchema,
    amount: z
        .number({
            message: 'zodError.exchangeRate.convert.amount.required'
        })
        .positive({
            message: 'zodError.exchangeRate.convert.amount.positive'
        }),
    rateType: ExchangeRateTypeEnumSchema.optional()
});

/**
 * Schema for currency conversion input from HTTP query parameters
 * Uses coercion for numeric fields from query strings
 */
export const ExchangeRateConvertHttpInputSchema = z.object({
    from: PriceCurrencyEnumSchema,
    to: PriceCurrencyEnumSchema,
    amount: z.coerce
        .number({
            message: 'zodError.exchangeRate.convert.amount.required'
        })
        .positive({
            message: 'zodError.exchangeRate.convert.amount.positive'
        }),
    rateType: ExchangeRateTypeEnumSchema.optional()
});

/**
 * Schema for currency conversion output
 * Returns converted amount with rate metadata
 */
export const ExchangeRateConvertOutputSchema = z.object({
    convertedAmount: z.number({
        message: 'zodError.exchangeRate.convert.convertedAmount.required'
    }),
    rate: z
        .number({
            message: 'zodError.exchangeRate.convert.rate.required'
        })
        .positive({
            message: 'zodError.exchangeRate.convert.rate.positive'
        }),
    rateType: ExchangeRateTypeEnumSchema,
    source: ExchangeRateSourceEnumSchema,
    lastUpdated: z.coerce.date({
        message: 'zodError.exchangeRate.convert.lastUpdated.required'
    }),
    disclaimer: z
        .string({
            message: 'zodError.exchangeRate.convert.disclaimer.invalidType'
        })
        .optional()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ExchangeRateCreateInput = z.infer<typeof ExchangeRateCreateInputSchema>;
export type ExchangeRateCreateOutput = z.infer<typeof ExchangeRateCreateOutputSchema>;
export type ExchangeRateUpdateInput = z.infer<typeof ExchangeRateUpdateInputSchema>;
export type ExchangeRateUpdateOutput = z.infer<typeof ExchangeRateUpdateOutputSchema>;
export type ExchangeRateDeleteInput = z.infer<typeof ExchangeRateDeleteInputSchema>;
export type ExchangeRateDeleteOutput = z.infer<typeof ExchangeRateDeleteOutputSchema>;
export type ExchangeRateRestoreInput = z.infer<typeof ExchangeRateRestoreInputSchema>;
export type ExchangeRateRestoreOutput = z.infer<typeof ExchangeRateRestoreOutputSchema>;
export type ExchangeRateSearchInput = z.infer<typeof ExchangeRateSearchInputSchema>;
export type ExchangeRateConvertInput = z.infer<typeof ExchangeRateConvertInputSchema>;
export type ExchangeRateConvertHttpInput = z.infer<typeof ExchangeRateConvertHttpInputSchema>;
export type ExchangeRateConvertOutput = z.infer<typeof ExchangeRateConvertOutputSchema>;
