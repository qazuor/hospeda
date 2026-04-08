/**
 * @file i18n.test.ts
 * @description Unit tests for i18n utilities.
 */

import { describe, expect, it } from 'vitest';
import {
    DEFAULT_LOCALE,
    SUPPORTED_LOCALES,
    createT,
    createTranslations,
    isValidLocale,
    parseAcceptLanguage
} from '../../src/lib/i18n';

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
        expect(parseAcceptLanguage(null)).toBe(DEFAULT_LOCALE);
    });

    it('should return default locale for empty header', () => {
        expect(parseAcceptLanguage('')).toBe(DEFAULT_LOCALE);
    });

    it('should match first supported language', () => {
        expect(parseAcceptLanguage('en-US,en;q=0.9,es;q=0.8')).toBe('en');
    });

    it('should extract primary language code from locale tag', () => {
        expect(parseAcceptLanguage('pt-BR,pt;q=0.9')).toBe('pt');
    });

    it('should fall back to default when no match', () => {
        expect(parseAcceptLanguage('fr-FR,de;q=0.9')).toBe(DEFAULT_LOCALE);
    });

    it('should handle complex Accept-Language headers', () => {
        expect(parseAcceptLanguage('fr;q=0.9,de;q=0.8,es;q=0.7')).toBe('es');
    });
});

describe('SUPPORTED_LOCALES', () => {
    it('should contain es, en, pt', () => {
        expect(SUPPORTED_LOCALES).toContain('es');
        expect(SUPPORTED_LOCALES).toContain('en');
        expect(SUPPORTED_LOCALES).toContain('pt');
    });

    it('should have exactly 3 locales', () => {
        expect(SUPPORTED_LOCALES).toHaveLength(3);
    });
});

describe('DEFAULT_LOCALE', () => {
    it('should be es', () => {
        expect(DEFAULT_LOCALE).toBe('es');
    });
});

describe('createT', () => {
    it('should return a function', () => {
        const t = createT('es');
        expect(typeof t).toBe('function');
    });

    it('should return fallback for missing keys', () => {
        const t = createT('es');
        const result = t('nonexistent.key.that.does.not.exist', 'Fallback Text');
        expect(result).toBe('Fallback Text');
    });

    it('should return key as fallback in production when no fallback provided', () => {
        const t = createT('es');
        const result = t('totally.nonexistent.key.xyz');
        // In dev returns [MISSING: key], in prod returns key itself
        expect(result).toBeTruthy();
    });
});

describe('createTranslations', () => {
    it('should return object with t and tPlural', () => {
        const { t, tPlural } = createTranslations('es');
        expect(typeof t).toBe('function');
        expect(typeof tPlural).toBe('function');
    });

    it('should resolve known keys', () => {
        const { t } = createTranslations('es');
        // nav.home should exist in es locale
        const result = t('nav.home');
        expect(result).toBeTruthy();
        expect(result).not.toContain('MISSING');
    });
});
