/**
 * Tests for middleware helper functions in src/lib/middleware-helpers.ts
 * and for the structural patterns in src/middleware.ts.
 *
 * Pure helper functions are imported and exercised directly.
 * The middleware module itself (which requires astro:middleware) is
 * validated by reading its source and asserting on its logic patterns.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    buildLocaleRedirect,
    buildLoginRedirect,
    extractLocaleFromPath,
    isAuthRoute,
    isProtectedRoute,
    isServerIslandRoute,
    isStaticAssetRoute,
    parseSessionUser
} from '../../src/lib/middleware-helpers';

// ---------------------------------------------------------------------------
// Source file contents (for pattern-based assertions on the middleware module)
// ---------------------------------------------------------------------------

const middlewareSrc = readFileSync(resolve(__dirname, '../../src/middleware.ts'), 'utf8');

const helpersSrc = readFileSync(resolve(__dirname, '../../src/lib/middleware-helpers.ts'), 'utf8');

// ---------------------------------------------------------------------------
// extractLocaleFromPath
// ---------------------------------------------------------------------------

describe('extractLocaleFromPath', () => {
    describe('valid locales', () => {
        it('should extract "es" from /es/alojamientos/', () => {
            // Arrange
            const path = '/es/alojamientos/';

            // Act
            const result = extractLocaleFromPath({ path });

            // Assert
            expect(result.locale).toBe('es');
            expect(result.restOfPath).toBe('/alojamientos/');
        });

        it('should extract "en" from /en/destinations/', () => {
            // Arrange
            const path = '/en/destinations/';

            // Act
            const result = extractLocaleFromPath({ path });

            // Assert
            expect(result.locale).toBe('en');
            expect(result.restOfPath).toBe('/destinations/');
        });

        it('should extract "pt" from /pt/acomodacoes/', () => {
            // Arrange
            const path = '/pt/acomodacoes/';

            // Act
            const result = extractLocaleFromPath({ path });

            // Assert
            expect(result.locale).toBe('pt');
            expect(result.restOfPath).toBe('/acomodacoes/');
        });

        it('should return restOfPath as "/" for root locale path', () => {
            // Arrange
            const path = '/es/';

            // Act
            const result = extractLocaleFromPath({ path });

            // Assert
            expect(result.locale).toBe('es');
            expect(result.restOfPath).toBe('/');
        });

        it('should handle deep nested paths correctly', () => {
            // Arrange
            const path = '/es/alojamientos/page/2/';

            // Act
            const result = extractLocaleFromPath({ path });

            // Assert
            expect(result.locale).toBe('es');
            expect(result.restOfPath).toBe('/alojamientos/page/2/');
        });
    });

    describe('invalid locales', () => {
        it('should return null locale for unknown locale segment', () => {
            // Arrange
            const path = '/fr/destinations/';

            // Act
            const result = extractLocaleFromPath({ path });

            // Assert
            expect(result.locale).toBeNull();
        });

        it('should return null locale for root path', () => {
            // Arrange
            const path = '/';

            // Act
            const result = extractLocaleFromPath({ path });

            // Assert
            expect(result.locale).toBeNull();
        });

        it('should return null locale for empty path', () => {
            // Arrange
            const path = '';

            // Act
            const result = extractLocaleFromPath({ path });

            // Assert
            expect(result.locale).toBeNull();
        });

        it('should return null locale for "de" (unsupported)', () => {
            // Arrange
            const path = '/de/alojamientos/';

            // Act
            const result = extractLocaleFromPath({ path });

            // Assert
            expect(result.locale).toBeNull();
        });

        it('should return null locale for uppercase locale segment', () => {
            // Arrange - locales are case-sensitive; "ES" is not valid
            const path = '/ES/alojamientos/';

            // Act
            const result = extractLocaleFromPath({ path });

            // Assert
            expect(result.locale).toBeNull();
        });
    });
});

// ---------------------------------------------------------------------------
// isStaticAssetRoute
// ---------------------------------------------------------------------------

describe('isStaticAssetRoute', () => {
    describe('paths that should be skipped', () => {
        it('should skip internal Astro paths starting with /_', () => {
            expect(isStaticAssetRoute({ path: '/_astro/some-chunk.js' })).toBe(true);
            expect(isStaticAssetRoute({ path: '/_image' })).toBe(true);
        });

        it('should skip common image extensions', () => {
            expect(isStaticAssetRoute({ path: '/images/hero.jpg' })).toBe(true);
            expect(isStaticAssetRoute({ path: '/images/logo.webp' })).toBe(true);
            expect(isStaticAssetRoute({ path: '/favicon.ico' })).toBe(true);
            expect(isStaticAssetRoute({ path: '/icon.png' })).toBe(true);
            expect(isStaticAssetRoute({ path: '/banner.svg' })).toBe(true);
        });

        it('should skip font files', () => {
            expect(isStaticAssetRoute({ path: '/fonts/inter.woff2' })).toBe(true);
            expect(isStaticAssetRoute({ path: '/fonts/inter.ttf' })).toBe(true);
        });

        it('should skip CSS and JS files', () => {
            expect(isStaticAssetRoute({ path: '/styles/main.css' })).toBe(true);
            expect(isStaticAssetRoute({ path: '/scripts/bundle.js' })).toBe(true);
        });

        it('should skip well-known static files', () => {
            expect(isStaticAssetRoute({ path: '/robots.txt' })).toBe(true);
            expect(isStaticAssetRoute({ path: '/sitemap.xml' })).toBe(true);
        });

        it('should skip API routes', () => {
            expect(isStaticAssetRoute({ path: '/api/v1/public/accommodations' })).toBe(true);
            expect(isStaticAssetRoute({ path: '/api/auth/get-session' })).toBe(true);
        });

        it('should skip the 404 and 500 error pages', () => {
            expect(isStaticAssetRoute({ path: '/404' })).toBe(true);
            expect(isStaticAssetRoute({ path: '/500' })).toBe(true);
            expect(isStaticAssetRoute({ path: '/404/' })).toBe(true);
            expect(isStaticAssetRoute({ path: '/500/' })).toBe(true);
        });
    });

    describe('paths that should NOT be skipped', () => {
        it('should not skip locale-prefixed HTML routes', () => {
            expect(isStaticAssetRoute({ path: '/es/alojamientos/' })).toBe(false);
            expect(isStaticAssetRoute({ path: '/es/' })).toBe(false);
            expect(isStaticAssetRoute({ path: '/en/destinos/' })).toBe(false);
        });

        it('should not skip root path', () => {
            expect(isStaticAssetRoute({ path: '/' })).toBe(false);
        });

        it('should not skip auth routes', () => {
            expect(isStaticAssetRoute({ path: '/es/auth/signin/' })).toBe(false);
        });

        it('should return false for empty path', () => {
            expect(isStaticAssetRoute({ path: '' })).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// isServerIslandRoute
// ---------------------------------------------------------------------------

describe('isServerIslandRoute', () => {
    it('should detect server island requests', () => {
        expect(isServerIslandRoute({ path: '/_server-islands/AuthSection' })).toBe(true);
        expect(isServerIslandRoute({ path: '/_server-islands/FavoriteButton' })).toBe(true);
    });

    it('should not detect regular paths as server islands', () => {
        expect(isServerIslandRoute({ path: '/es/alojamientos/' })).toBe(false);
        expect(isServerIslandRoute({ path: '/_astro/chunk.js' })).toBe(false);
        expect(isServerIslandRoute({ path: '/' })).toBe(false);
    });

    it('should return false for empty path', () => {
        expect(isServerIslandRoute({ path: '' })).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// isProtectedRoute
// ---------------------------------------------------------------------------

describe('isProtectedRoute', () => {
    describe('protected paths', () => {
        it('should detect /es/mi-cuenta/ as protected', () => {
            expect(isProtectedRoute({ path: '/es/mi-cuenta/' })).toBe(true);
        });

        it('should detect sub-pages of mi-cuenta as protected', () => {
            expect(isProtectedRoute({ path: '/es/mi-cuenta/favoritos/' })).toBe(true);
            expect(isProtectedRoute({ path: '/es/mi-cuenta/editar/' })).toBe(true);
            expect(isProtectedRoute({ path: '/es/mi-cuenta/suscripcion/' })).toBe(true);
        });

        it('should detect mi-cuenta for all supported locales', () => {
            expect(isProtectedRoute({ path: '/en/mi-cuenta/' })).toBe(true);
            expect(isProtectedRoute({ path: '/pt/mi-cuenta/' })).toBe(true);
        });
    });

    describe('non-protected paths', () => {
        it('should not flag public listing pages as protected', () => {
            expect(isProtectedRoute({ path: '/es/alojamientos/' })).toBe(false);
            expect(isProtectedRoute({ path: '/es/destinos/' })).toBe(false);
        });

        it('should not flag auth pages as protected', () => {
            expect(isProtectedRoute({ path: '/es/auth/signin/' })).toBe(false);
        });

        it('should return false for root path', () => {
            expect(isProtectedRoute({ path: '/' })).toBe(false);
        });

        it('should return false for empty path', () => {
            expect(isProtectedRoute({ path: '' })).toBe(false);
        });

        it('should return false for single-segment paths', () => {
            expect(isProtectedRoute({ path: '/es/' })).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// isAuthRoute
// ---------------------------------------------------------------------------

describe('isAuthRoute', () => {
    describe('auth paths', () => {
        it('should detect /es/auth/signin/ as auth route', () => {
            expect(isAuthRoute({ path: '/es/auth/signin/' })).toBe(true);
        });

        it('should detect all auth sub-pages', () => {
            expect(isAuthRoute({ path: '/es/auth/signup/' })).toBe(true);
            expect(isAuthRoute({ path: '/es/auth/forgot-password/' })).toBe(true);
            expect(isAuthRoute({ path: '/es/auth/reset-password/' })).toBe(true);
            expect(isAuthRoute({ path: '/es/auth/verify-email/' })).toBe(true);
        });

        it('should detect auth routes for all locales', () => {
            expect(isAuthRoute({ path: '/en/auth/signin/' })).toBe(true);
            expect(isAuthRoute({ path: '/pt/auth/signin/' })).toBe(true);
        });
    });

    describe('non-auth paths', () => {
        it('should not flag public pages as auth routes', () => {
            expect(isAuthRoute({ path: '/es/alojamientos/' })).toBe(false);
            expect(isAuthRoute({ path: '/es/mi-cuenta/' })).toBe(false);
        });

        it('should return false for root or empty paths', () => {
            expect(isAuthRoute({ path: '/' })).toBe(false);
            expect(isAuthRoute({ path: '' })).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// buildLoginRedirect
// ---------------------------------------------------------------------------

describe('buildLoginRedirect', () => {
    it('should build a redirect URL to the signin page with a returnUrl param', () => {
        // Arrange
        const locale = 'es' as const;
        const currentUrl = '/es/mi-cuenta/favoritos/';

        // Act
        const result = buildLoginRedirect({ locale, currentUrl });

        // Assert
        expect(result).toContain('/es/auth/signin');
        expect(result).toContain('returnUrl=');
        expect(result).toContain(encodeURIComponent(currentUrl));
    });

    it('should use the provided locale in the redirect path', () => {
        // Arrange & Act
        const resultEn = buildLoginRedirect({ locale: 'en', currentUrl: '/en/mi-cuenta/' });
        const resultPt = buildLoginRedirect({ locale: 'pt', currentUrl: '/pt/mi-cuenta/' });

        // Assert
        expect(resultEn).toMatch(/^\/en\/auth\/signin/);
        expect(resultPt).toMatch(/^\/pt\/auth\/signin/);
    });

    it('should URL-encode special characters in the return URL', () => {
        // Arrange
        const currentUrl = '/es/mi-cuenta/editar/?tab=profile';

        // Act
        const result = buildLoginRedirect({ locale: 'es', currentUrl });

        // Assert
        expect(result).toContain(encodeURIComponent(currentUrl));
        // The query string delimiter should be encoded as %3F
        expect(result).toContain('%3F');
    });
});

// ---------------------------------------------------------------------------
// buildLocaleRedirect
// ---------------------------------------------------------------------------

describe('buildLocaleRedirect', () => {
    it('should prepend the default locale (es) to the rest of the path', () => {
        // Arrange
        const restOfPath = '/alojamientos/';

        // Act
        const result = buildLocaleRedirect({ restOfPath });

        // Assert
        expect(result).toBe('/es/alojamientos/');
    });

    it('should handle paths that do not start with a slash', () => {
        // Arrange
        const restOfPath = 'destinos/';

        // Act
        const result = buildLocaleRedirect({ restOfPath });

        // Assert
        expect(result).toBe('/es/destinos/');
    });

    it('should handle root path', () => {
        // Arrange
        const restOfPath = '/';

        // Act
        const result = buildLocaleRedirect({ restOfPath });

        // Assert
        expect(result).toBe('/es/');
    });
});

// ---------------------------------------------------------------------------
// parseSessionUser
// ---------------------------------------------------------------------------

describe('parseSessionUser', () => {
    it('should return null when cookieHeader is null', async () => {
        // Arrange & Act
        const result = await parseSessionUser({ cookieHeader: null });

        // Assert
        expect(result).toBeNull();
    });

    it('should return null when cookieHeader is an empty string', async () => {
        // Arrange & Act
        const result = await parseSessionUser({ cookieHeader: '' });

        // Assert
        expect(result).toBeNull();
    });

    it('should return null when the API returns a non-ok response', async () => {
        // Arrange - global fetch is available in jsdom; we can spy on it
        const originalFetch = global.fetch;
        global.fetch = async () =>
            new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

        // Act
        const result = await parseSessionUser({ cookieHeader: 'session=abc123' });

        // Assert
        expect(result).toBeNull();

        // Cleanup
        global.fetch = originalFetch;
    });

    it('should return null when the API response body has no user', async () => {
        // Arrange
        const originalFetch = global.fetch;
        global.fetch = async () => new Response(JSON.stringify({}), { status: 200 });

        // Act
        const result = await parseSessionUser({ cookieHeader: 'session=abc123' });

        // Assert
        expect(result).toBeNull();

        // Cleanup
        global.fetch = originalFetch;
    });

    it('should return null when user object is missing id', async () => {
        // Arrange
        const originalFetch = global.fetch;
        global.fetch = async () =>
            new Response(
                JSON.stringify({ user: { name: 'Test User', email: 'test@example.com' } }),
                { status: 200 }
            );

        // Act
        const result = await parseSessionUser({ cookieHeader: 'session=abc123' });

        // Assert
        expect(result).toBeNull();

        // Cleanup
        global.fetch = originalFetch;
    });

    it('should return a SessionUser when the API returns valid user data', async () => {
        // Arrange
        const originalFetch = global.fetch;
        global.fetch = async () =>
            new Response(
                JSON.stringify({
                    user: { id: 'user-1', name: 'Test User', email: 'test@example.com' }
                }),
                { status: 200 }
            );

        // Act
        const result = await parseSessionUser({ cookieHeader: 'session=abc123' });

        // Assert
        expect(result).not.toBeNull();
        expect(result?.id).toBe('user-1');
        expect(result?.name).toBe('Test User');
        expect(result?.email).toBe('test@example.com');

        // Cleanup
        global.fetch = originalFetch;
    });

    it('should return null when fetch throws a network error', async () => {
        // Arrange
        const originalFetch = global.fetch;
        global.fetch = async () => {
            throw new Error('Network failure');
        };

        // Act
        const result = await parseSessionUser({ cookieHeader: 'session=abc123' });

        // Assert
        expect(result).toBeNull();

        // Cleanup
        global.fetch = originalFetch;
    });

    it('should use empty string for name when API omits it', async () => {
        // Arrange
        const originalFetch = global.fetch;
        global.fetch = async () =>
            new Response(
                JSON.stringify({
                    user: { id: 'user-2', email: 'noname@example.com' }
                }),
                { status: 200 }
            );

        // Act
        const result = await parseSessionUser({ cookieHeader: 'session=xyz' });

        // Assert
        expect(result?.name).toBe('');
        expect(result?.email).toBe('noname@example.com');

        // Cleanup
        global.fetch = originalFetch;
    });
});

// ---------------------------------------------------------------------------
// middleware.ts structural patterns
// ---------------------------------------------------------------------------

describe('middleware.ts source structure', () => {
    it('should export onRequest via defineMiddleware', () => {
        expect(middlewareSrc).toContain('export const onRequest = defineMiddleware(');
    });

    it('should skip static asset routes before any other processing', () => {
        // In the middleware body (after imports), isStaticAssetRoute call must appear
        // before extractLocaleFromPath call
        const bodyStart = middlewareSrc.indexOf('defineMiddleware(');
        const body = middlewareSrc.slice(bodyStart);
        const staticIdx = body.indexOf('isStaticAssetRoute');
        const localeIdx = body.indexOf('extractLocaleFromPath');
        expect(staticIdx).toBeGreaterThan(-1);
        expect(localeIdx).toBeGreaterThan(-1);
        expect(staticIdx).toBeLessThan(localeIdx);
    });

    it('should enforce trailing slash redirect before locale extraction', () => {
        // In the middleware body, trailing slash redirect must precede extractLocaleFromPath
        const bodyStart = middlewareSrc.indexOf('defineMiddleware(');
        const body = middlewareSrc.slice(bodyStart);
        const trailingSlashIdx = body.indexOf("!path.endsWith('/')");
        const localeIdx = body.indexOf('extractLocaleFromPath');
        expect(trailingSlashIdx).toBeGreaterThan(-1);
        expect(trailingSlashIdx).toBeLessThan(localeIdx);
    });

    it('should redirect to default locale when locale is null', () => {
        expect(middlewareSrc).toContain('locale === null');
        expect(middlewareSrc).toContain('buildLocaleRedirect');
    });

    it('should protect mi-cuenta routes with auth check', () => {
        expect(middlewareSrc).toContain('isProtectedRoute');
        expect(middlewareSrc).toContain('buildLoginRedirect');
    });

    it('should rewrite 404 responses to the custom 404 page', () => {
        expect(middlewareSrc).toContain('response.status === 404');
        expect(middlewareSrc).toContain("context.rewrite('/404')");
    });

    it('should set locale in context.locals', () => {
        expect(middlewareSrc).toContain('context.locals');
        expect(middlewareSrc).toContain('locale');
    });

    it('should handle server island routes separately', () => {
        expect(middlewareSrc).toContain('isServerIslandRoute');
    });

    it('should use a 301 redirect for trailing slash enforcement', () => {
        expect(middlewareSrc).toContain('301');
    });
});

// ---------------------------------------------------------------------------
// middleware-helpers.ts source structure
// ---------------------------------------------------------------------------

describe('middleware-helpers.ts source structure', () => {
    it('should export all required helper functions', () => {
        const requiredExports = [
            'extractLocaleFromPath',
            'isProtectedRoute',
            'isAuthRoute',
            'isStaticAssetRoute',
            'isServerIslandRoute',
            'buildLoginRedirect',
            'buildLocaleRedirect',
            'parseSessionUser'
        ];
        for (const name of requiredExports) {
            expect(helpersSrc).toMatch(new RegExp(`export (async )?function ${name}`));
        }
    });

    it('should export the LocaleExtractionResult interface', () => {
        expect(helpersSrc).toContain('export interface LocaleExtractionResult');
    });

    it('should export the SessionUser interface', () => {
        expect(helpersSrc).toContain('export interface SessionUser');
    });

    it('should call the Better Auth get-session endpoint', () => {
        expect(helpersSrc).toContain('/api/auth/get-session');
    });

    it('should use isValidLocale for locale validation', () => {
        expect(helpersSrc).toContain('isValidLocale');
    });
});
