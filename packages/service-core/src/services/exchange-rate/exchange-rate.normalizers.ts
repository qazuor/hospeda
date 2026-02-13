import type { ExchangeRateCreateInput, ExchangeRateUpdateInput } from '@repo/schemas';
import { PriceCurrencyEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';
import { calculateInverseRate } from './exchange-rate.helpers.js';

/**
 * Normalizes input for creating an exchange rate.
 * - Trims string fields
 * - Validates currencies differ
 * - Calculates inverse rate
 * - Sets default values
 * @param input - The raw create input.
 * @param _actor - The actor performing the action.
 * @returns Normalized input.
 */
export const normalizeCreateInput = async (
    input: ExchangeRateCreateInput,
    _actor: Actor
): Promise<ExchangeRateCreateInput> => {
    const { fromCurrency, toCurrency, rate } = input;

    // Validate currencies are different
    if (fromCurrency === toCurrency) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'fromCurrency and toCurrency must be different'
        );
    }

    // Validate currencies are valid enum values
    if (!Object.values(PriceCurrencyEnum).includes(fromCurrency)) {
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Invalid fromCurrency');
    }

    if (!Object.values(PriceCurrencyEnum).includes(toCurrency)) {
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Invalid toCurrency');
    }

    // Calculate inverse rate
    const inverseRate = calculateInverseRate({ rate });

    return {
        fromCurrency,
        toCurrency,
        rate,
        inverseRate,
        rateType: input.rateType,
        source: input.source,
        isManualOverride: input.isManualOverride ?? false,
        fetchedAt: input.fetchedAt,
        expiresAt: input.expiresAt ?? null
    };
};

/**
 * Normalizes input for updating an exchange rate.
 * - Validates currencies if present
 * - Recalculates inverse rate if rate is updated
 * @param input - The raw update input.
 * @param _actor - The actor performing the action.
 * @returns Normalized input.
 */
export const normalizeUpdateInput = (
    input: ExchangeRateUpdateInput,
    _actor: Actor
): ExchangeRateUpdateInput => {
    const normalized: ExchangeRateUpdateInput = { ...input };

    // Validate currencies if present
    if (input.fromCurrency && !Object.values(PriceCurrencyEnum).includes(input.fromCurrency)) {
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Invalid fromCurrency');
    }

    if (input.toCurrency && !Object.values(PriceCurrencyEnum).includes(input.toCurrency)) {
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Invalid toCurrency');
    }

    // Validate currencies differ if both are provided
    if (input.fromCurrency && input.toCurrency && input.fromCurrency === input.toCurrency) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'fromCurrency and toCurrency must be different'
        );
    }

    // Recalculate inverse rate if rate is updated
    if (input.rate !== undefined) {
        normalized.inverseRate = calculateInverseRate({ rate: input.rate });
    }

    return normalized;
};
