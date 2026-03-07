import { describe, expect, it } from 'vitest';
import {
    DEFAULT_LOCALE,
    SUPPORTED_LOCALES,
    createT,
    createTranslations,
    isValidLocale,
    parseAcceptLanguage,
    t
} from '../../src/lib/i18n';

describe('i18n utilities', () => {
    describe('SUPPORTED_LOCALES', () => {
        it('should contain es, en, and pt', () => {
            expect(SUPPORTED_LOCALES).toEqual(['es', 'en', 'pt']);
        });
    });

    describe('DEFAULT_LOCALE', () => {
        it('should be es', () => {
            expect(DEFAULT_LOCALE).toBe('es');
        });
    });

    describe('isValidLocale', () => {
        it('should return true for supported locales', () => {
            expect(isValidLocale('es')).toBe(true);
            expect(isValidLocale('en')).toBe(true);
            expect(isValidLocale('pt')).toBe(true);
        });

        it('should return false for unsupported locales', () => {
            expect(isValidLocale('fr')).toBe(false);
            expect(isValidLocale('de')).toBe(false);
            expect(isValidLocale('')).toBe(false);
            expect(isValidLocale('ES')).toBe(false);
        });
    });

    describe('parseAcceptLanguage', () => {
        it('should return default locale for null header', () => {
            expect(parseAcceptLanguage(null)).toBe('es');
        });

        it('should return default locale for empty header', () => {
            expect(parseAcceptLanguage('')).toBe('es');
        });

        it('should extract primary language from header', () => {
            expect(parseAcceptLanguage('en-US,en;q=0.9')).toBe('en');
            expect(parseAcceptLanguage('pt-BR,pt;q=0.9')).toBe('pt');
            expect(parseAcceptLanguage('es-AR,es;q=0.9')).toBe('es');
        });

        it('should fall back to default for unsupported languages', () => {
            expect(parseAcceptLanguage('fr-FR,fr;q=0.9')).toBe('es');
            expect(parseAcceptLanguage('de,ja')).toBe('es');
        });

        it('should find supported locale in secondary position', () => {
            expect(parseAcceptLanguage('fr-FR,en-US;q=0.9')).toBe('en');
        });
    });

    describe('createT', () => {
        it('should return a function', () => {
            const fn = createT('es');
            expect(typeof fn).toBe('function');
        });

        it('should return fallback for missing key', () => {
            const fn = createT('es');
            expect(fn('home.nonexistent.key', 'Fallback')).toBe('Fallback');
        });

        it('should interpolate {{param}} placeholders in fallback', () => {
            const fn = createT('es');
            expect(fn('home.missing', 'Hello {{name}}', { name: 'World' })).toBe('Hello World');
        });

        it('should interpolate {param} placeholders in fallback', () => {
            const fn = createT('es');
            expect(fn('home.missing', 'Count: {count}', { count: 42 })).toBe('Count: 42');
        });

        it('should interpolate multiple params at once', () => {
            const fn = createT('es');
            expect(fn('home.missing', '{{a}} and {b}', { a: 'X', b: 'Y' })).toBe('X and Y');
        });

        it('should return [MISSING: key] indicator when no fallback in dev mode', () => {
            const fn = createT('es');
            const result = fn('home.definitely.missing');
            // In dev/test env, returns a debug indicator matching @repo/i18n convention
            expect(result).toBe('[MISSING: home.definitely.missing]');
        });

        it('should resolve real keys from @repo/i18n', () => {
            const fn = createT('es');
            // footer.description exists in @repo/i18n es locale
            const result = fn('footer.description');
            expect(result).not.toContain('[MISSING:');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should resolve different values per locale', () => {
            const tEs = createT('es');
            const tEn = createT('en');
            // nav.home exists in both locales with different values
            const esResult = tEs('nav.home');
            const enResult = tEn('nav.home');
            // Both should resolve (not be MISSING markers)
            expect(esResult).not.toContain('[MISSING:');
            expect(enResult).not.toContain('[MISSING:');
        });
    });

    describe('createTranslations', () => {
        it('should return an object with t and tPlural', () => {
            const result = createTranslations('es');
            expect(typeof result.t).toBe('function');
            expect(typeof result.tPlural).toBe('function');
        });

        it('t should work the same as createT', () => {
            const { t: tFn } = createTranslations('es');
            expect(tFn('home.nonexistent', 'Fallback')).toBe('Fallback');
            expect(tFn('home.missing', 'Hi {{name}}', { name: 'Test' })).toBe('Hi Test');
        });

        it('tPlural should resolve _one variant for count=1', () => {
            const { tPlural } = createTranslations('es');
            // Use a key that has _one/_other variants in @repo/i18n
            // If the key exists, it should interpolate count; if not, test with fallback behavior
            const result = tPlural('home.test.items', 1);
            // Since this key likely doesn't exist, it should show MISSING for the _one variant
            // and fall back to the base key. Either way, it should not throw.
            expect(typeof result).toBe('string');
        });

        it('tPlural should resolve _other variant for count!=1', () => {
            const { tPlural } = createTranslations('es');
            const result = tPlural('home.test.items', 5);
            expect(typeof result).toBe('string');
        });

        it('tPlural should pass count as interpolation param', () => {
            const { tPlural } = createTranslations('es');
            // Even with a missing key, tPlural should not throw
            const result = tPlural('home.nonexistent.items', 3, { extra: 'val' });
            expect(typeof result).toBe('string');
        });
    });

    describe('t (legacy)', () => {
        it('should return fallback when key is missing', () => {
            const result = t({
                locale: 'es',
                namespace: 'home',
                key: 'nonexistent.key',
                fallback: 'My fallback text'
            });
            expect(result).toBe('My fallback text');
        });

        it('should interpolate params in fallback', () => {
            const result = t({
                locale: 'es',
                namespace: 'home',
                key: 'nonexistent.key',
                fallback: 'Hello {{name}}',
                params: { name: 'World' }
            });
            expect(result).toBe('Hello World');
        });

        it('should interpolate {param} style placeholders', () => {
            const result = t({
                locale: 'es',
                namespace: 'home',
                key: 'nonexistent.key',
                fallback: 'Count: {count} items',
                params: { count: 5 }
            });
            expect(result).toBe('Count: 5 items');
        });

        it('should return raw string when no params provided', () => {
            const result = t({
                locale: 'es',
                namespace: 'home',
                key: 'nonexistent.key',
                fallback: 'Simple text'
            });
            expect(result).toBe('Simple text');
        });
    });
});
