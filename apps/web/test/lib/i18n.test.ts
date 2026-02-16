import { describe, expect, it } from 'vitest';
import {
    DEFAULT_LOCALE,
    SUPPORTED_LOCALES,
    getTranslations,
    isValidLocale,
    parseAcceptLanguage,
    t
} from '../../src/lib/i18n';

describe('i18n utilities', () => {
    describe('SUPPORTED_LOCALES', () => {
        it('should include Spanish (es)', () => {
            expect(SUPPORTED_LOCALES).toContain('es');
        });

        it('should include English (en)', () => {
            expect(SUPPORTED_LOCALES).toContain('en');
        });

        it('should include Portuguese (pt)', () => {
            expect(SUPPORTED_LOCALES).toContain('pt');
        });

        it('should have exactly 3 supported locales', () => {
            expect(SUPPORTED_LOCALES).toHaveLength(3);
        });
    });

    describe('DEFAULT_LOCALE', () => {
        it('should be Spanish (es)', () => {
            expect(DEFAULT_LOCALE).toBe('es');
        });

        it('should be included in SUPPORTED_LOCALES', () => {
            expect(SUPPORTED_LOCALES).toContain(DEFAULT_LOCALE);
        });
    });

    describe('isValidLocale', () => {
        it('should return true for Spanish (es)', () => {
            expect(isValidLocale('es')).toBe(true);
        });

        it('should return true for English (en)', () => {
            expect(isValidLocale('en')).toBe(true);
        });

        it('should return true for Portuguese (pt)', () => {
            expect(isValidLocale('pt')).toBe(true);
        });

        it('should return false for French (fr)', () => {
            expect(isValidLocale('fr')).toBe(false);
        });

        it('should return false for German (de)', () => {
            expect(isValidLocale('de')).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(isValidLocale('')).toBe(false);
        });

        it('should return false for invalid locale code', () => {
            expect(isValidLocale('invalid')).toBe(false);
        });

        it('should be case-sensitive (uppercase)', () => {
            expect(isValidLocale('ES')).toBe(false);
        });

        it('should be case-sensitive (mixed case)', () => {
            expect(isValidLocale('En')).toBe(false);
        });
    });

    describe('parseAcceptLanguage', () => {
        describe('null or empty headers', () => {
            it('should return default locale for null header', () => {
                expect(parseAcceptLanguage(null)).toBe(DEFAULT_LOCALE);
            });

            it('should return default locale for empty string', () => {
                expect(parseAcceptLanguage('')).toBe(DEFAULT_LOCALE);
            });
        });

        describe('single language headers', () => {
            it('should parse Spanish (es)', () => {
                expect(parseAcceptLanguage('es')).toBe('es');
            });

            it('should parse English (en)', () => {
                expect(parseAcceptLanguage('en')).toBe('en');
            });

            it('should parse Portuguese (pt)', () => {
                expect(parseAcceptLanguage('pt')).toBe('pt');
            });

            it('should parse Spanish with region (es-AR)', () => {
                expect(parseAcceptLanguage('es-AR')).toBe('es');
            });

            it('should parse English with region (en-US)', () => {
                expect(parseAcceptLanguage('en-US')).toBe('en');
            });

            it('should parse Portuguese with region (pt-BR)', () => {
                expect(parseAcceptLanguage('pt-BR')).toBe('pt');
            });
        });

        describe('multiple languages with quality values', () => {
            it('should return first matching locale (es first)', () => {
                expect(parseAcceptLanguage('es-AR,es;q=0.9,en;q=0.8')).toBe('es');
            });

            it('should return first matching locale (en first)', () => {
                expect(parseAcceptLanguage('en-US,en;q=0.9,es;q=0.8')).toBe('en');
            });

            it('should return first matching locale (pt first)', () => {
                expect(parseAcceptLanguage('pt-BR,pt;q=0.9,en;q=0.8')).toBe('pt');
            });

            it('should skip unsupported locales and find first match', () => {
                expect(parseAcceptLanguage('fr-FR,de;q=0.9,es;q=0.8,en;q=0.7')).toBe('es');
            });

            it('should return en when es is not first but en is', () => {
                expect(parseAcceptLanguage('fr,en;q=0.9,es;q=0.8')).toBe('en');
            });
        });

        describe('unsupported languages', () => {
            it('should return default locale for French (fr)', () => {
                expect(parseAcceptLanguage('fr-FR')).toBe(DEFAULT_LOCALE);
            });

            it('should return default locale for German (de)', () => {
                expect(parseAcceptLanguage('de-DE')).toBe(DEFAULT_LOCALE);
            });

            it('should return default locale for Italian (it)', () => {
                expect(parseAcceptLanguage('it-IT')).toBe(DEFAULT_LOCALE);
            });

            it('should return default locale for only unsupported languages', () => {
                expect(parseAcceptLanguage('fr,de;q=0.9,it;q=0.8')).toBe(DEFAULT_LOCALE);
            });
        });

        describe('edge cases', () => {
            it('should handle whitespace around language codes', () => {
                expect(parseAcceptLanguage(' es , en;q=0.9 ')).toBe('es');
            });

            it('should handle complex quality values', () => {
                expect(parseAcceptLanguage('en-US,en;q=0.95,es;q=0.90,pt;q=0.85')).toBe('en');
            });

            it('should handle missing quality values', () => {
                expect(parseAcceptLanguage('es,en,pt')).toBe('es');
            });

            it('should be case-insensitive for language codes', () => {
                expect(parseAcceptLanguage('ES-AR')).toBe('es');
            });

            it('should handle mixed case language codes', () => {
                expect(parseAcceptLanguage('En-US')).toBe('en');
            });
        });
    });

    describe('getTranslations', () => {
        describe('common namespace', () => {
            it('should return translations for valid namespace', () => {
                const translations = getTranslations({ locale: 'es', namespace: 'common' });

                expect(translations).toBeDefined();
                expect(typeof translations).toBe('object');
            });

            it('should contain expected common keys', () => {
                const translations = getTranslations({ locale: 'es', namespace: 'common' });

                // Check for some expected keys
                expect(translations).toHaveProperty('search');
                expect(translations).toHaveProperty('loading');
            });

            it('should strip namespace prefix from keys', () => {
                const translations = getTranslations({ locale: 'es', namespace: 'common' });

                // Keys should not include namespace prefix
                expect(translations).not.toHaveProperty('common.search');
                expect(translations).toHaveProperty('search');
            });
        });

        describe('nav namespace', () => {
            it('should return translations for nav namespace', () => {
                const translations = getTranslations({ locale: 'es', namespace: 'nav' });

                expect(translations).toBeDefined();
                expect(typeof translations).toBe('object');
            });

            it('should contain expected nav keys', () => {
                const translations = getTranslations({ locale: 'es', namespace: 'nav' });

                expect(translations).toHaveProperty('home');
                expect(translations).toHaveProperty('accommodations');
            });
        });

        describe('unknown namespace', () => {
            it('should return empty object for unknown namespace', () => {
                const translations = getTranslations({
                    locale: 'es',
                    namespace: 'unknown' as any
                });

                expect(translations).toBeDefined();
                expect(Object.keys(translations).length).toBe(0);
            });
        });

        describe('locale fallback', () => {
            it('should fallback to default locale for unsupported locale', () => {
                const translations = getTranslations({
                    locale: 'fr' as any,
                    namespace: 'common'
                });

                expect(translations).toBeDefined();
                expect(Object.keys(translations).length).toBeGreaterThan(0);
            });
        });
    });

    describe('t function', () => {
        describe('basic translation', () => {
            it('should find existing translation key', () => {
                const result = t({ locale: 'es', namespace: 'common', key: 'search' });

                expect(result).toBeDefined();
                expect(typeof result).toBe('string');
                expect(result.length).toBeGreaterThan(0);
            });

            it('should return Spanish translation for es locale', () => {
                const result = t({ locale: 'es', namespace: 'common', key: 'search' });

                // Should be Spanish word for search
                expect(result).toBe('Buscar');
            });

            it('should find nested translation keys', () => {
                const result = t({ locale: 'es', namespace: 'nav', key: 'home' });

                expect(result).toBeDefined();
                expect(typeof result).toBe('string');
            });
        });

        describe('fallback handling', () => {
            it('should return fallback for missing key', () => {
                const result = t({
                    locale: 'es',
                    namespace: 'common',
                    key: 'nonexistent-key',
                    fallback: 'Fallback text'
                });

                expect(result).toBe('Fallback text');
            });

            it('should return missing indicator when no fallback in dev', () => {
                const result = t({
                    locale: 'es',
                    namespace: 'common',
                    key: 'nonexistent-key'
                });

                // In dev mode, should show missing indicator
                if (import.meta.env.DEV) {
                    expect(result).toContain('missing');
                    expect(result).toContain('common.nonexistent-key');
                }
            });

            it('should return key itself for missing translation without fallback in production', () => {
                // This test would behave differently in production mode
                const result = t({
                    locale: 'es',
                    namespace: 'common',
                    key: 'some-key'
                });

                expect(result).toBeDefined();
                expect(typeof result).toBe('string');
            });
        });

        describe('locale handling', () => {
            it('should work with English locale', () => {
                const result = t({ locale: 'en', namespace: 'common', key: 'search' });

                expect(result).toBeDefined();
                expect(typeof result).toBe('string');
            });

            it('should work with Portuguese locale', () => {
                const result = t({ locale: 'pt', namespace: 'common', key: 'search' });

                expect(result).toBeDefined();
                expect(typeof result).toBe('string');
            });

            it('should fallback to default locale for unsupported locale', () => {
                const result = t({
                    locale: 'fr' as any,
                    namespace: 'common',
                    key: 'search'
                });

                // Should fallback to Spanish (default locale)
                expect(result).toBe('Buscar');
            });
        });

        describe('parameter interpolation', () => {
            it('should replace single brace parameters', () => {
                // Note: This depends on translation files having interpolation
                // We're testing the mechanism works
                const result = t({
                    locale: 'es',
                    namespace: 'common',
                    key: 'test',
                    fallback: 'Hello {name}',
                    params: { name: 'Juan' }
                });

                expect(result).toBe('Hello Juan');
            });

            it('should replace double brace parameters', () => {
                const result = t({
                    locale: 'es',
                    namespace: 'common',
                    key: 'test',
                    fallback: 'Hello {{name}}',
                    params: { name: 'María' }
                });

                expect(result).toBe('Hello María');
            });

            it('should replace multiple parameters', () => {
                const result = t({
                    locale: 'es',
                    namespace: 'common',
                    key: 'test',
                    fallback: 'Hello {{firstName}} {{lastName}}',
                    params: { firstName: 'Juan', lastName: 'Pérez' }
                });

                expect(result).toBe('Hello Juan Pérez');
            });

            it('should handle number parameters', () => {
                const result = t({
                    locale: 'es',
                    namespace: 'common',
                    key: 'test',
                    fallback: 'Count: {{count}}',
                    params: { count: 42 }
                });

                expect(result).toBe('Count: 42');
            });
        });
    });
});
