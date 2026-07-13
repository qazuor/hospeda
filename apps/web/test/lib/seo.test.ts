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

    // BETA-163: stored titles authored with a "... en {city}" template can end
    // up with a dangling preposition when the city was empty/undefined.
    it('strips a dangling trailing "en" left by an empty interpolated city', () => {
        expect(
            pickLocalizedSeo({
                stored: 'Cabaña del Río - Alojamiento a 300m del río Uruguay en',
                fallback: 'Cabaña del Río',
                locale: 'es'
            })
        ).toBe('Cabaña del Río - Alojamiento a 300m del río Uruguay');
    });

    it('keeps a stored title that already ends with a real city intact', () => {
        expect(
            pickLocalizedSeo({
                stored: 'Cabaña del Río - Alojamiento a 300m del río Uruguay en Colón',
                fallback: 'Cabaña del Río',
                locale: 'es'
            })
        ).toBe('Cabaña del Río - Alojamiento a 300m del río Uruguay en Colón');
    });

    it('does not strip "en" when it is not the trailing word', () => {
        expect(
            pickLocalizedSeo({
                stored: 'Encantada casa en el bosque',
                fallback: 'Encantada casa',
                locale: 'es'
            })
        ).toBe('Encantada casa en el bosque');
    });
});
