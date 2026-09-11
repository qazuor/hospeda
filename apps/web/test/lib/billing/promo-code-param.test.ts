/**
 * @file promo-code-param.test.ts
 * @description Unit tests for the redeem-link code normalizer (HOS-1171).
 *
 * The value under test comes from a URL — a `/mi-cuenta/canjear/<CODE>/` path
 * segment or a `?codigo=` — and ends up as the `value` of a React input, so the
 * question these tests answer is "what can a link put in that field".
 */

import { describe, expect, it } from 'vitest';
import { normalizePromoCodeParam } from '../../../src/lib/billing/promo-code-param';

describe('normalizePromoCodeParam', () => {
    it('uppercases a well-formed code, matching how codes are stored', () => {
        // Arrange / Act / Assert — `getPromoCodeByCode` does `toUpperCase()`,
        // so a lowercase link and an uppercase one are the same code.
        expect(normalizePromoCodeParam('lanzamiento60')).toBe('LANZAMIENTO60');
        expect(normalizePromoCodeParam('LANZAMIENTO60')).toBe('LANZAMIENTO60');
    });

    it('trims surrounding whitespace a copied link tends to carry', () => {
        expect(normalizePromoCodeParam('  FREEMONTH  ')).toBe('FREEMONTH');
    });

    it('accepts the separators real codes use', () => {
        expect(normalizePromoCodeParam('hospeda_free')).toBe('HOSPEDA_FREE');
        expect(normalizePromoCodeParam('visibility-boost-7d')).toBe('VISIBILITY-BOOST-7D');
    });

    it.each([
        ['null', null],
        ['undefined', undefined],
        ['empty', ''],
        ['whitespace only', '   ']
    ])('returns undefined for %s', (_label, input) => {
        expect(normalizePromoCodeParam(input)).toBeUndefined();
    });

    it.each([
        ['a sentence', 'Tu cuenta fue suspendida, llamá a este número'],
        ['a space', 'FREE MONTH'],
        ['markup', '<script>alert(1)</script>'],
        ['a URL', 'https://evil.example/phish'],
        ['an accented word', 'CÓDIGO']
    ])('refuses %s rather than pre-filling the field with it', (_label, input) => {
        expect(normalizePromoCodeParam(input)).toBeUndefined();
    });

    it('refuses a value long enough to be used as a message', () => {
        // 51 chars — one past the cap.
        expect(normalizePromoCodeParam('A'.repeat(51))).toBeUndefined();
        // The boundary itself is accepted, so the cap is a cap and not an
        // off-by-one that would reject a legitimately long code.
        expect(normalizePromoCodeParam('A'.repeat(50))).toBe('A'.repeat(50));
    });
});
