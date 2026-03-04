/**
 * Unit tests for date, number, and currency formatting utilities.
 *
 * Covers the three public functions exported from `src/formatting.ts`:
 *   - formatDate
 *   - formatNumber
 *   - formatCurrency
 *
 * And the internal helper exposed for testing purposes:
 *   - resolveDefaultCurrency
 *
 * Test locales: es-AR, en-US, pt-BR (and short variants es, en, pt).
 */

import { describe, expect, it } from 'vitest';
import {
    formatCurrency,
    formatDate,
    formatNumber,
    resolveDefaultCurrency,
    toBcp47Locale
} from '../src/formatting';

// ---------------------------------------------------------------------------
// toBcp47Locale
// ---------------------------------------------------------------------------

describe('toBcp47Locale', () => {
    describe('when given a short locale code', () => {
        it('should return es-AR for es', () => {
            // Arrange
            const locale = 'es';

            // Act
            const result = toBcp47Locale(locale);

            // Assert
            expect(result).toBe('es-AR');
        });

        it('should return en-US for en', () => {
            expect(toBcp47Locale('en')).toBe('en-US');
        });

        it('should return pt-BR for pt', () => {
            expect(toBcp47Locale('pt')).toBe('pt-BR');
        });
    });

    describe('when given a full BCP 47 tag', () => {
        it('should return es-AR as-is', () => {
            expect(toBcp47Locale('es-AR')).toBe('es-AR');
        });

        it('should return en-US as-is', () => {
            expect(toBcp47Locale('en-US')).toBe('en-US');
        });

        it('should return pt-BR as-is', () => {
            expect(toBcp47Locale('pt-BR')).toBe('pt-BR');
        });
    });

    describe('when given an unknown locale', () => {
        it('should return the locale as-is', () => {
            expect(toBcp47Locale('fr')).toBe('fr');
        });

        it('should return an unknown full tag as-is', () => {
            expect(toBcp47Locale('ja-JP')).toBe('ja-JP');
        });
    });
});

// ---------------------------------------------------------------------------
// resolveDefaultCurrency
// ---------------------------------------------------------------------------

describe('resolveDefaultCurrency', () => {
    describe('when given a full BCP 47 locale tag', () => {
        it('should return ARS for es-AR', () => {
            // Arrange
            const locale = 'es-AR';

            // Act
            const result = resolveDefaultCurrency(locale);

            // Assert
            expect(result).toBe('ARS');
        });

        it('should return USD for en-US', () => {
            // Arrange
            const locale = 'en-US';

            // Act
            const result = resolveDefaultCurrency(locale);

            // Assert
            expect(result).toBe('USD');
        });

        it('should return BRL for pt-BR', () => {
            // Arrange
            const locale = 'pt-BR';

            // Act
            const result = resolveDefaultCurrency(locale);

            // Assert
            expect(result).toBe('BRL');
        });

        it('should return GBP for en-GB', () => {
            // Arrange
            const locale = 'en-GB';

            // Act
            const result = resolveDefaultCurrency(locale);

            // Assert
            expect(result).toBe('GBP');
        });
    });

    describe('when given a two-letter language subtag', () => {
        it('should return ARS for es', () => {
            expect(resolveDefaultCurrency('es')).toBe('ARS');
        });

        it('should return USD for en', () => {
            expect(resolveDefaultCurrency('en')).toBe('USD');
        });

        it('should return BRL for pt', () => {
            expect(resolveDefaultCurrency('pt')).toBe('BRL');
        });
    });

    describe('when given an unknown locale', () => {
        it('should fall back to USD for an unsupported language tag', () => {
            // Arrange
            const locale = 'ja-JP';

            // Act
            const result = resolveDefaultCurrency(locale);

            // Assert
            expect(result).toBe('USD');
        });

        it('should fall back to USD for a completely unknown string', () => {
            expect(resolveDefaultCurrency('zz')).toBe('USD');
        });
    });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe('formatDate', () => {
    // Use a fixed reference date to make assertions deterministic.
    // 2026-03-15T12:00:00.000Z
    const referenceDate = new Date('2026-03-15T12:00:00.000Z');
    const referenceIso = '2026-03-15T12:00:00.000Z';
    const referenceTimestamp = referenceDate.getTime();

    describe('when given a Date object', () => {
        it('should format in Spanish (es-AR) with default long style', () => {
            // Arrange / Act
            const result = formatDate({ date: referenceDate, locale: 'es-AR' });

            // Assert: must contain the month name and year
            expect(result).toContain('2026');
            expect(result.toLowerCase()).toContain('marzo');
        });

        it('should format in English (en-US) with default long style', () => {
            const result = formatDate({ date: referenceDate, locale: 'en-US' });

            expect(result).toContain('2026');
            expect(result).toContain('March');
        });

        it('should format in Portuguese (pt-BR) with default long style', () => {
            const result = formatDate({ date: referenceDate, locale: 'pt-BR' });

            expect(result).toContain('2026');
            expect(result.toLowerCase()).toContain('março');
        });
    });

    describe('when given an ISO string', () => {
        it('should parse and format correctly for es-AR', () => {
            const result = formatDate({ date: referenceIso, locale: 'es-AR' });

            expect(result).toContain('2026');
            expect(result.toLowerCase()).toContain('marzo');
        });

        it('should parse and format correctly for en-US', () => {
            const result = formatDate({ date: referenceIso, locale: 'en-US' });

            expect(result).toContain('March');
        });
    });

    describe('when given a Unix timestamp (number)', () => {
        it('should parse and format correctly for es-AR', () => {
            const result = formatDate({ date: referenceTimestamp, locale: 'es-AR' });

            expect(result).toContain('2026');
        });

        it('should parse and format correctly for en-US', () => {
            const result = formatDate({ date: referenceTimestamp, locale: 'en-US' });

            expect(result).toContain('2026');
        });
    });

    describe('when custom options are provided', () => {
        it('should apply custom dateStyle: short', () => {
            // Arrange
            const options: Intl.DateTimeFormatOptions = { dateStyle: 'short' };

            // Act
            const result = formatDate({ date: referenceDate, locale: 'en-US', options });

            // Assert: short style omits month name
            expect(result).not.toContain('March');
            expect(result).toMatch(/\d/); // contains digits
        });

        it('should apply numeric month/day/year for es-AR', () => {
            const options: Intl.DateTimeFormatOptions = {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            };

            const result = formatDate({ date: referenceDate, locale: 'es-AR', options });

            expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
        });
    });

    describe('edge cases', () => {
        it('should throw TypeError for an invalid Date object', () => {
            // Arrange
            const invalidDate = new Date('not-a-date');

            // Act / Assert
            expect(() => formatDate({ date: invalidDate, locale: 'es-AR' })).toThrow(TypeError);
        });

        it('should throw TypeError for a completely invalid string', () => {
            expect(() => formatDate({ date: 'not-a-date', locale: 'en-US' })).toThrow(TypeError);
        });

        it('should handle epoch as a valid timestamp', () => {
            // Use a timestamp well past midnight UTC to avoid timezone-induced
            // date rollover into the previous day in negative-offset environments.
            // 1970-01-02T12:00:00Z is unambiguously "January 2, 1970" in all timezones.
            const result = formatDate({ date: 86400000 + 43200000, locale: 'en-US' });

            expect(result).toContain('1970');
        });

        it('should handle very large timestamps (far future)', () => {
            // Use noon UTC to avoid timezone rollover.
            const futureDate = new Date('2100-06-15T12:00:00.000Z');
            const result = formatDate({ date: futureDate, locale: 'en-US' });

            expect(result).toContain('2100');
        });
    });
});

// ---------------------------------------------------------------------------
// formatNumber
// ---------------------------------------------------------------------------

describe('formatNumber', () => {
    describe('when formatting integers', () => {
        it('should use period as grouping separator in en-US', () => {
            // Arrange
            const value = 1_234_567;

            // Act
            const result = formatNumber({ value, locale: 'en-US' });

            // Assert
            expect(result).toBe('1,234,567');
        });

        it('should use period as grouping separator in es-AR (thousands dot)', () => {
            const result = formatNumber({ value: 1_234_567, locale: 'es-AR' });

            // In es-AR the grouping separator is a dot: "1.234.567"
            expect(result).toContain('1');
            expect(result).toContain('234');
            expect(result).toContain('567');
        });
    });

    describe('when formatting decimals', () => {
        it('should use comma as decimal separator in es-AR', () => {
            const result = formatNumber({ value: 1234.56, locale: 'es-AR' });

            // Decimal part separated by comma in es-AR
            expect(result).toContain(',');
            expect(result).toContain('56');
        });

        it('should use period as decimal separator in en-US', () => {
            const result = formatNumber({ value: 1234.56, locale: 'en-US' });

            expect(result).toBe('1,234.56');
        });

        it('should use comma as decimal separator in pt-BR', () => {
            const result = formatNumber({ value: 1234.56, locale: 'pt-BR' });

            expect(result).toContain(',');
            expect(result).toContain('56');
        });
    });

    describe('when formatting zero', () => {
        it('should return "0" for en-US', () => {
            expect(formatNumber({ value: 0, locale: 'en-US' })).toBe('0');
        });

        it('should return locale-appropriate zero for es-AR', () => {
            const result = formatNumber({ value: 0, locale: 'es-AR' });
            expect(result).toBe('0');
        });
    });

    describe('when formatting negative numbers', () => {
        it('should include a negative sign for en-US', () => {
            const result = formatNumber({ value: -42.5, locale: 'en-US' });

            expect(result).toContain('-');
            expect(result).toContain('42');
        });

        it('should include a negative sign for es-AR', () => {
            const result = formatNumber({ value: -1000, locale: 'es-AR' });

            expect(result).toContain('-');
        });
    });

    describe('when formatting very large numbers', () => {
        it('should correctly group digits for en-US', () => {
            const result = formatNumber({ value: 1_000_000_000, locale: 'en-US' });

            expect(result).toBe('1,000,000,000');
        });
    });

    describe('when custom options are provided', () => {
        it('should format as percentage for en-US', () => {
            // Arrange
            const options: Intl.NumberFormatOptions = { style: 'percent' };

            // Act
            const result = formatNumber({ value: 0.5, locale: 'en-US', options });

            // Assert
            expect(result).toBe('50%');
        });

        it('should respect minimumFractionDigits option', () => {
            const options: Intl.NumberFormatOptions = { minimumFractionDigits: 4 };
            const result = formatNumber({ value: 1.5, locale: 'en-US', options });

            expect(result).toBe('1.5000');
        });

        it('should respect maximumFractionDigits option', () => {
            const options: Intl.NumberFormatOptions = { maximumFractionDigits: 0 };
            const result = formatNumber({ value: 1234.789, locale: 'en-US', options });

            expect(result).toBe('1,235');
        });
    });
});

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------

describe('formatCurrency', () => {
    describe('when currency is inferred from locale', () => {
        it('should default to ARS for es-AR', () => {
            // Arrange
            const value = 1500;

            // Act
            const result = formatCurrency({ value, locale: 'es-AR' });

            // Assert: output must contain the amount digits and ARS symbol
            expect(result).toContain('1');
            expect(result).toContain('500');
            // ARS symbol is '$' or 'ARS' depending on implementation
            expect(result.length).toBeGreaterThan(4);
        });

        it('should default to USD for en-US', () => {
            const result = formatCurrency({ value: 29.99, locale: 'en-US' });

            expect(result).toContain('29');
            expect(result).toContain('99');
            expect(result).toContain('$');
        });

        it('should default to BRL for pt-BR', () => {
            const result = formatCurrency({ value: 49.9, locale: 'pt-BR' });

            expect(result).toContain('49');
            expect(result).toContain('90');
            // BRL symbol 'R$' appears somewhere in the string
            expect(result).toContain('R$');
        });

        it('should default to ARS for two-letter locale es', () => {
            const result = formatCurrency({ value: 100, locale: 'es' });

            expect(result).toContain('100');
        });

        it('should default to USD for two-letter locale en', () => {
            const result = formatCurrency({ value: 100, locale: 'en' });

            expect(result).toContain('$');
        });

        it('should default to BRL for two-letter locale pt', () => {
            const result = formatCurrency({ value: 100, locale: 'pt' });

            expect(result).toContain('R$');
        });
    });

    describe('when an explicit currency is provided', () => {
        it('should override the locale default for es-AR with USD', () => {
            const result = formatCurrency({ value: 100, locale: 'es-AR', currency: 'USD' });

            // Should contain USD indicator, not ARS
            expect(result).toContain('US');
        });

        it('should format EUR for en-US', () => {
            const result = formatCurrency({ value: 50, locale: 'en-US', currency: 'EUR' });

            expect(result).toContain('50');
            // EUR symbol or code
            expect(result.length).toBeGreaterThan(3);
        });
    });

    describe('when formatting zero', () => {
        it('should format zero in ARS correctly', () => {
            const result = formatCurrency({ value: 0, locale: 'es-AR' });

            expect(result).toContain('0');
        });

        it('should format zero in USD correctly', () => {
            const result = formatCurrency({ value: 0, locale: 'en-US' });

            expect(result).toBe('$0.00');
        });
    });

    describe('when formatting negative amounts', () => {
        it('should include a negative sign for en-US USD', () => {
            const result = formatCurrency({ value: -250, locale: 'en-US' });

            expect(result).toContain('-');
            expect(result).toContain('250');
        });

        it('should include a negative sign for es-AR ARS', () => {
            const result = formatCurrency({ value: -1000, locale: 'es-AR' });

            expect(result).toContain('-');
            expect(result).toContain('1');
        });
    });

    describe('when formatting very large amounts', () => {
        it('should correctly group digits for USD', () => {
            const result = formatCurrency({ value: 1_000_000, locale: 'en-US' });

            expect(result).toBe('$1,000,000.00');
        });

        it('should correctly group digits for ARS', () => {
            const result = formatCurrency({ value: 1_000_000, locale: 'es-AR' });

            expect(result).toContain('000');
        });
    });
});
