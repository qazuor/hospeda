import {
    DEFAULT_LOCALE,
    HOME_BREADCRUMB,
    SUPPORTED_LOCALES,
    getLocaleFromParams,
    getStaticLocalePaths,
    isValidLocale
} from '@/lib/page-helpers';
/**
 * Tests for page-helpers.ts - Shared page-level helpers.
 */
import { describe, expect, it } from 'vitest';

describe('getLocaleFromParams', () => {
    describe('valid locales', () => {
        it('should return "es" for lang = "es"', () => {
            expect(getLocaleFromParams({ lang: 'es' })).toBe('es');
        });

        it('should return "en" for lang = "en"', () => {
            expect(getLocaleFromParams({ lang: 'en' })).toBe('en');
        });

        it('should return "pt" for lang = "pt"', () => {
            expect(getLocaleFromParams({ lang: 'pt' })).toBe('pt');
        });
    });

    describe('invalid locales', () => {
        it('should return null when lang is undefined', () => {
            expect(getLocaleFromParams({ lang: undefined })).toBeNull();
        });

        it('should return null for unsupported locale code', () => {
            expect(getLocaleFromParams({ lang: 'fr' })).toBeNull();
        });

        it('should return null for empty string', () => {
            expect(getLocaleFromParams({ lang: '' })).toBeNull();
        });

        it('should return null for mixed case (not in supported list)', () => {
            expect(getLocaleFromParams({ lang: 'ES' })).toBeNull();
        });
    });
});

describe('HOME_BREADCRUMB', () => {
    it('should have entries for all supported locales', () => {
        const locales = ['es', 'en', 'pt'] as const;
        for (const locale of locales) {
            expect(HOME_BREADCRUMB[locale]).toBeDefined();
            expect(typeof HOME_BREADCRUMB[locale]).toBe('string');
            expect(HOME_BREADCRUMB[locale].length).toBeGreaterThan(0);
        }
    });

    it('should have "Inicio" for es', () => {
        expect(HOME_BREADCRUMB.es).toBe('Inicio');
    });

    it('should have "Home" for en', () => {
        expect(HOME_BREADCRUMB.en).toBe('Home');
    });

    it('should have "Inicio" for pt', () => {
        expect(HOME_BREADCRUMB.pt).toBe('Inicio');
    });
});

describe('getStaticLocalePaths', () => {
    it('should return an array of path objects', () => {
        const paths = getStaticLocalePaths();
        expect(Array.isArray(paths)).toBe(true);
        expect(paths.length).toBeGreaterThan(0);
    });

    it('should return one path per supported locale', () => {
        const paths = getStaticLocalePaths();
        expect(paths.length).toBe(SUPPORTED_LOCALES.length);
    });

    it('should include es, en, pt in the params', () => {
        const paths = getStaticLocalePaths();
        const langs = paths.map((p) => p.params.lang);
        expect(langs).toContain('es');
        expect(langs).toContain('en');
        expect(langs).toContain('pt');
    });

    it('should have the correct shape { params: { lang } }', () => {
        const paths = getStaticLocalePaths();
        for (const path of paths) {
            expect(path).toHaveProperty('params');
            expect(path.params).toHaveProperty('lang');
            expect(typeof path.params.lang).toBe('string');
        }
    });
});

describe('re-exported SUPPORTED_LOCALES', () => {
    it('should include es, en, pt', () => {
        expect(SUPPORTED_LOCALES).toContain('es');
        expect(SUPPORTED_LOCALES).toContain('en');
        expect(SUPPORTED_LOCALES).toContain('pt');
    });
});

describe('re-exported DEFAULT_LOCALE', () => {
    it('should be "es"', () => {
        expect(DEFAULT_LOCALE).toBe('es');
    });
});

describe('re-exported isValidLocale', () => {
    it('should return true for supported locales', () => {
        expect(isValidLocale('es')).toBe(true);
        expect(isValidLocale('en')).toBe(true);
        expect(isValidLocale('pt')).toBe(true);
    });

    it('should return false for unsupported locales', () => {
        expect(isValidLocale('fr')).toBe(false);
        expect(isValidLocale('')).toBe(false);
    });
});
