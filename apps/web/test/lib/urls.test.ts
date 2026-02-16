import { describe, expect, it } from 'vitest';
import { buildUrl, buildUrlWithParams } from '../../src/lib/urls';

describe('buildUrl', () => {
    it('should build a basic URL with locale and path', () => {
        const result = buildUrl({ locale: 'es', path: 'mi-cuenta' });
        expect(result).toBe('/es/mi-cuenta/');
    });

    it('should add trailing slash when missing', () => {
        const result = buildUrl({ locale: 'en', path: 'mi-cuenta/editar' });
        expect(result).toBe('/en/mi-cuenta/editar/');
    });

    it('should not add double trailing slash when already present', () => {
        const result = buildUrl({ locale: 'es', path: 'mi-cuenta/' });
        expect(result).toBe('/es/mi-cuenta/');
    });

    it('should return locale root when path is empty', () => {
        const result = buildUrl({ locale: 'es' });
        expect(result).toBe('/es/');
    });

    it('should return locale root when path is empty string', () => {
        const result = buildUrl({ locale: 'pt', path: '' });
        expect(result).toBe('/pt/');
    });

    it('should normalize leading slash in path', () => {
        const result = buildUrl({ locale: 'es', path: '/mi-cuenta' });
        expect(result).toBe('/es/mi-cuenta/');
    });

    it('should handle path with both leading and trailing slashes', () => {
        const result = buildUrl({ locale: 'en', path: '/alojamientos/' });
        expect(result).toBe('/en/alojamientos/');
    });

    it('should handle nested paths', () => {
        const result = buildUrl({ locale: 'es', path: 'mi-cuenta/favoritos' });
        expect(result).toBe('/es/mi-cuenta/favoritos/');
    });

    it('should work with all supported locales', () => {
        expect(buildUrl({ locale: 'es', path: 'test' })).toBe('/es/test/');
        expect(buildUrl({ locale: 'en', path: 'test' })).toBe('/en/test/');
        expect(buildUrl({ locale: 'pt', path: 'test' })).toBe('/pt/test/');
    });

    it('should handle path that is just a slash', () => {
        const result = buildUrl({ locale: 'es', path: '/' });
        expect(result).toBe('/es/');
    });
});

describe('buildUrlWithParams', () => {
    it('should build URL with query parameters', () => {
        const result = buildUrlWithParams({
            locale: 'es',
            path: 'busqueda',
            params: { q: 'hotel' }
        });
        expect(result).toBe('/es/busqueda/?q=hotel');
    });

    it('should handle multiple query parameters', () => {
        const result = buildUrlWithParams({
            locale: 'en',
            path: 'busqueda',
            params: { q: 'hotel', page: '2' }
        });
        expect(result).toContain('/en/busqueda/?');
        expect(result).toContain('q=hotel');
        expect(result).toContain('page=2');
    });

    it('should return URL without query string when params is empty', () => {
        const result = buildUrlWithParams({
            locale: 'es',
            path: 'mi-cuenta',
            params: {}
        });
        expect(result).toBe('/es/mi-cuenta/');
    });

    it('should encode special characters in params', () => {
        const result = buildUrlWithParams({
            locale: 'es',
            path: 'busqueda',
            params: { q: 'hotel & spa' }
        });
        expect(result).toContain('q=hotel+%26+spa');
    });
});
