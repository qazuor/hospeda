/**
 * @file format-utils.test.ts
 * @description Unit tests for formatting utilities.
 */

import { describe, expect, it } from 'vitest';
import { formatDate, formatPrice } from '../../src/lib/format-utils';

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
});
