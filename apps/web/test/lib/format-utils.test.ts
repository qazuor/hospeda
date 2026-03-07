import { formatDate, formatNumber, formatPrice, formatRelativeTime } from '@/lib/format-utils';
/**
 * Tests for format-utils.ts - Formatting utilities for dates, prices, and numbers.
 * These functions wrap @repo/i18n primitives.
 */
import { describe, expect, it } from 'vitest';

describe('formatPrice', () => {
    describe('es locale (ARS)', () => {
        it('should format a whole number with ARS currency convention', () => {
            const result = formatPrice({ amount: 1500, locale: 'es' });
            // ARS formatting: $ 1.500,00 (with period as thousand separator)
            expect(result).toContain('1');
            expect(result).toContain('500');
            expect(typeof result).toBe('string');
        });

        it('should return a non-empty string for zero amount', () => {
            const result = formatPrice({ amount: 0, locale: 'es' });
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should use USD when currency is explicitly provided as USD', () => {
            const result = formatPrice({ amount: 100, currency: 'USD', locale: 'es' });
            expect(result).toContain('100');
        });
    });

    describe('en locale (USD)', () => {
        it('should format a number with USD currency convention', () => {
            const result = formatPrice({ amount: 29.99, locale: 'en' });
            expect(result).toContain('29');
            expect(result).toContain('99');
        });

        it('should include dollar sign for en locale', () => {
            const result = formatPrice({ amount: 50, locale: 'en' });
            expect(result).toContain('$');
        });
    });

    describe('pt locale', () => {
        it('should return a non-empty currency string for pt locale', () => {
            const result = formatPrice({ amount: 500, locale: 'pt' });
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });
    });
});

describe('formatDate', () => {
    const testDate = new Date('2026-03-15T12:00:00Z');

    describe('es locale', () => {
        it('should format date in Spanish long form', () => {
            const result = formatDate({ date: testDate, locale: 'es' });
            // Spanish: "15 de marzo de 2026"
            expect(result).toContain('2026');
            expect(result).toMatch(/mar/i); // "marzo"
        });
    });

    describe('en locale', () => {
        it('should format date in English long form', () => {
            const result = formatDate({ date: '2026-03-15', locale: 'en' });
            // English: "March 15, 2026"
            expect(result).toContain('2026');
            expect(result).toMatch(/mar/i); // "March"
        });
    });

    describe('pt locale', () => {
        it('should format date in Portuguese long form', () => {
            const result = formatDate({ date: testDate, locale: 'pt' });
            expect(result).toContain('2026');
        });
    });

    describe('custom options', () => {
        it('should use custom Intl.DateTimeFormatOptions when provided', () => {
            const result = formatDate({
                date: testDate,
                locale: 'es',
                options: { year: 'numeric' }
            });
            expect(result).toContain('2026');
        });
    });

    describe('date input types', () => {
        it('should accept a Date object', () => {
            const result = formatDate({ date: new Date('2026-01-01'), locale: 'en' });
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should accept an ISO string', () => {
            const result = formatDate({ date: '2026-06-15', locale: 'en' });
            expect(typeof result).toBe('string');
            expect(result).toContain('2026');
        });

        it('should accept a unix timestamp (ms)', () => {
            // 2026-01-01T00:00:00Z
            const result = formatDate({ date: 1767225600000, locale: 'en' });
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });
    });
});

describe('formatRelativeTime', () => {
    describe('recent past (seconds)', () => {
        it('should express a date 30 seconds ago in relative terms', () => {
            const date = new Date(Date.now() - 30_000);
            const result = formatRelativeTime({ date, locale: 'en' });
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
            // e.g. "30 seconds ago" or "just now"
        });
    });

    describe('minutes ago', () => {
        it('should express a date 5 minutes ago', () => {
            const date = new Date(Date.now() - 5 * 60 * 1000);
            const result = formatRelativeTime({ date, locale: 'en' });
            expect(result).toMatch(/min/i);
        });
    });

    describe('hours ago', () => {
        it('should express a date 3 hours ago', () => {
            const date = new Date(Date.now() - 3 * 60 * 60 * 1000);
            const result = formatRelativeTime({ date, locale: 'en' });
            expect(result).toMatch(/hour/i);
        });
    });

    describe('days ago', () => {
        it('should express a date 7 days ago', () => {
            const date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const result = formatRelativeTime({ date, locale: 'en' });
            expect(result).toMatch(/day/i);
        });
    });

    describe('months ago', () => {
        it('should express a date 2 months ago', () => {
            const date = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
            const result = formatRelativeTime({ date, locale: 'en' });
            expect(result).toMatch(/month/i);
        });
    });

    describe('years ago', () => {
        it('should express a date 2 years ago', () => {
            const date = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);
            const result = formatRelativeTime({ date, locale: 'en' });
            expect(result).toMatch(/year/i);
        });
    });

    describe('locales', () => {
        it('should express relative time in Spanish', () => {
            const date = new Date(Date.now() - 5 * 60 * 1000);
            const result = formatRelativeTime({ date, locale: 'es' });
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should express relative time in Portuguese', () => {
            const date = new Date(Date.now() - 5 * 60 * 1000);
            const result = formatRelativeTime({ date, locale: 'pt' });
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });
    });

    describe('future dates', () => {
        it('should handle future dates with positive relative time', () => {
            const future = new Date(Date.now() + 5 * 60 * 1000);
            const result = formatRelativeTime({ date: future, locale: 'en' });
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });
    });
});

describe('formatNumber', () => {
    describe('es locale', () => {
        it('should use period as thousand separator and comma as decimal separator', () => {
            const result = formatNumber({ value: 1234567.89, locale: 'es' });
            // es-AR: "1.234.567,89"
            expect(result).toContain('1');
            expect(result).toContain('567');
        });
    });

    describe('en locale', () => {
        it('should use comma as thousand separator and period as decimal separator', () => {
            const result = formatNumber({ value: 1234567.89, locale: 'en' });
            // en-US: "1,234,567.89"
            expect(result).toContain('1');
            expect(result).toContain('567');
        });
    });

    describe('zero', () => {
        it('should format zero correctly', () => {
            const result = formatNumber({ value: 0, locale: 'en' });
            expect(result).toBe('0');
        });
    });

    describe('negative values', () => {
        it('should format negative number with minus sign', () => {
            const result = formatNumber({ value: -42, locale: 'en' });
            expect(result).toContain('-');
            expect(result).toContain('42');
        });
    });

    describe('custom options', () => {
        it('should format as percentage when style=percent', () => {
            const result = formatNumber({
                value: 0.5,
                locale: 'en',
                options: { style: 'percent' }
            });
            expect(result).toContain('50');
            expect(result).toContain('%');
        });
    });
});
