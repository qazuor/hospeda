/**
 * @file urls.test.ts
 * @description Unit tests for URL builder utilities.
 */

import { describe, expect, it } from 'vitest';
import { buildLocaleSwitchPathname, buildUrl, buildUrlWithParams } from '../../src/lib/urls';

describe('buildUrl', () => {
    it('should prefix path with locale and ensure trailing slash', () => {
        expect(buildUrl({ locale: 'es', path: 'alojamientos' })).toBe('/es/alojamientos/');
    });

    it('should handle path with leading slash', () => {
        expect(buildUrl({ locale: 'en', path: '/destinos' })).toBe('/en/destinos/');
    });

    it('should handle path with trailing slash', () => {
        expect(buildUrl({ locale: 'pt', path: 'eventos/' })).toBe('/pt/eventos/');
    });

    it('should handle path with both slashes', () => {
        expect(buildUrl({ locale: 'es', path: '/contacto/' })).toBe('/es/contacto/');
    });

    it('should return locale root when path is empty', () => {
        const result = buildUrl({ locale: 'es' });
        expect(result).toMatch(/^\/es\//);
    });

    it('should handle nested paths', () => {
        expect(buildUrl({ locale: 'es', path: 'mi-cuenta/editar' })).toBe('/es/mi-cuenta/editar/');
    });

    it('should handle root path', () => {
        const result = buildUrl({ locale: 'en', path: '/' });
        expect(result).toMatch(/^\/en\//);
    });
});

describe('buildUrlWithParams', () => {
    it('should append query parameters', () => {
        const result = buildUrlWithParams({
            locale: 'es',
            path: 'busqueda',
            params: { q: 'hotel' }
        });
        expect(result).toBe('/es/busqueda/?q=hotel');
    });

    it('should handle multiple parameters', () => {
        const result = buildUrlWithParams({
            locale: 'es',
            path: 'busqueda',
            params: { q: 'hotel', page: '2' }
        });
        expect(result).toContain('/es/busqueda/?');
        expect(result).toContain('q=hotel');
        expect(result).toContain('page=2');
    });

    it('should return URL without query string when params are empty', () => {
        const result = buildUrlWithParams({
            locale: 'es',
            path: 'destinos',
            params: {}
        });
        expect(result).toBe('/es/destinos/');
    });
});

describe('buildLocaleSwitchPathname', () => {
    it('swaps the leading locale segment, preserving the rest of the path', () => {
        expect(buildLocaleSwitchPathname({ pathname: '/es/mi-cuenta/', locale: 'en' })).toBe(
            '/en/mi-cuenta/'
        );
    });

    it('switches at the locale root', () => {
        expect(buildLocaleSwitchPathname({ pathname: '/es/', locale: 'en' })).toBe('/en/');
    });

    it('handles nested paths', () => {
        expect(buildLocaleSwitchPathname({ pathname: '/es/mi-cuenta/editar/', locale: 'pt' })).toBe(
            '/pt/mi-cuenta/editar/'
        );
    });

    it('returns null when the first segment is not a supported locale', () => {
        expect(buildLocaleSwitchPathname({ pathname: '/about/', locale: 'en' })).toBeNull();
        expect(buildLocaleSwitchPathname({ pathname: '/', locale: 'en' })).toBeNull();
        expect(buildLocaleSwitchPathname({ pathname: '/fr/page/', locale: 'en' })).toBeNull();
    });

    it('always returns a path-only value (never a scheme or host)', () => {
        // The result feeds the location.pathname setter, which cannot carry a
        // scheme/authority; assert the value is a bare same-origin path.
        const target = buildLocaleSwitchPathname({ pathname: '/es/x/', locale: 'en' });
        expect(target).toBe('/en/x/');
        expect(target?.startsWith('/')).toBe(true);
        expect(target?.startsWith('//')).toBe(false);
        expect(target).not.toContain('://');
    });

    it('does not switch a protocol-relative-looking pathname (empty first segment)', () => {
        // `//evil.com/...` splits to an empty first segment, so it is never a
        // supported locale and the switch is dropped.
        expect(buildLocaleSwitchPathname({ pathname: '//evil.com/es/', locale: 'en' })).toBeNull();
    });
});
