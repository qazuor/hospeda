/**
 * Unit tests for the pure `pickLocaleFromAcceptLanguage` resolver.
 *
 * The server-function wrapper (`fetchPreferredLocale`) is not tested here —
 * it would require a TanStack Start request context. The pure function does
 * all the parsing/matching work, so testing it directly gives full coverage
 * of the interesting logic.
 */

import { describe, expect, it } from 'vitest';
import { pickLocaleFromAcceptLanguage } from '../../src/lib/locale';

const SUPPORTED = ['es', 'en', 'pt'] as const;
const DEFAULT = 'es';

describe('pickLocaleFromAcceptLanguage', () => {
    it('returns default when header is null', () => {
        const { locale } = pickLocaleFromAcceptLanguage({
            header: null,
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(locale).toBe('es');
    });

    it('returns default when header is undefined', () => {
        const { locale } = pickLocaleFromAcceptLanguage({
            header: undefined,
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(locale).toBe('es');
    });

    it('returns default when header is empty', () => {
        const { locale } = pickLocaleFromAcceptLanguage({
            header: '',
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(locale).toBe('es');
    });

    it('matches an exact supported tag', () => {
        const { locale } = pickLocaleFromAcceptLanguage({
            header: 'en',
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(locale).toBe('en');
    });

    it('matches a primary tag when a region tag is present (pt-BR → pt)', () => {
        const { locale } = pickLocaleFromAcceptLanguage({
            header: 'pt-BR,pt;q=0.9',
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(locale).toBe('pt');
    });

    it('respects q-values when ranking candidates', () => {
        // de is preferred (q=1.0 implicit) but not supported; en has q=0.8;
        // es has q=0.5. en wins.
        const { locale } = pickLocaleFromAcceptLanguage({
            header: 'de,en;q=0.8,es;q=0.5',
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(locale).toBe('en');
    });

    it('is case-insensitive when matching tags', () => {
        const { locale } = pickLocaleFromAcceptLanguage({
            header: 'EN-US,EN;q=0.9',
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(locale).toBe('en');
    });

    it('falls back to default when no candidate matches', () => {
        const { locale } = pickLocaleFromAcceptLanguage({
            header: 'de,fr;q=0.9,it;q=0.8',
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(locale).toBe('es');
    });

    it('handles malformed q-values gracefully', () => {
        const { locale } = pickLocaleFromAcceptLanguage({
            header: 'en;q=oops,es;q=0.7',
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        // 'en;q=oops' is dropped (NaN), 'es' survives.
        expect(locale).toBe('es');
    });

    it('handles whitespace inside the header gracefully', () => {
        const { locale } = pickLocaleFromAcceptLanguage({
            header: ' en-US , es ; q=0.5 ',
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(locale).toBe('en');
    });

    it('returns default when the supported list is empty', () => {
        const { locale } = pickLocaleFromAcceptLanguage({
            header: 'en,es',
            supportedLocales: [],
            defaultLocale: DEFAULT
        });
        expect(locale).toBe('es');
    });

    it('returns the first match in declaration order when multiple supported locales match the same q', () => {
        // Both 'es' and 'en' have q=1.0; the first one declared in the header wins.
        const { locale } = pickLocaleFromAcceptLanguage({
            header: 'en,es',
            supportedLocales: SUPPORTED,
            defaultLocale: DEFAULT
        });
        expect(locale).toBe('en');
    });
});
