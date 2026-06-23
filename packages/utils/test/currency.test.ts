import { describe, expect, it } from 'vitest';
import {
    calculateDiscount,
    calculateTax,
    calculateTotalWithDiscount,
    calculateTotalWithTax,
    convertCurrency,
    formatCurrency,
    formatMicroUsd,
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

// ---------------------------------------------------------------------------
// formatMicroUsd (SPEC-260 T-002)
// ---------------------------------------------------------------------------

describe('formatMicroUsd', () => {
    describe('when given spec example values', () => {
        it('should format 90000 µUSD as "$0.09"', () => {
            // Arrange
            const microUsd = 90000;

            // Act
            const result = formatMicroUsd(microUsd);

            // Assert
            expect(result).toBe('$0.09');
        });

        it('should format 184000 µUSD as "$0.184"', () => {
            // Arrange
            const microUsd = 184000;

            // Act
            const result = formatMicroUsd(microUsd);

            // Assert
            expect(result).toBe('$0.184');
        });
    });

    describe('when given zero', () => {
        it('should return "$0" for zero µUSD', () => {
            // Arrange
            const microUsd = 0;

            // Act
            const result = formatMicroUsd(microUsd);

            // Assert
            expect(result).toBe('$0');
        });
    });

    describe('when given large values', () => {
        it('should format 5000000 µUSD (exactly $5) without decimal places', () => {
            // Arrange
            const microUsd = 5_000_000;

            // Act
            const result = formatMicroUsd(microUsd);

            // Assert
            expect(result).toBe('$5');
        });

        it('should format 1000000 µUSD (exactly $1) without decimal places', () => {
            // Arrange
            const microUsd = 1_000_000;

            // Act
            const result = formatMicroUsd(microUsd);

            // Assert
            expect(result).toBe('$1');
        });

        it('should format 1234567 µUSD with full sub-dollar precision', () => {
            // Arrange
            const microUsd = 1_234_567;

            // Act
            const result = formatMicroUsd(microUsd);

            // Assert
            expect(result).toBe('$1.234567');
        });
    });

    describe('when given values that produce trailing zeros', () => {
        it('should strip trailing zeros for a whole cent (100000 µUSD = $0.10)', () => {
            // Arrange
            const microUsd = 100_000;

            // Act
            const result = formatMicroUsd(microUsd);

            // Assert
            expect(result).toBe('$0.1');
        });

        it('should strip trailing zeros for a half-dollar (500000 µUSD = $0.50)', () => {
            // Arrange
            const microUsd = 500_000;

            // Act
            const result = formatMicroUsd(microUsd);

            // Assert
            expect(result).toBe('$0.5');
        });
    });

    describe('when given non-finite values (guard)', () => {
        it('should return "$0" for Infinity', () => {
            // Arrange & Act
            const result = formatMicroUsd(Number.POSITIVE_INFINITY);

            // Assert
            expect(result).toBe('$0');
        });

        it('should return "$0" for NaN', () => {
            // Arrange & Act
            const result = formatMicroUsd(Number.NaN);

            // Assert
            expect(result).toBe('$0');
        });
    });
});
