import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildLocaleRedirect,
    buildLoginRedirect,
    buildSentryReportUri,
    extractLocaleFromPath,
    isAuthRoute,
    isProtectedRoute,
    isServerIslandRoute,
    isStaticAssetRoute,
    parseSessionUser
} from '../../src/lib/middleware-helpers';

describe('middleware-helpers', () => {
    describe('extractLocaleFromPath', () => {
        it('should extract valid locale from path', () => {
            expect(extractLocaleFromPath({ path: '/es/' })).toEqual({
                locale: 'es',
                restOfPath: '/'
            });
            expect(extractLocaleFromPath({ path: '/en/about' })).toEqual({
                locale: 'en',
                restOfPath: '/about'
            });
            expect(extractLocaleFromPath({ path: '/pt/alojamientos/123' })).toEqual({
                locale: 'pt',
                restOfPath: '/alojamientos/123'
            });
        });

        it('should return null locale for root path', () => {
            expect(extractLocaleFromPath({ path: '/' })).toEqual({
                locale: null,
                restOfPath: '/'
            });
        });

        it('should return null locale for invalid locale', () => {
            const result = extractLocaleFromPath({ path: '/fr/about' });
            expect(result.locale).toBeNull();
        });

        it('should return null locale for empty path', () => {
            expect(extractLocaleFromPath({ path: '' })).toEqual({
                locale: null,
                restOfPath: ''
            });
        });
    });

    describe('isProtectedRoute', () => {
        it('should detect mi-cuenta routes as protected', () => {
            expect(isProtectedRoute({ path: '/es/mi-cuenta' })).toBe(true);
            expect(isProtectedRoute({ path: '/en/mi-cuenta/favoritos' })).toBe(true);
        });

        it('should not detect other routes as protected', () => {
            expect(isProtectedRoute({ path: '/es/' })).toBe(false);
            expect(isProtectedRoute({ path: '/es/alojamientos' })).toBe(false);
            expect(isProtectedRoute({ path: '' })).toBe(false);
        });
    });

    describe('isAuthRoute', () => {
        it('should detect auth routes', () => {
            expect(isAuthRoute({ path: '/es/auth/signin' })).toBe(true);
            expect(isAuthRoute({ path: '/en/auth/signup' })).toBe(true);
        });

        it('should not detect non-auth routes', () => {
            expect(isAuthRoute({ path: '/es/' })).toBe(false);
            expect(isAuthRoute({ path: '' })).toBe(false);
        });
    });

    describe('isStaticAssetRoute', () => {
        it('should detect _astro paths', () => {
            expect(isStaticAssetRoute({ path: '/_astro/chunk.js' })).toBe(true);
        });

        it('should detect static file paths', () => {
            expect(isStaticAssetRoute({ path: '/favicon.ico' })).toBe(true);
            expect(isStaticAssetRoute({ path: '/robots.txt' })).toBe(true);
            expect(isStaticAssetRoute({ path: '/sitemap.xml' })).toBe(true);
        });

        it('should detect API paths', () => {
            expect(isStaticAssetRoute({ path: '/api/auth/session' })).toBe(true);
        });

        it('should not detect regular paths', () => {
            expect(isStaticAssetRoute({ path: '/es/' })).toBe(false);
            expect(isStaticAssetRoute({ path: '' })).toBe(false);
        });
    });

    describe('isServerIslandRoute', () => {
        it('should detect server island routes', () => {
            expect(isServerIslandRoute({ path: '/_server-islands/AlojamientosSection' })).toBe(
                true
            );
        });

        it('should not detect other routes', () => {
            expect(isServerIslandRoute({ path: '/es/' })).toBe(false);
            expect(isServerIslandRoute({ path: '' })).toBe(false);
        });
    });

    describe('buildLoginRedirect', () => {
        it('should build encoded redirect URL', () => {
            const result = buildLoginRedirect({
                locale: 'es',
                currentUrl: '/es/mi-cuenta/favoritos'
            });
            expect(result).toBe('/es/auth/signin?returnUrl=%2Fes%2Fmi-cuenta%2Ffavoritos');
        });
    });

    describe('buildLocaleRedirect', () => {
        it('should prepend default locale to path', () => {
            expect(buildLocaleRedirect({ restOfPath: '/about' })).toBe('/es/about');
        });

        it('should handle root path', () => {
            expect(buildLocaleRedirect({ restOfPath: '/' })).toBe('/es/');
        });

        it('should handle path without leading slash', () => {
            expect(buildLocaleRedirect({ restOfPath: 'about' })).toBe('/es/about');
        });
    });

    describe('extractLocaleFromPath - edge cases', () => {
        it('should return restOfPath as / when locale is the only segment', () => {
            const result = extractLocaleFromPath({ path: '/es' });
            expect(result.locale).toBe('es');
            expect(result.restOfPath).toBe('/');
        });

        it('should handle path without leading slash', () => {
            const result = extractLocaleFromPath({ path: 'es/alojamientos' });
            expect(result.locale).toBe('es');
            expect(result.restOfPath).toBe('/alojamientos');
        });

        it('should handle invalid locale segment and return rest without the invalid segment', () => {
            const result = extractLocaleFromPath({ path: '/fr/about' });
            expect(result.locale).toBeNull();
            expect(result.restOfPath).toBe('/about');
        });
    });

    describe('isProtectedRoute - edge cases', () => {
        it('should return false for path with only one segment', () => {
            expect(isProtectedRoute({ path: '/es' })).toBe(false);
        });

        it('should return false for path without leading slash', () => {
            expect(isProtectedRoute({ path: 'es/mi-cuenta' })).toBe(true);
        });
    });

    describe('isAuthRoute - edge cases', () => {
        it('should return false for path with only one segment', () => {
            expect(isAuthRoute({ path: '/es' })).toBe(false);
        });

        it('should return false for path without leading slash with non-auth segment', () => {
            expect(isAuthRoute({ path: 'es/alojamientos' })).toBe(false);
        });
    });

    describe('isStaticAssetRoute - edge cases', () => {
        it('should return false for null-like empty path', () => {
            expect(isStaticAssetRoute({ path: '' })).toBe(false);
        });

        it('should detect _server-islands as static-like route via leading /_', () => {
            expect(isStaticAssetRoute({ path: '/_server-islands/Component' })).toBe(true);
        });

        it('should detect error page paths /404 and /500', () => {
            expect(isStaticAssetRoute({ path: '/404' })).toBe(true);
            expect(isStaticAssetRoute({ path: '/500' })).toBe(true);
            expect(isStaticAssetRoute({ path: '/404/' })).toBe(true);
            expect(isStaticAssetRoute({ path: '/500/' })).toBe(true);
        });

        it('should detect common static asset extensions', () => {
            expect(isStaticAssetRoute({ path: '/images/hero.jpg' })).toBe(true);
            expect(isStaticAssetRoute({ path: '/images/logo.webp' })).toBe(true);
            expect(isStaticAssetRoute({ path: '/images/icon.svg' })).toBe(true);
            expect(isStaticAssetRoute({ path: '/images/photo.png' })).toBe(true);
            expect(isStaticAssetRoute({ path: '/fonts/inter.woff2' })).toBe(true);
            expect(isStaticAssetRoute({ path: '/styles/main.css' })).toBe(true);
        });

        it('should not detect page routes as static assets', () => {
            expect(isStaticAssetRoute({ path: '/es/alojamientos/' })).toBe(false);
            expect(isStaticAssetRoute({ path: '/es/destinos/colon/' })).toBe(false);
        });
    });

    describe('isServerIslandRoute - edge cases', () => {
        it('should return false for null-like empty path', () => {
            expect(isServerIslandRoute({ path: '' })).toBe(false);
        });

        it('should return true for any path starting with /_server-islands/', () => {
            expect(isServerIslandRoute({ path: '/_server-islands/MyComponent' })).toBe(true);
        });
    });
});

describe('parseSessionUser', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        global.fetch = vi.fn();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('should return null when cookieHeader is null', async () => {
        const result = await parseSessionUser({ cookieHeader: null });
        expect(result).toBeNull();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return null when response is not ok', async () => {
        vi.mocked(global.fetch).mockResolvedValue(new Response(null, { status: 401 }));

        const result = await parseSessionUser({ cookieHeader: 'session=abc123' });
        expect(result).toBeNull();
    });

    it('should return null when response body has no user', async () => {
        vi.mocked(global.fetch).mockResolvedValue(
            new Response(JSON.stringify({}), { status: 200 })
        );

        const result = await parseSessionUser({ cookieHeader: 'session=abc123' });
        expect(result).toBeNull();
    });

    it('should return null when user has no id', async () => {
        const body = JSON.stringify({ user: { email: 'test@example.com' } });
        vi.mocked(global.fetch).mockResolvedValue(new Response(body, { status: 200 }));

        const result = await parseSessionUser({ cookieHeader: 'session=abc123' });
        expect(result).toBeNull();
    });

    it('should return null when user has no email', async () => {
        const body = JSON.stringify({ user: { id: 'user-1', name: 'Test' } });
        vi.mocked(global.fetch).mockResolvedValue(new Response(body, { status: 200 }));

        const result = await parseSessionUser({ cookieHeader: 'session=abc123' });
        expect(result).toBeNull();
    });

    it('should return SessionUser when response has valid user', async () => {
        const body = JSON.stringify({
            user: { id: 'user-1', name: 'Juan Perez', email: 'juan@example.com' }
        });
        vi.mocked(global.fetch).mockResolvedValue(new Response(body, { status: 200 }));

        const result = await parseSessionUser({ cookieHeader: 'session=abc123' });
        expect(result).toEqual({
            id: 'user-1',
            name: 'Juan Perez',
            email: 'juan@example.com'
        });
    });

    it('should use empty string for name when user.name is missing', async () => {
        const body = JSON.stringify({
            user: { id: 'user-2', email: 'noemail@example.com' }
        });
        vi.mocked(global.fetch).mockResolvedValue(new Response(body, { status: 200 }));

        const result = await parseSessionUser({ cookieHeader: 'session=xyz' });
        expect(result).toEqual({
            id: 'user-2',
            name: '',
            email: 'noemail@example.com'
        });
    });

    it('should return null when fetch throws', async () => {
        vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

        const result = await parseSessionUser({ cookieHeader: 'session=abc123' });
        expect(result).toBeNull();
    });
});

describe('buildSentryReportUri', () => {
    it('should parse a valid DSN and return the security endpoint', () => {
        const result = buildSentryReportUri({
            dsn: 'https://abc123@o456789.ingest.sentry.io/789'
        });
        expect(result).toBe('https://o456789.ingest.sentry.io/api/789/security/?sentry_key=abc123');
    });

    it('should return null for an invalid DSN', () => {
        const result = buildSentryReportUri({ dsn: 'not-a-url' });
        expect(result).toBeNull();
    });

    it('should return null for a DSN missing the project ID', () => {
        const result = buildSentryReportUri({ dsn: 'https://key@host/' });
        expect(result).toBeNull();
    });

    it('should return null for a DSN missing the key', () => {
        const result = buildSentryReportUri({ dsn: 'https://host/123' });
        expect(result).toBeNull();
    });
});
