import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    ExchangeRateSchema,
    ExchangeRatesArraySchema
} from '../../../src/entities/exchange-rate/exchange-rate.schema.js';
import { PriceCurrencyEnum } from '../../../src/enums/currency.enum.js';
import { ExchangeRateSourceEnum } from '../../../src/enums/exchange-rate-source.enum.js';
import { ExchangeRateTypeEnum } from '../../../src/enums/exchange-rate-type.enum.js';

describe('ExchangeRateSchema', () => {
    describe('Valid Data', () => {
        it('should validate a complete valid exchange rate', () => {
            const validData = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1050.5,
                inverseRate: 0.000952,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.DOLARAPI,
                isManualOverride: false,
                expiresAt: new Date('2026-12-31'),
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(() => ExchangeRateSchema.parse(validData)).not.toThrow();

            const result = ExchangeRateSchema.parse(validData);
            expect(result).toMatchObject(validData);
        });

        it('should validate minimal required exchange rate data', () => {
            const minimalData = {
                id: '550e8400-e29b-41d4-a716-446655440001',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1000,
                inverseRate: 0.001,
                rateType: ExchangeRateTypeEnum.STANDARD,
                source: ExchangeRateSourceEnum.EXCHANGERATE_API,
                isManualOverride: false,
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(() => ExchangeRateSchema.parse(minimalData)).not.toThrow();
        });

        it('should validate exchange rate with null expiresAt', () => {
            const dataWithNullExpiry = {
                id: '550e8400-e29b-41d4-a716-446655440002',
                fromCurrency: PriceCurrencyEnum.BRL,
                toCurrency: PriceCurrencyEnum.USD,
                rate: 0.2,
                inverseRate: 5.0,
                rateType: ExchangeRateTypeEnum.STANDARD,
                source: ExchangeRateSourceEnum.EXCHANGERATE_API,
                isManualOverride: false,
                expiresAt: null,
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(() => ExchangeRateSchema.parse(dataWithNullExpiry)).not.toThrow();
        });

        it('should validate exchange rate without expiresAt field', () => {
            const dataWithoutExpiry = {
                id: '550e8400-e29b-41d4-a716-446655440003',
                fromCurrency: PriceCurrencyEnum.ARS,
                toCurrency: PriceCurrencyEnum.BRL,
                rate: 0.0053,
                inverseRate: 188.67,
                rateType: ExchangeRateTypeEnum.STANDARD,
                source: ExchangeRateSourceEnum.MANUAL,
                isManualOverride: true,
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(() => ExchangeRateSchema.parse(dataWithoutExpiry)).not.toThrow();
        });

        it('should validate all PriceCurrencyEnum values for fromCurrency', () => {
            const currencies = Object.values(PriceCurrencyEnum);

            for (const currency of currencies) {
                const data = {
                    id: '550e8400-e29b-41d4-a716-446655440004',
                    fromCurrency: currency,
                    toCurrency: PriceCurrencyEnum.USD,
                    rate: 1.5,
                    inverseRate: 0.666,
                    rateType: ExchangeRateTypeEnum.STANDARD,
                    source: ExchangeRateSourceEnum.EXCHANGERATE_API,
                    isManualOverride: false,
                    fetchedAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                expect(
                    () => ExchangeRateSchema.parse(data),
                    `Currency ${currency} should be valid for fromCurrency`
                ).not.toThrow();
            }
        });

        it('should validate all PriceCurrencyEnum values for toCurrency', () => {
            const currencies = Object.values(PriceCurrencyEnum);

            for (const currency of currencies) {
                const data = {
                    id: '550e8400-e29b-41d4-a716-446655440005',
                    fromCurrency: PriceCurrencyEnum.USD,
                    toCurrency: currency,
                    rate: 1.5,
                    inverseRate: 0.666,
                    rateType: ExchangeRateTypeEnum.STANDARD,
                    source: ExchangeRateSourceEnum.EXCHANGERATE_API,
                    isManualOverride: false,
                    fetchedAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                expect(
                    () => ExchangeRateSchema.parse(data),
                    `Currency ${currency} should be valid for toCurrency`
                ).not.toThrow();
            }
        });

        it('should validate all ExchangeRateTypeEnum values', () => {
            const rateTypes = Object.values(ExchangeRateTypeEnum);

            for (const rateType of rateTypes) {
                const data = {
                    id: '550e8400-e29b-41d4-a716-446655440006',
                    fromCurrency: PriceCurrencyEnum.USD,
                    toCurrency: PriceCurrencyEnum.ARS,
                    rate: 1050,
                    inverseRate: 0.000952,
                    rateType: rateType,
                    source: ExchangeRateSourceEnum.DOLARAPI,
                    isManualOverride: false,
                    fetchedAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                expect(
                    () => ExchangeRateSchema.parse(data),
                    `Rate type ${rateType} should be valid`
                ).not.toThrow();
            }
        });

        it('should validate all ExchangeRateSourceEnum values', () => {
            const sources = Object.values(ExchangeRateSourceEnum);

            for (const source of sources) {
                const data = {
                    id: '550e8400-e29b-41d4-a716-446655440007',
                    fromCurrency: PriceCurrencyEnum.USD,
                    toCurrency: PriceCurrencyEnum.ARS,
                    rate: 1050,
                    inverseRate: 0.000952,
                    rateType: ExchangeRateTypeEnum.OFICIAL,
                    source: source,
                    isManualOverride: false,
                    fetchedAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                expect(
                    () => ExchangeRateSchema.parse(data),
                    `Source ${source} should be valid`
                ).not.toThrow();
            }
        });

        it('should validate isManualOverride as boolean true', () => {
            const data = {
                id: '550e8400-e29b-41d4-a716-446655440008',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1100,
                inverseRate: 0.00091,
                rateType: ExchangeRateTypeEnum.BLUE,
                source: ExchangeRateSourceEnum.MANUAL,
                isManualOverride: true,
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(() => ExchangeRateSchema.parse(data)).not.toThrow();
            const result = ExchangeRateSchema.parse(data);
            expect(result.isManualOverride).toBe(true);
        });

        it('should validate isManualOverride as boolean false', () => {
            const data = {
                id: '550e8400-e29b-41d4-a716-446655440009',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1000,
                inverseRate: 0.001,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.DOLARAPI,
                isManualOverride: false,
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(() => ExchangeRateSchema.parse(data)).not.toThrow();
            const result = ExchangeRateSchema.parse(data);
            expect(result.isManualOverride).toBe(false);
        });

        it('should coerce string dates to Date objects', () => {
            const data = {
                id: '550e8400-e29b-41d4-a716-446655440010',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1000,
                inverseRate: 0.001,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.DOLARAPI,
                isManualOverride: false,
                expiresAt: '2026-12-31T00:00:00Z',
                fetchedAt: '2026-02-13T10:00:00Z',
                createdAt: '2026-02-13T09:00:00Z',
                updatedAt: '2026-02-13T09:30:00Z'
            };

            const result = ExchangeRateSchema.parse(data);
            expect(result.expiresAt).toBeInstanceOf(Date);
            expect(result.fetchedAt).toBeInstanceOf(Date);
            expect(result.createdAt).toBeInstanceOf(Date);
            expect(result.updatedAt).toBeInstanceOf(Date);
        });
    });

    describe('Invalid Data', () => {
        it('should reject missing required fields', () => {
            const incompleteData = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                fromCurrency: PriceCurrencyEnum.USD
                // Missing many required fields
            };

            expect(() => ExchangeRateSchema.parse(incompleteData)).toThrow(ZodError);
        });

        it('should reject invalid UUID format', () => {
            const invalidUuid = {
                id: 'not-a-valid-uuid',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1000,
                inverseRate: 0.001,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.DOLARAPI,
                isManualOverride: false,
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(() => ExchangeRateSchema.parse(invalidUuid)).toThrow(ZodError);
        });

        it('should reject negative rate', () => {
            const negativeRate = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: -100,
                inverseRate: 0.001,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.DOLARAPI,
                isManualOverride: false,
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(() => ExchangeRateSchema.parse(negativeRate)).toThrow(ZodError);
        });

        it('should reject zero rate', () => {
            const zeroRate = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 0,
                inverseRate: 0.001,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.DOLARAPI,
                isManualOverride: false,
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(() => ExchangeRateSchema.parse(zeroRate)).toThrow(ZodError);
        });

        it('should reject negative inverseRate', () => {
            const negativeInverseRate = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1000,
                inverseRate: -0.001,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.DOLARAPI,
                isManualOverride: false,
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(() => ExchangeRateSchema.parse(negativeInverseRate)).toThrow(ZodError);
        });

        it('should reject zero inverseRate', () => {
            const zeroInverseRate = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1000,
                inverseRate: 0,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.DOLARAPI,
                isManualOverride: false,
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(() => ExchangeRateSchema.parse(zeroInverseRate)).toThrow(ZodError);
        });

        it('should reject invalid currency value', () => {
            const invalidCurrency = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                fromCurrency: 'EUR', // Not in PriceCurrencyEnum
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1000,
                inverseRate: 0.001,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.DOLARAPI,
                isManualOverride: false,
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(() => ExchangeRateSchema.parse(invalidCurrency)).toThrow(ZodError);
        });

        it('should reject invalid rateType value', () => {
            const invalidRateType = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1000,
                inverseRate: 0.001,
                rateType: 'invalid_type',
                source: ExchangeRateSourceEnum.DOLARAPI,
                isManualOverride: false,
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(() => ExchangeRateSchema.parse(invalidRateType)).toThrow(ZodError);
        });

        it('should reject invalid source value', () => {
            const invalidSource = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1000,
                inverseRate: 0.001,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: 'unknown_source',
                isManualOverride: false,
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(() => ExchangeRateSchema.parse(invalidSource)).toThrow(ZodError);
        });

        it('should reject non-boolean isManualOverride', () => {
            const invalidBoolean = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1000,
                inverseRate: 0.001,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.DOLARAPI,
                isManualOverride: 'true', // String instead of boolean
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(() => ExchangeRateSchema.parse(invalidBoolean)).toThrow(ZodError);
        });

        it('should reject invalid date format', () => {
            const invalidDate = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1000,
                inverseRate: 0.001,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.DOLARAPI,
                isManualOverride: false,
                fetchedAt: 'not-a-date',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(() => ExchangeRateSchema.parse(invalidDate)).toThrow(ZodError);
        });
    });

    describe('Type Inference', () => {
        it('should infer correct types from valid data', () => {
            const validData = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1000,
                inverseRate: 0.001,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.DOLARAPI,
                isManualOverride: false,
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = ExchangeRateSchema.parse(validData);

            // Type checks
            expect(typeof result.id).toBe('string');
            expect(typeof result.fromCurrency).toBe('string');
            expect(typeof result.toCurrency).toBe('string');
            expect(typeof result.rate).toBe('number');
            expect(typeof result.inverseRate).toBe('number');
            expect(typeof result.rateType).toBe('string');
            expect(typeof result.source).toBe('string');
            expect(typeof result.isManualOverride).toBe('boolean');
            expect(result.fetchedAt).toBeInstanceOf(Date);
            expect(result.createdAt).toBeInstanceOf(Date);
            expect(result.updatedAt).toBeInstanceOf(Date);
        });

        it('should handle optional expiresAt correctly', () => {
            const dataWithExpiry = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1000,
                inverseRate: 0.001,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.DOLARAPI,
                isManualOverride: false,
                expiresAt: new Date(),
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = ExchangeRateSchema.parse(dataWithExpiry);
            expect(result.expiresAt).toBeInstanceOf(Date);

            const dataWithNullExpiry = {
                ...dataWithExpiry,
                expiresAt: null
            };

            const resultNull = ExchangeRateSchema.parse(dataWithNullExpiry);
            expect(resultNull.expiresAt).toBeNull();
        });
    });
});

describe('ExchangeRatesArraySchema', () => {
    it('should validate array of exchange rates', () => {
        const validArray = [
            {
                id: '550e8400-e29b-41d4-a716-446655440000',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1000,
                inverseRate: 0.001,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.DOLARAPI,
                isManualOverride: false,
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: '550e8400-e29b-41d4-a716-446655440001',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: 1100,
                inverseRate: 0.00091,
                rateType: ExchangeRateTypeEnum.BLUE,
                source: ExchangeRateSourceEnum.DOLARAPI,
                isManualOverride: false,
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];

        expect(() => ExchangeRatesArraySchema.parse(validArray)).not.toThrow();
        const result = ExchangeRatesArraySchema.parse(validArray);
        expect(result).toHaveLength(2);
    });

    it('should validate empty array', () => {
        expect(() => ExchangeRatesArraySchema.parse([])).not.toThrow();
    });

    it('should reject array with invalid exchange rate', () => {
        const invalidArray = [
            {
                id: 'invalid-uuid',
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: -100, // Invalid negative rate
                inverseRate: 0.001,
                rateType: ExchangeRateTypeEnum.OFICIAL,
                source: ExchangeRateSourceEnum.DOLARAPI,
                isManualOverride: false,
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];

        expect(() => ExchangeRatesArraySchema.parse(invalidArray)).toThrow(ZodError);
    });
});
