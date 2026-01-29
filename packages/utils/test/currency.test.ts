import { describe, expect, it } from 'vitest';
import {
    calculateDiscount,
    calculateTax,
    calculateTotalWithDiscount,
    calculateTotalWithTax,
    convertCurrency,
    formatCurrency,
    parseCurrency
} from '../src/currency';

describe('Currency Utilities', () => {
    describe('formatCurrency', () => {
        it('formats amount as USD by default', () => {
            const formatted = formatCurrency(1234.56);
            expect(formatted).toContain('1,234.56');
            expect(formatted).toContain('$');
        });

        it('formats amount with specified currency', () => {
            const formatted = formatCurrency(1234.56, 'EUR', 'de-DE');
            expect(formatted).toContain('1.234,56');
        });
    });

    describe('convertCurrency', () => {
        const exchangeRates = {
            USD: 1,
            EUR: 0.85,
            GBP: 0.73
        };

        it('returns same amount when currencies are equal', () => {
            expect(convertCurrency(100, 'USD', 'USD', exchangeRates)).toBe(100);
        });

        it('converts between currencies', () => {
            const converted = convertCurrency(100, 'USD', 'EUR', exchangeRates);
            expect(converted).toBe(85);
        });

        it('throws error for unknown currency', () => {
            expect(() => convertCurrency(100, 'USD', 'XXX', exchangeRates)).toThrow();
        });
    });

    describe('calculateTax', () => {
        it('calculates tax amount correctly', () => {
            expect(calculateTax(100, 10)).toBe(10);
            expect(calculateTax(200, 21)).toBe(42);
        });

        it('handles zero tax rate', () => {
            expect(calculateTax(100, 0)).toBe(0);
        });
    });

    describe('calculateTotalWithTax', () => {
        it('calculates total with tax', () => {
            expect(calculateTotalWithTax(100, 10)).toBe(110);
            expect(calculateTotalWithTax(200, 21)).toBe(242);
        });
    });

    describe('calculateDiscount', () => {
        it('calculates discount amount correctly', () => {
            expect(calculateDiscount(100, 10)).toBe(10);
            expect(calculateDiscount(200, 25)).toBe(50);
        });

        it('handles zero discount rate', () => {
            expect(calculateDiscount(100, 0)).toBe(0);
        });
    });

    describe('calculateTotalWithDiscount', () => {
        it('calculates total with discount', () => {
            expect(calculateTotalWithDiscount(100, 10)).toBe(90);
            expect(calculateTotalWithDiscount(200, 25)).toBe(150);
        });
    });

    describe('parseCurrency', () => {
        it('parses currency string to number', () => {
            expect(parseCurrency('$1,234.56')).toBe(1234.56);
            expect(parseCurrency('€1.234,56')).toBe(1234.56);
        });

        it('handles negative values', () => {
            expect(parseCurrency('-$100.00')).toBe(-100);
        });

        it('handles simple number strings', () => {
            expect(parseCurrency('100')).toBe(100);
        });
    });
});
