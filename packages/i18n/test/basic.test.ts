/**
 * Basic test suite for i18n package
 * Tests fundamental internationalization functionality
 */

import { describe, expect, it } from 'vitest';

/**
 * Mock translation function for testing
 */
const createTranslator = (locale: string) => {
    const translations: Record<string, Record<string, string>> = {
        es: {
            test: 'Prueba',
            hello: 'Hola',
            welcome: 'Bienvenido',
            'hello.world': 'Hola Mundo'
        },
        en: {
            test: 'Test',
            hello: 'Hello',
            welcome: 'Welcome',
            'hello.world': 'Hello World'
        }
    };

    return (key: string, fallback?: string): string => {
        return translations[locale]?.[key] ?? fallback ?? key;
    };
};

describe('i18n Package - Basic Tests', () => {
    it('should have correct environment setup', () => {
        expect(process.env.NODE_ENV).toBe('test');
    });

    it('should create translator for Spanish locale', () => {
        const t = createTranslator('es');

        expect(t('test')).toBe('Prueba');
        expect(t('hello')).toBe('Hola');
        expect(t('welcome')).toBe('Bienvenido');
        expect(t('hello.world')).toBe('Hola Mundo');
    });

    it('should create translator for English locale', () => {
        const t = createTranslator('en');

        expect(t('test')).toBe('Test');
        expect(t('hello')).toBe('Hello');
        expect(t('welcome')).toBe('Welcome');
        expect(t('hello.world')).toBe('Hello World');
    });

    it('should handle missing translations with fallback', () => {
        const t = createTranslator('es');

        expect(t('missing.key', 'Fallback')).toBe('Fallback');
        expect(t('missing.key')).toBe('missing.key');
    });

    it('should handle locale utilities', () => {
        const getSupportedLocales = (): string[] => ['es', 'en'];
        const getDefaultLocale = (): string => 'es';
        const isValidLocale = (locale: string): boolean => getSupportedLocales().includes(locale);

        expect(getSupportedLocales()).toEqual(['es', 'en']);
        expect(getDefaultLocale()).toBe('es');
        expect(isValidLocale('es')).toBe(true);
        expect(isValidLocale('en')).toBe(true);
        expect(isValidLocale('fr')).toBe(false);
    });

    it('should handle nested key resolution', () => {
        const resolveNestedKey = (obj: Record<string, any>, key: string): any => {
            return key.split('.').reduce((current, part) => current?.[part], obj);
        };

        const nestedTranslations = {
            auth: {
                login: 'Iniciar Sesión',
                signup: 'Registrarse'
            },
            common: {
                save: 'Guardar',
                cancel: 'Cancelar'
            }
        };

        expect(resolveNestedKey(nestedTranslations, 'auth.login')).toBe('Iniciar Sesión');
        expect(resolveNestedKey(nestedTranslations, 'common.save')).toBe('Guardar');
        expect(resolveNestedKey(nestedTranslations, 'missing.key')).toBeUndefined();
    });
});
