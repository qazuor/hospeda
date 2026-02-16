/**
 * Tests for useTranslation React hook
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTranslation } from '../../src/hooks/useTranslation';

describe('useTranslation hook', () => {
    describe('basic functionality', () => {
        it('should return t function', () => {
            const { result } = renderHook(() =>
                useTranslation({ locale: 'es', namespace: 'common' })
            );

            expect(result.current).toHaveProperty('t');
            expect(typeof result.current.t).toBe('function');
        });

        it('should translate existing keys', () => {
            const { result } = renderHook(() =>
                useTranslation({ locale: 'es', namespace: 'common' })
            );

            const translation = result.current.t('search');

            expect(translation).toBeDefined();
            expect(typeof translation).toBe('string');
            expect(translation).toBe('Buscar');
        });

        it('should work with different namespaces', () => {
            const { result } = renderHook(() => useTranslation({ locale: 'es', namespace: 'nav' }));

            const translation = result.current.t('home');

            expect(translation).toBeDefined();
            expect(typeof translation).toBe('string');
            expect(translation).toBe('Inicio');
        });
    });

    describe('fallback handling', () => {
        it('should use fallback for missing keys', () => {
            const { result } = renderHook(() =>
                useTranslation({ locale: 'es', namespace: 'common' })
            );

            const translation = result.current.t('nonexistent-key', 'Fallback text');

            expect(translation).toBe('Fallback text');
        });

        it('should show missing indicator for missing keys without fallback in dev', () => {
            const { result } = renderHook(() =>
                useTranslation({ locale: 'es', namespace: 'common' })
            );

            const translation = result.current.t('nonexistent-key');

            // In dev mode, should contain missing indicator
            if (import.meta.env.DEV) {
                expect(translation).toContain('missing');
                expect(translation).toContain('common.nonexistent-key');
            }
        });
    });

    describe('parameter interpolation', () => {
        it('should interpolate single brace parameters', () => {
            const { result } = renderHook(() =>
                useTranslation({ locale: 'es', namespace: 'common' })
            );

            const translation = result.current.t('test', 'Hello {name}', { name: 'Juan' });

            expect(translation).toBe('Hello Juan');
        });

        it('should interpolate double brace parameters', () => {
            const { result } = renderHook(() =>
                useTranslation({ locale: 'es', namespace: 'common' })
            );

            const translation = result.current.t('test', 'Hello {{name}}', { name: 'María' });

            expect(translation).toBe('Hello María');
        });

        it('should interpolate multiple parameters', () => {
            const { result } = renderHook(() =>
                useTranslation({ locale: 'es', namespace: 'common' })
            );

            const translation = result.current.t('test', 'Hello {{firstName}} {{lastName}}', {
                firstName: 'Juan',
                lastName: 'Pérez'
            });

            expect(translation).toBe('Hello Juan Pérez');
        });

        it('should handle number parameters', () => {
            const { result } = renderHook(() =>
                useTranslation({ locale: 'es', namespace: 'common' })
            );

            const translation = result.current.t('test', 'Count: {{count}}', { count: 42 });

            expect(translation).toBe('Count: 42');
        });
    });

    describe('locale support', () => {
        it('should work with English locale', () => {
            const { result } = renderHook(() =>
                useTranslation({ locale: 'en', namespace: 'common' })
            );

            const translation = result.current.t('search');

            expect(translation).toBeDefined();
            expect(typeof translation).toBe('string');
        });

        it('should work with Portuguese locale', () => {
            const { result } = renderHook(() =>
                useTranslation({ locale: 'pt', namespace: 'common' })
            );

            const translation = result.current.t('search');

            expect(translation).toBeDefined();
            expect(typeof translation).toBe('string');
        });

        it('should default to es locale when not provided', () => {
            const { result } = renderHook(() => useTranslation({ namespace: 'common' }));

            const translation = result.current.t('search');

            // Should use Spanish (default locale)
            expect(translation).toBe('Buscar');
        });
    });

    describe('memoization', () => {
        it('should return stable t function for same inputs', () => {
            const { result, rerender } = renderHook(() =>
                useTranslation({ locale: 'es', namespace: 'common' })
            );

            const firstT = result.current.t;

            rerender();

            const secondT = result.current.t;

            // Should be the same reference (memoized)
            expect(firstT).toBe(secondT);
        });

        it('should return new t function when locale changes', () => {
            const { result, rerender } = renderHook(
                ({ locale }: { locale: 'es' | 'en' | 'pt' }) =>
                    useTranslation({ locale, namespace: 'common' }),
                { initialProps: { locale: 'es' } }
            );

            const firstT = result.current.t;

            rerender({ locale: 'en' });

            const secondT = result.current.t;

            // Should be different reference (locale changed)
            expect(firstT).not.toBe(secondT);
        });

        it('should return new t function when namespace changes', () => {
            const { result, rerender } = renderHook(
                ({ namespace }: { namespace: 'common' | 'nav' }) =>
                    useTranslation({ locale: 'es', namespace }),
                { initialProps: { namespace: 'common' } }
            );

            const firstT = result.current.t;

            rerender({ namespace: 'nav' });

            const secondT = result.current.t;

            // Should be different reference (namespace changed)
            expect(firstT).not.toBe(secondT);
        });
    });

    describe('integration with multiple namespaces', () => {
        it('should correctly scope translations to namespace', () => {
            const { result: commonResult } = renderHook(() =>
                useTranslation({ locale: 'es', namespace: 'common' })
            );

            const { result: navResult } = renderHook(() =>
                useTranslation({ locale: 'es', namespace: 'nav' })
            );

            const commonSearch = commonResult.current.t('search');
            const navHome = navResult.current.t('home');

            expect(commonSearch).toBe('Buscar');
            expect(navHome).toBe('Inicio');
        });

        it('should not cross-contaminate between namespaces', () => {
            const { result } = renderHook(() =>
                useTranslation({ locale: 'es', namespace: 'common' })
            );

            // 'home' exists in nav namespace but not in common
            const translation = result.current.t('home', 'Fallback');

            // Should use fallback since 'home' is not in common namespace
            expect(translation).toBe('Fallback');
        });
    });
});
