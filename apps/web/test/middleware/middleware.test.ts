/**
 * Tests for middleware helper functions.
 * Tests locale extraction, protected route detection, and static asset detection.
 */

import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LOCALE } from '../../src/lib/i18n';
import {
    buildLocaleRedirect,
    buildLoginRedirect,
    extractLocaleFromPath,
    isProtectedRoute,
    isServerIslandRoute,
    isStaticAssetRoute,
    parseSessionUser
} from '../../src/lib/middleware-helpers';

describe('extractLocaleFromPath', () => {
    describe('valid locales', () => {
        it('should extract Spanish locale from path', () => {
            const result = extractLocaleFromPath({ path: '/es/alojamientos' });
            expect(result.locale).toBe('es');
            expect(result.restOfPath).toBe('/alojamientos');
        });

        it('should extract English locale from path', () => {
            const result = extractLocaleFromPath({ path: '/en/about' });
            expect(result.locale).toBe('en');
            expect(result.restOfPath).toBe('/about');
        });

        it('should extract Portuguese locale from path', () => {
            const result = extractLocaleFromPath({ path: '/pt/sobre' });
            expect(result.locale).toBe('pt');
            expect(result.restOfPath).toBe('/sobre');
        });

        it('should handle locale with trailing slash', () => {
            const result = extractLocaleFromPath({ path: '/es/about/' });
            expect(result.locale).toBe('es');
            expect(result.restOfPath).toBe('/about/');
        });

        it('should handle locale-only path', () => {
            const result = extractLocaleFromPath({ path: '/es' });
            expect(result.locale).toBe('es');
            expect(result.restOfPath).toBe('/');
        });

        it('should handle locale-only path with trailing slash', () => {
            const result = extractLocaleFromPath({ path: '/es/' });
            expect(result.locale).toBe('es');
            expect(result.restOfPath).toBe('/');
        });

        it('should handle nested paths', () => {
            const result = extractLocaleFromPath({ path: '/en/blog/post/123' });
            expect(result.locale).toBe('en');
            expect(result.restOfPath).toBe('/blog/post/123');
        });
    });

    describe('invalid locales', () => {
        it('should return null for invalid locale', () => {
            const result = extractLocaleFromPath({ path: '/fr/about' });
            expect(result.locale).toBeNull();
            expect(result.restOfPath).toBe('/about');
        });

        it('should return null for invalid locale with trailing slash', () => {
            const result = extractLocaleFromPath({ path: '/de/test/' });
            expect(result.locale).toBeNull();
            expect(result.restOfPath).toBe('/test/');
        });

        it('should return null for root path', () => {
            const result = extractLocaleFromPath({ path: '/' });
            expect(result.locale).toBeNull();
            expect(result.restOfPath).toBe('/');
        });

        it('should return null for empty path', () => {
            const result = extractLocaleFromPath({ path: '' });
            expect(result.locale).toBeNull();
            expect(result.restOfPath).toBe('');
        });

        it('should return null for path without locale', () => {
            const result = extractLocaleFromPath({ path: '/about' });
            expect(result.locale).toBeNull();
            expect(result.restOfPath).toBe('/');
        });
    });

    describe('edge cases', () => {
        it('should handle path without leading slash', () => {
            const result = extractLocaleFromPath({ path: 'es/about' });
            expect(result.locale).toBe('es');
            expect(result.restOfPath).toBe('/about');
        });

        it('should handle multiple slashes', () => {
            const result = extractLocaleFromPath({ path: '//es//about' });
            expect(result.locale).toBeNull();
            expect(result.restOfPath).toBe('//es//about');
        });

        it('should handle case sensitivity (lowercase only)', () => {
            const result = extractLocaleFromPath({ path: '/ES/about' });
            expect(result.locale).toBeNull();
            expect(result.restOfPath).toBe('/about');
        });
    });
});

describe('isProtectedRoute', () => {
    describe('protected routes', () => {
        it('should return true for Spanish mi-cuenta route', () => {
            expect(isProtectedRoute({ path: '/es/mi-cuenta/profile' })).toBe(true);
        });

        it('should return true for English mi-cuenta route', () => {
            expect(isProtectedRoute({ path: '/en/mi-cuenta/settings' })).toBe(true);
        });

        it('should return true for Portuguese mi-cuenta route', () => {
            expect(isProtectedRoute({ path: '/pt/mi-cuenta/orders' })).toBe(true);
        });

        it('should return true for mi-cuenta root with trailing slash', () => {
            expect(isProtectedRoute({ path: '/es/mi-cuenta/' })).toBe(true);
        });

        it('should return true for mi-cuenta root without trailing slash', () => {
            expect(isProtectedRoute({ path: '/es/mi-cuenta' })).toBe(true);
        });

        it('should return true for nested mi-cuenta paths', () => {
            expect(isProtectedRoute({ path: '/es/mi-cuenta/profile/edit' })).toBe(true);
        });
    });

    describe('public routes', () => {
        it('should return false for regular content pages', () => {
            expect(isProtectedRoute({ path: '/es/alojamientos' })).toBe(false);
        });

        it('should return false for about page', () => {
            expect(isProtectedRoute({ path: '/en/about' })).toBe(false);
        });

        it('should return false for blog posts', () => {
            expect(isProtectedRoute({ path: '/es/blog/post-1' })).toBe(false);
        });

        it('should return false for root path', () => {
            expect(isProtectedRoute({ path: '/' })).toBe(false);
        });

        it('should return false for locale root', () => {
            expect(isProtectedRoute({ path: '/es/' })).toBe(false);
        });

        it('should return false for empty path', () => {
            expect(isProtectedRoute({ path: '' })).toBe(false);
        });

        it('should return false for auth routes', () => {
            expect(isProtectedRoute({ path: '/es/auth/signin' })).toBe(false);
        });
    });

    describe('edge cases', () => {
        it('should return false for path without locale', () => {
            expect(isProtectedRoute({ path: '/mi-cuenta' })).toBe(false);
        });

        it('should return false for similar but different paths', () => {
            expect(isProtectedRoute({ path: '/es/mi-cuenta-settings' })).toBe(false);
        });

        it('should return false for mi-cuenta in middle of path', () => {
            expect(isProtectedRoute({ path: '/es/users/mi-cuenta/profile' })).toBe(false);
        });

        it('should handle path without leading slash', () => {
            expect(isProtectedRoute({ path: 'es/mi-cuenta/profile' })).toBe(true);
        });
    });
});

describe('isStaticAssetRoute', () => {
    describe('static assets', () => {
        it('should return true for Astro build assets', () => {
            expect(isStaticAssetRoute({ path: '/_astro/client.abc123.js' })).toBe(true);
        });

        it('should return true for Astro CSS files', () => {
            expect(isStaticAssetRoute({ path: '/_astro/styles.xyz789.css' })).toBe(true);
        });

        it('should return true for favicon.ico', () => {
            expect(isStaticAssetRoute({ path: '/favicon.ico' })).toBe(true);
        });

        it('should return true for robots.txt', () => {
            expect(isStaticAssetRoute({ path: '/robots.txt' })).toBe(true);
        });

        it('should return true for sitemap.xml', () => {
            expect(isStaticAssetRoute({ path: '/sitemap.xml' })).toBe(true);
        });

        it('should return true for API routes', () => {
            expect(isStaticAssetRoute({ path: '/api/search' })).toBe(true);
        });

        it('should return true for nested API routes', () => {
            expect(isStaticAssetRoute({ path: '/api/v1/accommodations' })).toBe(true);
        });

        it('should return false for server island endpoints (they need session parsing)', () => {
            expect(isStaticAssetRoute({ path: '/_server-islands/AuthSection' })).toBe(false);
        });

        it('should return false for nested server island endpoints', () => {
            expect(isStaticAssetRoute({ path: '/_server-islands/AuthSection.abc123' })).toBe(false);
        });
    });

    describe('page routes', () => {
        it('should return false for regular pages', () => {
            expect(isStaticAssetRoute({ path: '/es/alojamientos' })).toBe(false);
        });

        it('should return false for about page', () => {
            expect(isStaticAssetRoute({ path: '/about' })).toBe(false);
        });

        it('should return false for blog posts', () => {
            expect(isStaticAssetRoute({ path: '/es/blog/post-1' })).toBe(false);
        });

        it('should return false for root path', () => {
            expect(isStaticAssetRoute({ path: '/' })).toBe(false);
        });

        it('should return false for empty path', () => {
            expect(isStaticAssetRoute({ path: '' })).toBe(false);
        });

        it('should return false for locale root', () => {
            expect(isStaticAssetRoute({ path: '/es/' })).toBe(false);
        });
    });

    describe('edge cases', () => {
        it('should return false for paths containing "_astro" but not at start', () => {
            expect(isStaticAssetRoute({ path: '/es/_astro-like-path' })).toBe(false);
        });

        it('should return false for paths containing "api" but not at start', () => {
            expect(isStaticAssetRoute({ path: '/es/api-docs' })).toBe(false);
        });

        it('should return false for favicon.ico in subdirectory', () => {
            expect(isStaticAssetRoute({ path: '/images/favicon.ico' })).toBe(false);
        });
    });
});

describe('isServerIslandRoute', () => {
    it('should return true for server island paths', () => {
        expect(isServerIslandRoute({ path: '/_server-islands/AuthSection' })).toBe(true);
    });

    it('should return true for server island paths with hash', () => {
        expect(isServerIslandRoute({ path: '/_server-islands/AuthSection.abc123' })).toBe(true);
    });

    it('should return false for regular pages', () => {
        expect(isServerIslandRoute({ path: '/es/alojamientos' })).toBe(false);
    });

    it('should return false for Astro build assets', () => {
        expect(isServerIslandRoute({ path: '/_astro/client.abc123.js' })).toBe(false);
    });

    it('should return false for empty path', () => {
        expect(isServerIslandRoute({ path: '' })).toBe(false);
    });

    it('should return false for root path', () => {
        expect(isServerIslandRoute({ path: '/' })).toBe(false);
    });
});

describe('buildLoginRedirect', () => {
    it('should build login URL with encoded return URL for Spanish', () => {
        const result = buildLoginRedirect({
            locale: 'es',
            currentUrl: '/es/mi-cuenta/profile'
        });
        expect(result).toBe('/es/auth/signin?returnUrl=%2Fes%2Fmi-cuenta%2Fprofile');
    });

    it('should build login URL with encoded return URL for English', () => {
        const result = buildLoginRedirect({
            locale: 'en',
            currentUrl: '/en/mi-cuenta/settings'
        });
        expect(result).toBe('/en/auth/signin?returnUrl=%2Fen%2Fmi-cuenta%2Fsettings');
    });

    it('should build login URL with encoded return URL for Portuguese', () => {
        const result = buildLoginRedirect({
            locale: 'pt',
            currentUrl: '/pt/mi-cuenta/orders'
        });
        expect(result).toBe('/pt/auth/signin?returnUrl=%2Fpt%2Fmi-cuenta%2Forders');
    });

    it('should properly encode special characters in return URL', () => {
        const result = buildLoginRedirect({
            locale: 'es',
            currentUrl: '/es/mi-cuenta/profile?tab=settings&view=details'
        });
        expect(result).toBe(
            '/es/auth/signin?returnUrl=%2Fes%2Fmi-cuenta%2Fprofile%3Ftab%3Dsettings%26view%3Ddetails'
        );
    });

    it('should handle nested paths in return URL', () => {
        const result = buildLoginRedirect({
            locale: 'en',
            currentUrl: '/en/mi-cuenta/bookings/123/details'
        });
        expect(result).toBe(
            '/en/auth/signin?returnUrl=%2Fen%2Fmi-cuenta%2Fbookings%2F123%2Fdetails'
        );
    });
});

describe('buildLocaleRedirect', () => {
    it('should build redirect URL with default locale', () => {
        const result = buildLocaleRedirect({ restOfPath: '/alojamientos' });
        expect(result).toBe(`/${DEFAULT_LOCALE}/alojamientos`);
    });

    it('should handle root path', () => {
        const result = buildLocaleRedirect({ restOfPath: '/' });
        expect(result).toBe(`/${DEFAULT_LOCALE}/`);
    });

    it('should handle empty path', () => {
        const result = buildLocaleRedirect({ restOfPath: '' });
        expect(result).toBe(`/${DEFAULT_LOCALE}/`);
    });

    it('should handle path without leading slash', () => {
        const result = buildLocaleRedirect({ restOfPath: 'about' });
        expect(result).toBe(`/${DEFAULT_LOCALE}/about`);
    });

    it('should handle nested paths', () => {
        const result = buildLocaleRedirect({ restOfPath: '/blog/post/123' });
        expect(result).toBe(`/${DEFAULT_LOCALE}/blog/post/123`);
    });

    it('should handle paths with trailing slash', () => {
        const result = buildLocaleRedirect({ restOfPath: '/about/' });
        expect(result).toBe(`/${DEFAULT_LOCALE}/about/`);
    });
});

describe('parseSessionUser', () => {
    let fetchSpy: MockInstance;

    beforeEach(() => {
        fetchSpy = vi.spyOn(globalThis, 'fetch');
    });

    afterEach(() => {
        fetchSpy.mockRestore();
    });

    describe('no cookie header', () => {
        it('should return null when cookieHeader is null', async () => {
            const result = await parseSessionUser({ cookieHeader: null });
            expect(result).toBeNull();
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it('should return null when cookieHeader is empty string', async () => {
            const result = await parseSessionUser({ cookieHeader: '' });
            expect(result).toBeNull();
            expect(fetchSpy).not.toHaveBeenCalled();
        });
    });

    describe('with valid session', () => {
        it('should return user object when API returns valid session', async () => {
            fetchSpy.mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        user: {
                            id: 'user-123',
                            name: 'Test User',
                            email: 'test@example.com'
                        }
                    }),
                    { status: 200 }
                )
            );

            const result = await parseSessionUser({
                cookieHeader: 'better-auth.session_token=abc123'
            });

            expect(result).toEqual({
                id: 'user-123',
                name: 'Test User',
                email: 'test@example.com'
            });
        });

        it('should forward cookies in the request', async () => {
            fetchSpy.mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        user: { id: 'user-1', name: 'User', email: 'u@e.com' }
                    }),
                    { status: 200 }
                )
            );

            await parseSessionUser({
                cookieHeader: 'better-auth.session_token=abc123; other=value'
            });

            expect(fetchSpy).toHaveBeenCalledWith(
                expect.stringContaining('/api/auth/get-session'),
                expect.objectContaining({
                    headers: {
                        cookie: 'better-auth.session_token=abc123; other=value'
                    }
                })
            );
        });

        it('should handle user with empty name', async () => {
            fetchSpy.mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        user: { id: 'user-456', email: 'no-name@example.com' }
                    }),
                    { status: 200 }
                )
            );

            const result = await parseSessionUser({
                cookieHeader: 'better-auth.session_token=abc'
            });

            expect(result).toEqual({
                id: 'user-456',
                name: '',
                email: 'no-name@example.com'
            });
        });
    });

    describe('with invalid session', () => {
        it('should return null when API returns non-200 status', async () => {
            fetchSpy.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

            const result = await parseSessionUser({
                cookieHeader: 'better-auth.session_token=expired'
            });

            expect(result).toBeNull();
        });

        it('should return null when API returns no user', async () => {
            fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

            const result = await parseSessionUser({
                cookieHeader: 'better-auth.session_token=invalid'
            });

            expect(result).toBeNull();
        });

        it('should return null when API returns user without id', async () => {
            fetchSpy.mockResolvedValueOnce(
                new Response(JSON.stringify({ user: { email: 'test@example.com' } }), {
                    status: 200
                })
            );

            const result = await parseSessionUser({
                cookieHeader: 'better-auth.session_token=no-id'
            });

            expect(result).toBeNull();
        });

        it('should return null when API returns user without email', async () => {
            fetchSpy.mockResolvedValueOnce(
                new Response(JSON.stringify({ user: { id: 'user-1' } }), { status: 200 })
            );

            const result = await parseSessionUser({
                cookieHeader: 'better-auth.session_token=no-email'
            });

            expect(result).toBeNull();
        });
    });

    describe('error handling', () => {
        it('should return null when fetch throws network error', async () => {
            fetchSpy.mockRejectedValueOnce(new Error('Network error'));

            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const result = await parseSessionUser({
                cookieHeader: 'better-auth.session_token=token'
            });

            expect(result).toBeNull();
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to validate session'),
                expect.any(String)
            );
            warnSpy.mockRestore();
        });

        it('should return null when fetch times out', async () => {
            fetchSpy.mockRejectedValueOnce(new Error('AbortError'));

            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const result = await parseSessionUser({
                cookieHeader: 'better-auth.session_token=token'
            });

            expect(result).toBeNull();
            warnSpy.mockRestore();
        });
    });
});
