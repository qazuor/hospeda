/**
 * Regression tests for HOS-950: the admin app called `formatCentsToArs` /
 * `formatArs` with the short locale code returned by `useTranslations()`
 * (e.g. `'es'`) instead of a full BCP 47 tag (`'es-AR'`). `Intl.NumberFormat`
 * treats `'es'` as generic/European Spanish, which groups thousands
 * differently (and inconsistently) from `'es-AR'` — the same table column
 * showed "35.000,00 ARS" next to "5000,00 ARS" for amounts that only
 * differed in digit count.
 *
 * These tests exercise the REAL call chain from the bug report:
 * `formatCentsToArs` (admin) -> `formatCurrency` (@repo/i18n) -> `Intl`.
 */

import { describe, expect, it } from 'vitest';
import { formatArs, formatCentsToArs } from '../../src/lib/format-helpers';

describe('formatCentsToArs', () => {
    describe('when given a short locale code (HOS-950 regression)', () => {
        it('should format 5000 (500000 cents) as "$ 5.000,00", not "5000,00 ARS"', () => {
            const result = formatCentsToArs({ cents: 500_000, locale: 'es' });

            expect(result).toBe('$ 5.000,00');
        });

        it('should format 35000 (3500000 cents) as "$ 35.000,00"', () => {
            const result = formatCentsToArs({ cents: 3_500_000, locale: 'es' });

            expect(result).toBe('$ 35.000,00');
        });

        it('should produce the identical string for "es" and "es-AR"', () => {
            const viaShort = formatCentsToArs({ cents: 500_000, locale: 'es' });
            const viaFull = formatCentsToArs({ cents: 500_000, locale: 'es-AR' });

            expect(viaShort).toBe(viaFull);
        });
    });

    describe('when cents is null or undefined', () => {
        it('should default to zero for null', () => {
            expect(formatCentsToArs({ cents: null, locale: 'es' })).toBe('$ 0,00');
        });

        it('should default to zero for undefined', () => {
            expect(formatCentsToArs({ cents: undefined, locale: 'es' })).toBe('$ 0,00');
        });
    });
});

describe('formatArs', () => {
    describe('when given a short locale code (HOS-950 regression)', () => {
        it('should format 5000 as "$ 5.000,00" (whole-unit path, same as the cents path)', () => {
            const result = formatArs({ value: 5000, locale: 'es' });

            expect(result).toBe('$ 5.000,00');
        });
    });
});
