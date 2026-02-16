import type {
    ExchangeRate,
    ExchangeRateConfig,
    ExchangeRateConfigUpdateInput,
    ExchangeRateCreateInput
} from '@repo/schemas';
import { ExchangeRateSourceEnum, ExchangeRateTypeEnum, PriceCurrencyEnum } from '@repo/schemas';

/**
 * Re-export entity types from schemas
 */
export type {
    ExchangeRate,
    ExchangeRateConfig,
    ExchangeRateCreateInput,
    ExchangeRateConfigUpdateInput
};

/**
 * Re-export enums for convenience
 */
export { ExchangeRateTypeEnum, ExchangeRateSourceEnum, PriceCurrencyEnum };

/**
 * Filter interface for exchange rates list
 */
export interface ExchangeRateFilters {
    fromCurrency?: string;
    toCurrency?: string;
    rateType?: string;
    source?: string;
}

/**
 * Filter interface for exchange rate history
 */
export interface ExchangeRateHistoryFilters {
    fromCurrency?: string;
    toCurrency?: string;
    rateType?: string;
    source?: string;
    from?: string; // ISO date
    to?: string; // ISO date
    page?: number;
    limit?: number;
}

/**
 * Response from fetch-now endpoint
 */
export interface FetchNowResponse {
    totalStored: number;
    breakdown: Record<string, number>;
}
