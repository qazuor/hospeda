/**
 * @file urls.test.ts
 * @description Unit tests for URL builder utilities.
 */

import { describe, expect, it } from 'vitest';
import { buildLocaleSwitchTarget, buildUrl, buildUrlWithParams } from '../../src/lib/urls';

const ORIGIN = 'https://staging.hospeda.com.ar';

/** Build a minimal location-like object for buildLocaleSwitchTarget. */
function loc(pathname: string, search = '', hash = '', origin = ORIGIN) {
    return { pathname, search, hash, origin };
}

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

describe('buildLocaleSwitchTarget', () => {
    it('swaps the leading locale segment, preserving the rest of the path', () => {
        expect(buildLocaleSwitchTarget({ location: loc('/es/mi-cuenta/'), locale: 'en' })).toBe(
            '/en/mi-cuenta/'
        );
    });

    it('preserves search and hash', () => {
        expect(
            buildLocaleSwitchTarget({
                location: loc('/es/busqueda/', '?q=hotel', '#resultados'),
                locale: 'pt'
            })
        ).toBe('/pt/busqueda/?q=hotel#resultados');
    });

    it('switches at the locale root', () => {
        expect(buildLocaleSwitchTarget({ location: loc('/es/'), locale: 'en' })).toBe('/en/');
    });

    it('returns null when the first segment is not a supported locale', () => {
        expect(buildLocaleSwitchTarget({ location: loc('/about/'), locale: 'en' })).toBeNull();
        expect(buildLocaleSwitchTarget({ location: loc('/'), locale: 'en' })).toBeNull();
        expect(buildLocaleSwitchTarget({ location: loc('/fr/page/'), locale: 'en' })).toBeNull();
    });

    it('always returns a same-origin path (never a scheme or host)', () => {
        // Even with hostile search/hash, the result stays a relative same-origin
        // path so it can never be reinterpreted as a `javascript:` or external URL.
        const target = buildLocaleSwitchTarget({
            location: loc('/es/x/', '?next=//evil.com', '#javascript:alert(1)'),
            locale: 'en'
        });
        expect(target).not.toBeNull();
        expect(target?.startsWith('/')).toBe(true);
        expect(target?.startsWith('//')).toBe(false);
        expect(target).not.toContain('://');
    });

    it('rejects a protocol-relative-looking pathname (no locale first segment)', () => {
        // `//evil.com/...` splits to an empty first segment, so it is never a
        // supported locale and the switch is dropped before any navigation.
        expect(
            buildLocaleSwitchTarget({ location: loc('//evil.com/es/'), locale: 'en' })
        ).toBeNull();
    });
});
