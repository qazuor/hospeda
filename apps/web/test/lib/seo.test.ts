/**
 * @file seo.test.ts
 * @description Unit tests for locale-aware SEO metadata resolution (SPEC-212).
 */

import { describe, expect, it } from 'vitest';
import { pickLocalizedSeo } from '../../src/lib/seo';

describe('pickLocalizedSeo', () => {
    it('uses the stored override on the source locale (es)', () => {
        expect(
            pickLocalizedSeo({ stored: 'Título SEO', fallback: 'Cabaña | Hospeda', locale: 'es' })
        ).toBe('Título SEO');
    });

    it('ignores the Spanish-only override on en and uses the localized fallback', () => {
        expect(
            pickLocalizedSeo({ stored: 'Título SEO', fallback: 'Cabin | Hospeda', locale: 'en' })
        ).toBe('Cabin | Hospeda');
    });

    it('ignores the Spanish-only override on pt and uses the localized fallback', () => {
        expect(
            pickLocalizedSeo({ stored: 'Título SEO', fallback: 'Cabana | Hospeda', locale: 'pt' })
        ).toBe('Cabana | Hospeda');
    });

    it('falls back when no override is stored, on every locale', () => {
        expect(pickLocalizedSeo({ stored: null, fallback: 'Cabaña', locale: 'es' })).toBe('Cabaña');
        expect(pickLocalizedSeo({ stored: undefined, fallback: 'Cabin', locale: 'en' })).toBe(
            'Cabin'
        );
    });

    it('treats an empty stored override as absent', () => {
        expect(pickLocalizedSeo({ stored: '', fallback: 'Cabaña', locale: 'es' })).toBe('Cabaña');
    });
});
