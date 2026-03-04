import { describe, expect, it } from 'vitest';
import {
    calculateInverseRate,
    convertAmount,
    formatConvertedAmount,
    getRateDisplayInfo,
    isRateStale
} from '../../../src/services/exchange-rate/exchange-rate.helpers.js';

describe('Exchange Rate Helpers', () => {
    describe('convertAmount', () => {
        it('should convert amount correctly', () => {
            expect(convertAmount({ amount: 100, rate: 1500 })).toBe(150000);
        });

        it('should handle decimal rates', () => {
            expect(convertAmount({ amount: 100, rate: 0.0007 })).toBe(0.07);
        });

        it('should return 0 for zero amount', () => {
            expect(convertAmount({ amount: 0, rate: 1500 })).toBe(0);
        });

        it('should round to 2 decimal places', () => {
            expect(convertAmount({ amount: 100, rate: 1.234567 })).toBe(123.46);
        });

        it('should handle negative amounts', () => {
            expect(convertAmount({ amount: -100, rate: 1500 })).toBe(-150000);
        });
    });

    describe('calculateInverseRate', () => {
        it('should calculate inverse correctly', () => {
            const result = calculateInverseRate({ rate: 1500 });
            expect(result).toBeCloseTo(0.0006666667, 8);
        });

        it('should throw for zero rate', () => {
            expect(() => calculateInverseRate({ rate: 0 })).toThrow(
                'Cannot calculate inverse of zero rate'
            );
        });

        it('should handle rate of 1', () => {
            expect(calculateInverseRate({ rate: 1 })).toBe(1);
        });

        it('should handle very small rates', () => {
            const result = calculateInverseRate({ rate: 0.0001 });
            expect(result).toBe(10000);
        });

        it('should handle very large rates', () => {
            const result = calculateInverseRate({ rate: 10000 });
            expect(result).toBe(0.0001);
        });
    });

    describe('formatConvertedAmount', () => {
        it('should format ARS amount', () => {
            const result = formatConvertedAmount({
                amount: 1500.5,
                currency: 'ARS'
            });
            // Thousands separator depends on ICU data availability
            expect(result).toContain('500,50');
            expect(result).toContain('ARS');
        });

        it('should format USD amount', () => {
            const result = formatConvertedAmount({
                amount: 99.99,
                currency: 'USD',
                locale: 'en-US'
            });
            expect(result).toContain('99.99');
        });

        it('should default to es-AR locale', () => {
            const result = formatConvertedAmount({
                amount: 1234.56,
                currency: 'ARS'
            });
            // es-AR uses comma for decimals; thousands separator depends on ICU data
            expect(result).toContain('234,56');
            expect(result).toContain('ARS');
        });

        it('should handle zero amount', () => {
            const result = formatConvertedAmount({
                amount: 0,
                currency: 'USD',
                locale: 'en-US'
            });
            expect(result).toContain('0.00');
        });
    });

    describe('isRateStale', () => {
        it('should return false for fresh rate', () => {
            expect(isRateStale({ fetchedAt: new Date(), maxAgeMinutes: 60 })).toBe(false);
        });

        it('should return true for old rate', () => {
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            expect(isRateStale({ fetchedAt: twoHoursAgo, maxAgeMinutes: 60 })).toBe(true);
        });

        it('should return false for rate exactly at max age', () => {
            const exactlyOneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            expect(
                isRateStale({
                    fetchedAt: exactlyOneHourAgo,
                    maxAgeMinutes: 60
                })
            ).toBe(false);
        });

        it('should handle different max age values', () => {
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
            expect(
                isRateStale({
                    fetchedAt: thirtyMinutesAgo,
                    maxAgeMinutes: 15
                })
            ).toBe(true);
            expect(
                isRateStale({
                    fetchedAt: thirtyMinutesAgo,
                    maxAgeMinutes: 60
                })
            ).toBe(false);
        });
    });

    describe('getRateDisplayInfo', () => {
        it('should return display info with correct shape', () => {
            const result = getRateDisplayInfo({
                rate: 1500.1234,
                source: 'dolarapi',
                fetchedAt: new Date()
            });
            expect(result.formattedRate).toBe('1500.1234');
            expect(result.source).toBe('dolarapi');
            expect(result.isStale).toBe(false);
            expect(result.lastUpdated).toBeTruthy();
        });

        it('should format rate to 4 decimal places', () => {
            const result = getRateDisplayInfo({
                rate: 123.456789,
                source: 'test',
                fetchedAt: new Date()
            });
            expect(result.formattedRate).toBe('123.4568');
        });

        it('should detect stale rates', () => {
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            const result = getRateDisplayInfo({
                rate: 1500,
                source: 'test',
                fetchedAt: twoHoursAgo
            });
            expect(result.isStale).toBe(true);
        });

        it('should return ISO string for lastUpdated', () => {
            const testDate = new Date('2025-02-13T12:00:00.000Z');
            const result = getRateDisplayInfo({
                rate: 1500,
                source: 'test',
                fetchedAt: testDate
            });
            expect(result.lastUpdated).toBe('2025-02-13T12:00:00.000Z');
        });

        it('should preserve source name', () => {
            const result = getRateDisplayInfo({
                rate: 1500,
                source: 'custom-api-source',
                fetchedAt: new Date()
            });
            expect(result.source).toBe('custom-api-source');
        });
    });
});
