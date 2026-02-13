import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { ExchangeRateConfigSchema } from '../../../src/entities/exchange-rate/exchange-rate-config.schema.js';
import { ExchangeRateTypeEnum } from '../../../src/enums/exchange-rate-type.enum.js';

describe('ExchangeRateConfigSchema', () => {
    describe('Valid Data', () => {
        it('should validate a complete valid config', () => {
            const validData = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                defaultRateType: 'oficial',
                dolarApiFetchIntervalMinutes: 15,
                exchangeRateApiFetchIntervalHours: 6,
                showConversionDisclaimer: true,
                disclaimerText: 'Exchange rates are approximate and may vary.',
                enableAutoFetch: true,
                updatedAt: new Date('2024-01-01T10:00:00Z'),
                updatedById: '550e8400-e29b-41d4-a716-446655440001'
            };

            expect(() => ExchangeRateConfigSchema.parse(validData)).not.toThrow();

            const result = ExchangeRateConfigSchema.parse(validData);
            expect(result).toMatchObject(validData);
        });

        it('should validate minimal required config data', () => {
            const minimalData = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                updatedAt: new Date('2024-01-01T10:00:00Z')
            };

            expect(() => ExchangeRateConfigSchema.parse(minimalData)).not.toThrow();

            const result = ExchangeRateConfigSchema.parse(minimalData);
            expect(result.id).toBe(minimalData.id);
            expect(result.defaultRateType).toBe('oficial');
            expect(result.dolarApiFetchIntervalMinutes).toBe(15);
            expect(result.exchangeRateApiFetchIntervalHours).toBe(6);
            expect(result.showConversionDisclaimer).toBe(true);
            expect(result.enableAutoFetch).toBe(true);
        });

        it('should apply default values correctly', () => {
            const data = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                updatedAt: new Date()
            };

            const result = ExchangeRateConfigSchema.parse(data);

            expect(result.defaultRateType).toBe('oficial');
            expect(result.dolarApiFetchIntervalMinutes).toBe(15);
            expect(result.exchangeRateApiFetchIntervalHours).toBe(6);
            expect(result.showConversionDisclaimer).toBe(true);
            expect(result.enableAutoFetch).toBe(true);
        });

        it('should accept all valid ExchangeRateType values', () => {
            const validTypes = Object.values(ExchangeRateTypeEnum);

            for (const type of validTypes) {
                const data = {
                    id: '550e8400-e29b-41d4-a716-446655440000',
                    defaultRateType: type,
                    updatedAt: new Date()
                };

                expect(
                    () => ExchangeRateConfigSchema.parse(data),
                    `defaultRateType "${type}" should be valid`
                ).not.toThrow();
            }
        });

        it('should accept null for optional nullable fields', () => {
            const dataWithNulls = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                disclaimerText: null,
                updatedById: null,
                updatedAt: new Date()
            };

            expect(() => ExchangeRateConfigSchema.parse(dataWithNulls)).not.toThrow();

            const result = ExchangeRateConfigSchema.parse(dataWithNulls);
            expect(result.disclaimerText).toBeNull();
            expect(result.updatedById).toBeNull();
        });

        it('should accept undefined for optional fields', () => {
            const dataWithUndefined = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                updatedAt: new Date()
            };

            expect(() => ExchangeRateConfigSchema.parse(dataWithUndefined)).not.toThrow();

            const result = ExchangeRateConfigSchema.parse(dataWithUndefined);
            expect(result.disclaimerText).toBeUndefined();
            expect(result.updatedById).toBeUndefined();
        });

        it('should coerce valid date strings to Date objects', () => {
            const data = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                updatedAt: '2024-01-01T10:00:00Z'
            };

            const result = ExchangeRateConfigSchema.parse(data);

            expect(result.updatedAt).toBeInstanceOf(Date);
            expect(result.updatedAt.toISOString()).toBe('2024-01-01T10:00:00.000Z');
        });

        it('should validate custom interval values', () => {
            const customIntervals = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                dolarApiFetchIntervalMinutes: 30,
                exchangeRateApiFetchIntervalHours: 12,
                updatedAt: new Date()
            };

            expect(() => ExchangeRateConfigSchema.parse(customIntervals)).not.toThrow();

            const result = ExchangeRateConfigSchema.parse(customIntervals);
            expect(result.dolarApiFetchIntervalMinutes).toBe(30);
            expect(result.exchangeRateApiFetchIntervalHours).toBe(12);
        });

        it('should validate boolean flags', () => {
            const booleanFalseData = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                showConversionDisclaimer: false,
                enableAutoFetch: false,
                updatedAt: new Date()
            };

            expect(() => ExchangeRateConfigSchema.parse(booleanFalseData)).not.toThrow();

            const result = ExchangeRateConfigSchema.parse(booleanFalseData);
            expect(result.showConversionDisclaimer).toBe(false);
            expect(result.enableAutoFetch).toBe(false);
        });
    });

    describe('Invalid Data', () => {
        it('should reject missing required id field', () => {
            const missingId = {
                updatedAt: new Date()
            };

            expect(() => ExchangeRateConfigSchema.parse(missingId)).toThrow(ZodError);
        });

        it('should reject invalid UUID for id', () => {
            const invalidUuidCases = [
                { id: 'not-a-uuid', updatedAt: new Date() },
                { id: '12345', updatedAt: new Date() },
                { id: '', updatedAt: new Date() },
                { id: 'invalid-uuid-format', updatedAt: new Date() }
            ];

            invalidUuidCases.forEach((testCase, index) => {
                expect(
                    () => ExchangeRateConfigSchema.parse(testCase),
                    `Invalid UUID case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject invalid UUID for updatedById', () => {
            const invalidUpdatedById = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                updatedById: 'not-a-uuid',
                updatedAt: new Date()
            };

            expect(() => ExchangeRateConfigSchema.parse(invalidUpdatedById)).toThrow(ZodError);
        });

        it('should reject invalid defaultRateType values', () => {
            const invalidRateType = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                defaultRateType: 'invalid_type',
                updatedAt: new Date()
            };

            expect(() => ExchangeRateConfigSchema.parse(invalidRateType)).toThrow(ZodError);
        });

        it('should reject negative interval values', () => {
            const negativeIntervalCases = [
                {
                    id: '550e8400-e29b-41d4-a716-446655440000',
                    dolarApiFetchIntervalMinutes: -5,
                    updatedAt: new Date()
                },
                {
                    id: '550e8400-e29b-41d4-a716-446655440000',
                    exchangeRateApiFetchIntervalHours: -2,
                    updatedAt: new Date()
                }
            ];

            negativeIntervalCases.forEach((testCase, index) => {
                expect(
                    () => ExchangeRateConfigSchema.parse(testCase),
                    `Negative interval case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject zero interval values', () => {
            const zeroIntervalCases = [
                {
                    id: '550e8400-e29b-41d4-a716-446655440000',
                    dolarApiFetchIntervalMinutes: 0,
                    updatedAt: new Date()
                },
                {
                    id: '550e8400-e29b-41d4-a716-446655440000',
                    exchangeRateApiFetchIntervalHours: 0,
                    updatedAt: new Date()
                }
            ];

            zeroIntervalCases.forEach((testCase, index) => {
                expect(
                    () => ExchangeRateConfigSchema.parse(testCase),
                    `Zero interval case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject non-integer interval values', () => {
            const nonIntegerCases = [
                {
                    id: '550e8400-e29b-41d4-a716-446655440000',
                    dolarApiFetchIntervalMinutes: 15.5,
                    updatedAt: new Date()
                },
                {
                    id: '550e8400-e29b-41d4-a716-446655440000',
                    exchangeRateApiFetchIntervalHours: 6.7,
                    updatedAt: new Date()
                }
            ];

            nonIntegerCases.forEach((testCase, index) => {
                expect(
                    () => ExchangeRateConfigSchema.parse(testCase),
                    `Non-integer case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject invalid date for updatedAt', () => {
            const invalidDateCases = [
                {
                    id: '550e8400-e29b-41d4-a716-446655440000',
                    updatedAt: 'not-a-date'
                },
                {
                    id: '550e8400-e29b-41d4-a716-446655440000',
                    updatedAt: 'invalid-date-string'
                }
            ];

            invalidDateCases.forEach((testCase, index) => {
                expect(
                    () => ExchangeRateConfigSchema.parse(testCase),
                    `Invalid date case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject missing updatedAt field', () => {
            const missingUpdatedAt = {
                id: '550e8400-e29b-41d4-a716-446655440000'
            };

            expect(() => ExchangeRateConfigSchema.parse(missingUpdatedAt)).toThrow(ZodError);
        });

        it('should reject invalid boolean values', () => {
            const invalidBooleanCases = [
                {
                    id: '550e8400-e29b-41d4-a716-446655440000',
                    showConversionDisclaimer: 'true',
                    updatedAt: new Date()
                },
                {
                    id: '550e8400-e29b-41d4-a716-446655440000',
                    enableAutoFetch: 1,
                    updatedAt: new Date()
                }
            ];

            invalidBooleanCases.forEach((testCase, index) => {
                expect(
                    () => ExchangeRateConfigSchema.parse(testCase),
                    `Invalid boolean case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject non-string disclaimerText', () => {
            const invalidDisclaimerText = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                disclaimerText: 12345,
                updatedAt: new Date()
            };

            expect(() => ExchangeRateConfigSchema.parse(invalidDisclaimerText)).toThrow(ZodError);
        });
    });

    describe('Type Inference', () => {
        it('should infer correct types from valid data', () => {
            const validData = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                defaultRateType: 'oficial' as const,
                dolarApiFetchIntervalMinutes: 15,
                exchangeRateApiFetchIntervalHours: 6,
                showConversionDisclaimer: true,
                disclaimerText: 'Test disclaimer',
                enableAutoFetch: true,
                updatedAt: new Date(),
                updatedById: '550e8400-e29b-41d4-a716-446655440001'
            };

            const result = ExchangeRateConfigSchema.parse(validData);

            expect(typeof result.id).toBe('string');
            expect(typeof result.defaultRateType).toBe('string');
            expect(typeof result.dolarApiFetchIntervalMinutes).toBe('number');
            expect(typeof result.exchangeRateApiFetchIntervalHours).toBe('number');
            expect(typeof result.showConversionDisclaimer).toBe('boolean');
            expect(typeof result.enableAutoFetch).toBe('boolean');
            expect(result.updatedAt).toBeInstanceOf(Date);

            if (result.disclaimerText) {
                expect(typeof result.disclaimerText).toBe('string');
            }
            if (result.updatedById) {
                expect(typeof result.updatedById).toBe('string');
            }
        });
    });

    describe('Edge Cases', () => {
        it('should handle very large interval values', () => {
            const largeIntervals = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                dolarApiFetchIntervalMinutes: 1440, // 24 hours
                exchangeRateApiFetchIntervalHours: 168, // 1 week
                updatedAt: new Date()
            };

            expect(() => ExchangeRateConfigSchema.parse(largeIntervals)).not.toThrow();

            const result = ExchangeRateConfigSchema.parse(largeIntervals);
            expect(result.dolarApiFetchIntervalMinutes).toBe(1440);
            expect(result.exchangeRateApiFetchIntervalHours).toBe(168);
        });

        it('should handle very long disclaimerText', () => {
            const longDisclaimer = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                disclaimerText: 'A'.repeat(1000),
                updatedAt: new Date()
            };

            expect(() => ExchangeRateConfigSchema.parse(longDisclaimer)).not.toThrow();

            const result = ExchangeRateConfigSchema.parse(longDisclaimer);
            expect(result.disclaimerText?.length).toBe(1000);
        });

        it('should handle empty string disclaimerText', () => {
            const emptyDisclaimer = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                disclaimerText: '',
                updatedAt: new Date()
            };

            expect(() => ExchangeRateConfigSchema.parse(emptyDisclaimer)).not.toThrow();

            const result = ExchangeRateConfigSchema.parse(emptyDisclaimer);
            expect(result.disclaimerText).toBe('');
        });
    });
});
