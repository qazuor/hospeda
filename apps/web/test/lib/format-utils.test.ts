/**
 * @file format-utils.test.ts
 * @description Unit tests for formatting utilities.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDate, formatEventDetailDateRange, formatPrice } from '../../src/lib/format-utils';

describe('formatPrice', () => {
    it('should format ARS price with es locale', () => {
        const result = formatPrice({ amount: 12500, locale: 'es' });
        expect(result).toBeTruthy();
        expect(result).toContain('12.500');
    });

    it('should default currency to ARS', () => {
        const result = formatPrice({ amount: 100, locale: 'es' });
        expect(result).toContain('$');
    });

    it('should use specified currency', () => {
        const result = formatPrice({ amount: 100, currency: 'USD', locale: 'en' });
        expect(result).toContain('$');
        expect(result).toContain('100');
    });

    it('should hide decimals by default', () => {
        const result = formatPrice({ amount: 12500, locale: 'es' });
        expect(result).not.toContain(',00');
    });

    it('should show decimals when requested', () => {
        const result = formatPrice({ amount: 12500.5, locale: 'es', showDecimals: true });
        expect(result).toBeTruthy();
    });

    it('should handle zero amount', () => {
        const result = formatPrice({ amount: 0, locale: 'es' });
        expect(result).toContain('0');
    });

    it('should format with en locale', () => {
        const result = formatPrice({ amount: 1000, locale: 'en' });
        expect(result).toBeTruthy();
    });

    it('should format with pt locale', () => {
        const result = formatPrice({ amount: 1000, locale: 'pt' });
        expect(result).toBeTruthy();
    });
});

describe('formatDate', () => {
    it('should format Date object with es locale', () => {
        const result = formatDate({ date: new Date('2026-03-15T12:00:00Z'), locale: 'es' });
        expect(result).toBeTruthy();
        expect(result).toContain('15');
        expect(result.toLowerCase()).toContain('marzo');
    });

    it('should format ISO string with en locale', () => {
        const result = formatDate({ date: '2026-03-15T00:00:00Z', locale: 'en' });
        expect(result).toBeTruthy();
        expect(result).toContain('March');
    });

    it('should accept custom format options', () => {
        const result = formatDate({
            date: new Date('2026-03-15T12:00:00Z'),
            locale: 'es',
            options: { day: 'numeric', month: 'short' }
        });
        expect(result).toBeTruthy();
        expect(result).toContain('15');
    });

    it('should format with pt locale', () => {
        const result = formatDate({ date: new Date('2026-03-15T12:00:00Z'), locale: 'pt' });
        expect(result).toBeTruthy();
        expect(result).toContain('15');
    });

    describe('date-only values under a non-UTC runtime timezone (BETA-88)', () => {
        afterEach(() => {
            vi.unstubAllEnvs();
        });

        it('shifts a UTC-midnight date-only value back a day when no timeZone is forced', () => {
            // Reproduces the bug: a date-only value like '2026-12-01' parses to
            // UTC midnight. Without an explicit timeZone, Intl.DateTimeFormat
            // renders it in the runtime-local zone, which for Argentina (UTC-3)
            // shows the previous calendar day.
            vi.stubEnv('TZ', 'America/Argentina/Buenos_Aires');
            const result = formatDate({ date: '2026-12-01', locale: 'es' });
            expect(result).toContain('30 de noviembre');
        });

        it('renders the correct calendar day when timeZone: "UTC" is forced (BETA-88 fix)', () => {
            vi.stubEnv('TZ', 'America/Argentina/Buenos_Aires');
            const result = formatDate({
                date: '2026-12-01',
                locale: 'es',
                options: { dateStyle: 'long', timeZone: 'UTC' }
            });
            expect(result).toContain('1 de diciembre');
        });
    });
});

describe('formatEventDetailDateRange', () => {
    describe('precision: EXACT (default, unchanged behavior)', () => {
        it('returns startLabel/endLabel matching plain formatDate output', () => {
            const result = formatEventDetailDateRange({
                startDate: '2026-03-15T12:00:00Z',
                endDate: '2026-03-17T12:00:00Z',
                locale: 'es'
            });

            expect(result.precision).toBe('EXACT');
            if (result.precision !== 'EXACT') throw new Error('unreachable');
            expect(result.startLabel).toBe(
                formatDate({ date: '2026-03-15T12:00:00Z', locale: 'es' })
            );
            expect(result.endLabel).toBe(
                formatDate({ date: '2026-03-17T12:00:00Z', locale: 'es' })
            );
        });

        it('returns a null endLabel when there is no end date', () => {
            const result = formatEventDetailDateRange({
                startDate: '2026-03-15T12:00:00Z',
                locale: 'es'
            });

            expect(result.precision).toBe('EXACT');
            if (result.precision !== 'EXACT') throw new Error('unreachable');
            expect(result.endLabel).toBeNull();
        });
    });

    describe('precision: MONTH (HOS-280)', () => {
        it('same month (no end date): single month-year label', () => {
            const result = formatEventDetailDateRange({
                startDate: '2027-02-01T00:00:00.000Z',
                precision: 'MONTH',
                locale: 'es'
            });

            expect(result.precision).toBe('MONTH');
            if (result.precision !== 'MONTH') throw new Error('unreachable');
            expect(result.label.toLowerCase()).toBe('febrero de 2027');
        });

        it('same month and year on both ends: collapses to a single label', () => {
            const result = formatEventDetailDateRange({
                startDate: '2027-02-01T00:00:00.000Z',
                endDate: '2027-02-01T00:00:00.000Z',
                precision: 'MONTH',
                locale: 'es'
            });

            expect(result.precision).toBe('MONTH');
            if (result.precision !== 'MONTH') throw new Error('unreachable');
            expect(result.label.toLowerCase()).toBe('febrero de 2027');
        });

        it('cross-month, same year: start month name + en dash + end month-year, year once', () => {
            const result = formatEventDetailDateRange({
                startDate: '2027-02-01T00:00:00.000Z',
                endDate: '2027-03-01T00:00:00.000Z',
                precision: 'MONTH',
                locale: 'es'
            });

            expect(result.precision).toBe('MONTH');
            if (result.precision !== 'MONTH') throw new Error('unreachable');
            expect(result.label.toLowerCase()).toBe('febrero – marzo de 2027');
            // Year must appear exactly once.
            expect(result.label.match(/2027/g)).toHaveLength(1);
        });

        it('cross-year: full month-year label on both sides', () => {
            const result = formatEventDetailDateRange({
                startDate: '2027-12-01T00:00:00.000Z',
                endDate: '2028-01-01T00:00:00.000Z',
                precision: 'MONTH',
                locale: 'es'
            });

            expect(result.precision).toBe('MONTH');
            if (result.precision !== 'MONTH') throw new Error('unreachable');
            expect(result.label.toLowerCase()).toBe('diciembre de 2027 – enero de 2028');
        });

        it('formats en locale month-year labels without a day number', () => {
            const result = formatEventDetailDateRange({
                startDate: '2027-02-01T00:00:00.000Z',
                precision: 'MONTH',
                locale: 'en'
            });

            expect(result.precision).toBe('MONTH');
            if (result.precision !== 'MONTH') throw new Error('unreachable');
            expect(result.label).toBe('February 2027');
        });

        describe('timezone robustness (BETA-88-style regression guard)', () => {
            afterEach(() => {
                vi.unstubAllEnvs();
            });

            it('does not shift the month backward under a non-UTC runtime timezone', () => {
                vi.stubEnv('TZ', 'America/Argentina/Buenos_Aires');

                const result = formatEventDetailDateRange({
                    startDate: '2027-02-01T00:00:00.000Z',
                    precision: 'MONTH',
                    locale: 'es'
                });

                expect(result.precision).toBe('MONTH');
                if (result.precision !== 'MONTH') throw new Error('unreachable');
                expect(result.label.toLowerCase()).toBe('febrero de 2027');
            });
        });
    });
});
