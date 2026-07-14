/**
 * @file format-distance.test.ts
 * @description Unit tests for {@link formatDistanceKm} (HOS-145 T-008a).
 *
 * Rounding rule under test:
 *  - `< 1 km`: rendered in meters, rounded to the nearest 50m via
 *    `Math.round((distanceKm * 1000) / 50) * 50`.
 *  - `>= 1 km`: rendered in kilometers with exactly one decimal digit via
 *    `Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })`.
 */
import { describe, expect, it } from 'vitest';
import { formatDistanceKm } from '../../src/lib/format-distance';

describe('formatDistanceKm', () => {
    it('renders 0 km as "0 m"', () => {
        expect(formatDistanceKm({ distanceKm: 0, locale: 'es' })).toBe('0 m');
    });

    it('renders 0.349 km as "350 m" (round(6.98) * 50)', () => {
        expect(formatDistanceKm({ distanceKm: 0.349, locale: 'es' })).toBe('350 m');
    });

    it('renders 0.949 km as "950 m" (round(18.98) * 50)', () => {
        expect(formatDistanceKm({ distanceKm: 0.949, locale: 'es' })).toBe('950 m');
    });

    it('renders 1.0 km as "1,0 km" in es (comma decimal separator)', () => {
        expect(formatDistanceKm({ distanceKm: 1.0, locale: 'es' })).toBe('1,0 km');
    });

    it('renders 1.0 km as "1.0 km" in en (dot decimal separator)', () => {
        expect(formatDistanceKm({ distanceKm: 1.0, locale: 'en' })).toBe('1.0 km');
    });

    it('renders 1.25 km as "1,3 km" in es', () => {
        expect(formatDistanceKm({ distanceKm: 1.25, locale: 'es' })).toBe('1,3 km');
    });

    it('renders 1.25 km as "1.3 km" in en', () => {
        expect(formatDistanceKm({ distanceKm: 1.25, locale: 'en' })).toBe('1.3 km');
    });

    it('renders 2.34 km as "2,3 km" in es', () => {
        expect(formatDistanceKm({ distanceKm: 2.34, locale: 'es' })).toBe('2,3 km');
    });

    it('renders 2.34 km as "2.3 km" in en', () => {
        expect(formatDistanceKm({ distanceKm: 2.34, locale: 'en' })).toBe('2.3 km');
    });

    it('clamps negative distances to 0 defensively', () => {
        expect(formatDistanceKm({ distanceKm: -1, locale: 'es' })).toBe('0 m');
    });

    it('renders pt locale with comma decimal separator (pt-BR convention)', () => {
        expect(formatDistanceKm({ distanceKm: 1.25, locale: 'pt' })).toBe('1,3 km');
    });
});
