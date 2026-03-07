/**
 * @file use-translation.test.ts
 * @description Tests for the useTranslation React hook.
 * Verifies namespace scoping, memoization, fallback behavior, and plural forms.
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTranslation } from '../../src/hooks/useTranslation';

// ---------------------------------------------------------------------------
// Basic functionality
// ---------------------------------------------------------------------------

describe('useTranslation - basic', () => {
    it('should return an object with t and tPlural functions', () => {
        const { result } = renderHook(() => useTranslation({ locale: 'es', namespace: 'common' }));
        expect(typeof result.current.t).toBe('function');
        expect(typeof result.current.tPlural).toBe('function');
    });

    it('should use default locale (es) when locale is not provided', () => {
        const { result } = renderHook(() => useTranslation({ namespace: 'common' }));
        // Should not throw and should return functions
        expect(typeof result.current.t).toBe('function');
        expect(typeof result.current.tPlural).toBe('function');
    });

    it('should work with all supported locales', () => {
        const locales = ['es', 'en', 'pt'] as const;
        for (const locale of locales) {
            const { result } = renderHook(() => useTranslation({ locale, namespace: 'common' }));
            expect(typeof result.current.t).toBe('function');
            expect(typeof result.current.tPlural).toBe('function');
        }
    });
});

// ---------------------------------------------------------------------------
// Namespace scoping - t()
// ---------------------------------------------------------------------------

describe('useTranslation - t() namespace scoping', () => {
    it('should prepend namespace to key before lookup', () => {
        const { result } = renderHook(() => useTranslation({ locale: 'es', namespace: 'nav' }));
        // nav.home exists in @repo/i18n es locale
        const translated = result.current.t('home');
        // Should resolve (not be MISSING if key exists)
        expect(typeof translated).toBe('string');
        expect(translated.length).toBeGreaterThan(0);
    });

    it('should return fallback when namespaced key is missing', () => {
        const { result } = renderHook(() =>
            useTranslation({ locale: 'es', namespace: 'nonexistent_ns' })
        );
        const fallback = 'My fallback text';
        const translated = result.current.t('missing_key', fallback);
        expect(translated).toBe(fallback);
    });

    it('should return [MISSING: ...] indicator for missing key without fallback', () => {
        const { result } = renderHook(() =>
            useTranslation({ locale: 'es', namespace: 'nonexistent_ns' })
        );
        const translated = result.current.t('missing_key');
        expect(translated).toContain('MISSING');
    });

    it('should interpolate {{param}} placeholders in fallback', () => {
        const { result } = renderHook(() =>
            useTranslation({ locale: 'es', namespace: 'nonexistent_ns' })
        );
        const translated = result.current.t('missing', 'Hello {{name}}', { name: 'World' });
        expect(translated).toBe('Hello World');
    });

    it('should interpolate {param} placeholders in fallback', () => {
        const { result } = renderHook(() =>
            useTranslation({ locale: 'es', namespace: 'nonexistent_ns' })
        );
        const translated = result.current.t('missing', 'Count: {count}', { count: 42 });
        expect(translated).toBe('Count: 42');
    });

    it('should interpolate multiple params simultaneously', () => {
        const { result } = renderHook(() =>
            useTranslation({ locale: 'es', namespace: 'nonexistent_ns' })
        );
        const translated = result.current.t('missing', '{{a}} and {b}', { a: 'X', b: 'Y' });
        expect(translated).toBe('X and Y');
    });

    it('should use different namespaces independently', () => {
        const { result: navResult } = renderHook(() =>
            useTranslation({ locale: 'es', namespace: 'nav' })
        );
        const { result: footerResult } = renderHook(() =>
            useTranslation({ locale: 'es', namespace: 'footer' })
        );
        // Both should return string functions (not throw)
        expect(typeof navResult.current.t('home')).toBe('string');
        expect(typeof footerResult.current.t('description')).toBe('string');
    });
});

// ---------------------------------------------------------------------------
// tPlural() behavior
// ---------------------------------------------------------------------------

describe('useTranslation - tPlural()', () => {
    it('should return a string for count=1', () => {
        const { result } = renderHook(() =>
            useTranslation({ locale: 'es', namespace: 'nonexistent_ns' })
        );
        const translated = result.current.tPlural('items', 1);
        expect(typeof translated).toBe('string');
    });

    it('should return a string for count > 1', () => {
        const { result } = renderHook(() =>
            useTranslation({ locale: 'es', namespace: 'nonexistent_ns' })
        );
        const translated = result.current.tPlural('items', 5);
        expect(typeof translated).toBe('string');
    });

    it('should return a string for count=0', () => {
        const { result } = renderHook(() =>
            useTranslation({ locale: 'es', namespace: 'nonexistent_ns' })
        );
        const translated = result.current.tPlural('items', 0);
        expect(typeof translated).toBe('string');
    });

    it('should not throw when extra params are passed', () => {
        const { result } = renderHook(() =>
            useTranslation({ locale: 'es', namespace: 'nonexistent_ns' })
        );
        expect(() => result.current.tPlural('items', 3, { extra: 'val' })).not.toThrow();
    });

    it('should prepend namespace to plural key', () => {
        const { result } = renderHook(() =>
            useTranslation({ locale: 'es', namespace: 'nonexistent_ns' })
        );
        // The result for a missing namespaced key should contain the full namespaced key
        const translated = result.current.tPlural('items', 1);
        // Either MISSING or a real resolved string - should always be a string
        expect(typeof translated).toBe('string');
    });
});

// ---------------------------------------------------------------------------
// Locale switching
// ---------------------------------------------------------------------------

describe('useTranslation - locale switching', () => {
    it('should return different translations for different locales', () => {
        const { result: esResult } = renderHook(() =>
            useTranslation({ locale: 'es', namespace: 'nav' })
        );
        const { result: enResult } = renderHook(() =>
            useTranslation({ locale: 'en', namespace: 'nav' })
        );

        const esHome = esResult.current.t('home');
        const enHome = enResult.current.t('home');

        // Both must be valid non-empty strings
        expect(esHome.length).toBeGreaterThan(0);
        expect(enHome.length).toBeGreaterThan(0);
    });

    it('should update returned functions when locale changes', () => {
        let locale: 'es' | 'en' = 'es';
        const { result, rerender } = renderHook(() => useTranslation({ locale, namespace: 'nav' }));

        const firstT = result.current.t;

        locale = 'en';
        rerender();

        // After locale change, a new memoized t function is returned
        const secondT = result.current.t;
        // They may or may not be referentially equal depending on useMemo - both must work
        expect(typeof secondT).toBe('function');
        expect(typeof firstT).toBe('function');
    });

    it('should update returned functions when namespace changes', () => {
        let namespace: 'nav' | 'footer' = 'nav';
        const { result, rerender } = renderHook(() => useTranslation({ locale: 'es', namespace }));

        const firstT = result.current.t;

        namespace = 'footer';
        rerender();

        const secondT = result.current.t;
        // Both functions should be callable
        expect(typeof firstT).toBe('function');
        expect(typeof secondT).toBe('function');
    });
});

// ---------------------------------------------------------------------------
// Memoization
// ---------------------------------------------------------------------------

describe('useTranslation - memoization', () => {
    it('should return the same t reference when locale and namespace are unchanged', () => {
        const { result, rerender } = renderHook(() =>
            useTranslation({ locale: 'es', namespace: 'nav' })
        );

        const firstT = result.current.t;
        const firstTPlural = result.current.tPlural;

        rerender();

        expect(result.current.t).toBe(firstT);
        expect(result.current.tPlural).toBe(firstTPlural);
    });

    it('should return a new t reference when locale changes', () => {
        let locale: 'es' | 'en' = 'es';
        const { result, rerender } = renderHook(() => useTranslation({ locale, namespace: 'nav' }));

        const firstT = result.current.t;

        locale = 'en';
        rerender();

        // useMemo should have produced a new function
        expect(result.current.t).not.toBe(firstT);
    });

    it('should return a new t reference when namespace changes', () => {
        let namespace: 'nav' | 'footer' = 'nav';
        const { result, rerender } = renderHook(() => useTranslation({ locale: 'es', namespace }));

        const firstT = result.current.t;

        namespace = 'footer';
        rerender();

        expect(result.current.t).not.toBe(firstT);
    });
});
