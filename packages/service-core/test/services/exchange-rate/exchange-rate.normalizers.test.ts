/**
 * @file exchange-rate.normalizers.test.ts
 *
 * Unit tests for exchange-rate normalizer functions.
 * Covers:
 * - normalizeCreateInput: invalid fromCurrency, invalid toCurrency, same currencies, happy path
 * - normalizeUpdateInput: invalid fromCurrency, invalid toCurrency, same currencies when both provided, rate recalculation
 */

import type { ExchangeRateCreateInput } from '@repo/schemas';
import {
    ExchangeRateSourceEnum,
    ExchangeRateTypeEnum,
    PriceCurrencyEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    normalizeCreateInput,
    normalizeUpdateInput
} from '../../../src/services/exchange-rate/exchange-rate.normalizers.js';
import { ServiceError } from '../../../src/types/index.js';
import { createActor } from '../../factories/actorFactory.js';

describe('exchange-rate.normalizers', () => {
    const actor = createActor({});

    describe('normalizeCreateInput', () => {
        /**
         * Base valid input satisfying ExchangeRateCreateInput.
         * inverseRate is included since the schema inherits from ExchangeRateSchema
         * which has it as required; the normalizer overwrites it with the computed value.
         */
        const baseInput: ExchangeRateCreateInput = {
            fromCurrency: PriceCurrencyEnum.USD,
            toCurrency: PriceCurrencyEnum.ARS,
            rate: 1000,
            inverseRate: 0.001,
            rateType: ExchangeRateTypeEnum.OFICIAL,
            source: ExchangeRateSourceEnum.MANUAL,
            isManualOverride: false,
            fetchedAt: new Date(),
            expiresAt: null
        };

        it('should throw VALIDATION_ERROR when fromCurrency equals toCurrency', async () => {
            // Arrange
            const input: ExchangeRateCreateInput = {
                ...baseInput,
                toCurrency: PriceCurrencyEnum.USD
            };

            // Act + Assert
            await expect(normalizeCreateInput(input, actor)).rejects.toThrow(ServiceError);
            await expect(normalizeCreateInput(input, actor)).rejects.toMatchObject({
                code: ServiceErrorCode.VALIDATION_ERROR
            });
        });

        it('should throw VALIDATION_ERROR for invalid fromCurrency', async () => {
            // Arrange — cast to force runtime invalid value through TypeScript
            const input = {
                ...baseInput,
                fromCurrency: 'INVALID' as PriceCurrencyEnum
            } as ExchangeRateCreateInput;

            // Act + Assert
            await expect(normalizeCreateInput(input, actor)).rejects.toMatchObject({
                code: ServiceErrorCode.VALIDATION_ERROR
            });
        });

        it('should throw VALIDATION_ERROR for invalid toCurrency', async () => {
            // Arrange
            const input = {
                ...baseInput,
                toCurrency: 'INVALID' as PriceCurrencyEnum
            } as ExchangeRateCreateInput;

            // Act + Assert
            await expect(normalizeCreateInput(input, actor)).rejects.toMatchObject({
                code: ServiceErrorCode.VALIDATION_ERROR
            });
        });

        it('should return normalized input with computed inverseRate', async () => {
            // Arrange — inverseRate in input is overwritten by the normalizer
            const input: ExchangeRateCreateInput = { ...baseInput, rate: 1000 };

            // Act
            const result = await normalizeCreateInput(input, actor);

            // Assert
            expect(result.fromCurrency).toBe(PriceCurrencyEnum.USD);
            expect(result.toCurrency).toBe(PriceCurrencyEnum.ARS);
            expect(result.rate).toBe(1000);
            // Inverse rate = 1 / 1000 = 0.001
            expect(result.inverseRate).toBeCloseTo(0.001);
        });
    });

    describe('normalizeUpdateInput', () => {
        it('should throw VALIDATION_ERROR for invalid fromCurrency', () => {
            // Act + Assert
            expect(() =>
                normalizeUpdateInput({ fromCurrency: 'BAD' as PriceCurrencyEnum }, actor)
            ).toThrow(ServiceError);
        });

        it('should throw VALIDATION_ERROR for invalid toCurrency', () => {
            // Act + Assert
            expect(() =>
                normalizeUpdateInput({ toCurrency: 'BAD' as PriceCurrencyEnum }, actor)
            ).toThrow(ServiceError);
        });

        it('should throw VALIDATION_ERROR when both currencies are provided and equal', () => {
            // Act + Assert
            expect(() =>
                normalizeUpdateInput(
                    { fromCurrency: PriceCurrencyEnum.ARS, toCurrency: PriceCurrencyEnum.ARS },
                    actor
                )
            ).toThrow(ServiceError);
        });

        it('should recalculate inverseRate when rate is updated', () => {
            // Arrange
            const input = { rate: 500 };

            // Act
            const result = normalizeUpdateInput(input, actor);

            // Assert
            expect(result.rate).toBe(500);
            expect(result.inverseRate).toBeCloseTo(0.002);
        });

        it('should not set inverseRate when rate is not in input', () => {
            // Arrange
            const input = {
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS
            };

            // Act
            const result = normalizeUpdateInput(input, actor);

            // Assert
            expect(result.inverseRate).toBeUndefined();
        });
    });
});
