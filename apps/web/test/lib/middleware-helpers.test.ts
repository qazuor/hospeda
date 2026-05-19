/**
 * @file middleware-helpers.test.ts
 * @description Unit tests for middleware helper functions.
 */

import { describe, expect, it } from 'vitest';
import { ALLOWED_REMOTE_HOSTS } from '../../src/lib/media';
import {
    buildCspHeader,
    buildLocaleRedirect,
    buildLoginRedirect,
    buildProfileCompletionRedirect,
    buildSetPasswordRedirect,
    extractLocaleFromPath,
    generateCspNonce,
    isAuthRoute,
    isProfileCompletionBypassRole,
    isProfileCompletionRequiredSessionOptionalRoute,
    isProfileCompletionRoute,
    isProtectedRoute,
    isServerIslandRoute,
    isSetPasswordRoute,
    isStaticAssetRoute
} from '../../src/lib/middleware-helpers';

describe('extractLocaleFromPath', () => {
    it('should extract valid locale', () => {
        const result = extractLocaleFromPath({ path: '/es/alojamientos/' });
        expect(result).toEqual({ locale: 'es', restOfPath: '/alojamientos/' });
    });

    it('should return null for invalid locale', () => {
        const result = extractLocaleFromPath({ path: '/xx/foo/' });
        expect(result.locale).toBeNull();
    });

    it('should return null for root path', () => {
        const result = extractLocaleFromPath({ path: '/' });
        expect(result.locale).toBeNull();
    });

    it('should handle all supported locales', () => {
        expect(extractLocaleFromPath({ path: '/es/test/' }).locale).toBe('es');
        expect(extractLocaleFromPath({ path: '/en/test/' }).locale).toBe('en');
        expect(extractLocaleFromPath({ path: '/pt/test/' }).locale).toBe('pt');
    });

    it('should extract rest of path correctly', () => {
        const result = extractLocaleFromPath({ path: '/en/mi-cuenta/perfil/' });
        expect(result).toEqual({ locale: 'en', restOfPath: '/mi-cuenta/perfil/' });
    });
});

describe('isProtectedRoute', () => {
    it('should return true for mi-cuenta routes', () => {
        expect(isProtectedRoute({ path: '/es/mi-cuenta/' })).toBe(true);
        expect(isProtectedRoute({ path: '/es/mi-cuenta/perfil/' })).toBe(true);
    });

    it('should return false for public routes', () => {
        expect(isProtectedRoute({ path: '/es/alojamientos/' })).toBe(false);
        expect(isProtectedRoute({ path: '/es/destinos/' })).toBe(false);
    });

    it('should return false for empty path', () => {
        expect(isProtectedRoute({ path: '' })).toBe(false);
    });
});

describe('isAuthRoute', () => {
    it('should return true for auth routes', () => {
        expect(isAuthRoute({ path: '/es/auth/signin/' })).toBe(true);
        expect(isAuthRoute({ path: '/es/auth/signup/' })).toBe(true);
    });

    it('should return false for non-auth routes', () => {
        expect(isAuthRoute({ path: '/es/alojamientos/' })).toBe(false);
    });
});

describe('isStaticAssetRoute', () => {
    it('should detect static file extensions', () => {
        expect(isStaticAssetRoute({ path: '/images/logo.png' })).toBe(true);
        expect(isStaticAssetRoute({ path: '/styles/main.css' })).toBe(true);
        expect(isStaticAssetRoute({ path: '/script.js' })).toBe(true);
    });

    it('should detect Astro internal paths', () => {
        expect(isStaticAssetRoute({ path: '/_astro/chunk.js' })).toBe(true);
    });

    it('should detect well-known static files', () => {
        expect(isStaticAssetRoute({ path: '/robots.txt' })).toBe(true);
        expect(isStaticAssetRoute({ path: '/favicon.ico' })).toBe(true);
    });

    it('should detect error pages', () => {
        expect(isStaticAssetRoute({ path: '/404' })).toBe(true);
        expect(isStaticAssetRoute({ path: '/500' })).toBe(true);
    });

    it('should return false for regular pages', () => {
        expect(isStaticAssetRoute({ path: '/es/alojamientos/' })).toBe(false);
    });
});

describe('isServerIslandRoute', () => {
    it('should detect server island routes', () => {
        expect(isServerIslandRoute({ path: '/_server-islands/AuthSection' })).toBe(true);
    });

    it('should return false for non-server-island routes', () => {
        expect(isServerIslandRoute({ path: '/es/' })).toBe(false);
    });
});

describe('buildLoginRedirect', () => {
    it('should build login URL with encoded return path', () => {
        const result = buildLoginRedirect({ locale: 'es', currentUrl: '/es/mi-cuenta/perfil/' });
        expect(result).toBe('/es/auth/signin/?returnUrl=%2Fes%2Fmi-cuenta%2Fperfil%2F');
    });
});

describe('buildLocaleRedirect', () => {
    it('should prefix with default locale', () => {
        const result = buildLocaleRedirect({ restOfPath: '/alojamientos/' });
        expect(result).toBe('/es/alojamientos/');
    });
});

describe('generateCspNonce', () => {
    it('should generate a non-empty string', () => {
        const nonce = generateCspNonce();
        expect(nonce).toBeTruthy();
        expect(nonce.length).toBeGreaterThan(0);
    });

    it('should generate unique nonces', () => {
        const a = generateCspNonce();
        const b = generateCspNonce();
        expect(a).not.toBe(b);
    });

    it('should be valid base64', () => {
        const nonce = generateCspNonce();
        expect(() => atob(nonce)).not.toThrow();
    });
});

describe('buildCspHeader', () => {
    it('should include nonce in script-src and style-src', () => {
        const header = buildCspHeader({ nonce: 'test123' });
        expect(header).toContain("'nonce-test123'");
        expect(header).toContain('script-src');
        expect(header).toContain('style-src');
    });

    it('should include API URL in connect-src when provided', () => {
        const header = buildCspHeader({ nonce: 'x', apiUrl: 'https://api.example.com' });
        expect(header).toContain('https://api.example.com');
    });

    it('should omit API URL from connect-src when empty', () => {
        const header = buildCspHeader({ nonce: 'x', apiUrl: '' });
        expect(header).not.toContain("connect-src 'self'  ");
    });

    it('should omit API URL from connect-src when undefined', () => {
        const header = buildCspHeader({ nonce: 'x' });
        expect(header).toContain("connect-src 'self'");
    });

    it('should include sentry report-uri when provided', () => {
        const header = buildCspHeader({ nonce: 'x', sentryReportUri: 'https://sentry.io/report' });
        expect(header).toContain('report-uri https://sentry.io/report');
    });

    it('should allow OpenStreetMap tile hosts in img-src and connect-src (SPEC-097)', () => {
        const header = buildCspHeader({ nonce: 'x' });
        expect(header).toContain('https://*.tile.openstreetmap.org');
        expect(header).toContain('https://*.openstreetmap.org');
    });

    it('should allow PostHog Cloud (US) hosts in script-src, connect-src, and img-src (SPEC-140)', () => {
        // Arrange
        const header = buildCspHeader({ nonce: 'x' });

        // Act / Assert — directive-scoped checks (not just substring presence
        // anywhere in the header) so accidental cross-directive leaks fail.
        const scriptSrc = header.split('; ').find((d) => d.startsWith('script-src ')) ?? '';
        const connectSrc = header.split('; ').find((d) => d.startsWith('connect-src ')) ?? '';
        const imgSrc = header.split('; ').find((d) => d.startsWith('img-src ')) ?? '';

        // script-src and connect-src need BOTH the ingestion host and the
        // assets host (PostHog loads sub-bundles from us-assets).
        expect(scriptSrc).toContain('https://us.i.posthog.com');
        expect(scriptSrc).toContain('https://us-assets.i.posthog.com');
        expect(connectSrc).toContain('https://us.i.posthog.com');
        expect(connectSrc).toContain('https://us-assets.i.posthog.com');

        // img-src only needs the ingestion host (1x1 pixel fallback origin).
        expect(imgSrc).toContain('https://us.i.posthog.com');
    });

    it('should not include report-uri when not provided', () => {
        const header = buildCspHeader({ nonce: 'x' });
        expect(header).not.toContain('report-uri');
    });

    it('should restrict img-src to specific domains', () => {
        const header = buildCspHeader({ nonce: 'x' });
        expect(header).toContain('img-src');
        // The CSP only allowlists the origins we actually fetch from (Cloudinary,
        // simpleicons, OpenStreetMap tiles, plus any apiUrl). It does NOT fall
        // back to a generic `data: https:` allowlist.
        expect(header).not.toContain("img-src 'self' data: https:");
    });

    it('should allowlist res.cloudinary.com in img-src', () => {
        const header = buildCspHeader({ nonce: 'x' });
        const imgSrc = header.split('; ').find((d) => d.startsWith('img-src'));
        expect(imgSrc).toBeDefined();
        expect(imgSrc).toContain('https://res.cloudinary.com');
    });

    it('should allowlist every entry of ALLOWED_REMOTE_HOSTS in img-src', () => {
        // Prevents drift: ALLOWED_REMOTE_HOSTS is the single source of truth
        // shared with astro.config.mjs image.remotePatterns and the SSRF guard.
        // Any host added there must also be reachable from CSP img-src,
        // otherwise the browser blocks the image and Sentry receives a report.
        const header = buildCspHeader({ nonce: 'x' });
        const imgSrc = header.split('; ').find((d) => d.startsWith('img-src ')) ?? '';
        for (const host of ALLOWED_REMOTE_HOSTS) {
            if (host === 'localhost') continue;
            expect(imgSrc).toContain(`https://${host}`);
        }
    });

    it('should use exact cloudinary hostname, not a wildcard', () => {
        const header = buildCspHeader({ nonce: 'x' });
        expect(header).not.toContain('https://*.cloudinary.com');
    });

    it('should allow blob: in img-src for AvatarUpload previews', () => {
        const header = buildCspHeader({ nonce: 'x' });
        const imgSrc = header.split('; ').find((d) => d.startsWith('img-src'));
        expect(imgSrc).toBeDefined();
        expect(imgSrc).toContain('blob:');
    });

    it('should allow inline style attributes via style-src-attr', () => {
        // Inline style="..." attributes (used for tokenized colors on cards
        // and per-card transition-delay in the stagger pattern) cannot use a
        // nonce by CSP spec. We override only -attr with 'unsafe-inline' so
        // <style> blocks remain nonce-gated.
        const header = buildCspHeader({ nonce: 'x' });
        const attrDirective = header.split('; ').find((d) => d.startsWith('style-src-attr ')) ?? '';
        expect(attrDirective).toContain("'unsafe-inline'");
    });

    it('should not leak unsafe-inline into directives other than style-src-attr', () => {
        // The lax override on -attr must NOT bleed into script-src, the main
        // style-src (which gates <style> blocks), or any other directive.
        const header = buildCspHeader({ nonce: 'x' });
        const directives = header.split('; ').filter((d) => !d.startsWith('style-src-attr '));
        for (const d of directives) {
            expect(d).not.toContain("'unsafe-inline'");
        }
    });

    // SPEC-047 (rewritten in SPEC-140): lock the script-src security
    // posture — self + nonce + strict-dynamic + NO 'unsafe-inline'. The
    // SPEC-047 original asserted exact-string equality which made any new
    // https: host (e.g. PostHog ingestion hosts in SPEC-140) regress the
    // test. With 'strict-dynamic' present, host allowlists in script-src
    // are IGNORED by browsers per CSP3, so additional https: tokens are
    // decoration / documentation — the security claim still holds.
    it('script-src must have self + nonce + strict-dynamic and no unsafe-inline', () => {
        const header = buildCspHeader({ nonce: 'abc123' });
        const scriptSrc = header.split('; ').find((d) => d.startsWith('script-src '));
        expect(scriptSrc).toBeDefined();
        expect(scriptSrc).toContain("'self'");
        expect(scriptSrc).toContain("'nonce-abc123'");
        expect(scriptSrc).toContain("'strict-dynamic'");
        expect(scriptSrc).not.toContain('unsafe-inline');
    });

    it('style-src must use nonce-based policy without unsafe-inline', () => {
        const header = buildCspHeader({ nonce: 'abc123' });
        const styleSrc = header.split('; ').find((d) => d.startsWith('style-src '));
        expect(styleSrc).toBeDefined();
        expect(styleSrc).toContain("'nonce-abc123'");
        expect(styleSrc).not.toContain('unsafe-inline');
    });

    // SPEC-046 GAP-046-12: lock the embed surface — we never embed anything,
    // and even if frame-ancestors blocks others from embedding us, frame-src
    // is the symmetric guard that stops us from embedding others. Together
    // they make the frame story explicit on both directions.
    it("must include frame-src 'none' (GAP-046-12)", () => {
        const header = buildCspHeader({ nonce: 'x' });
        const frameSrc = header.split('; ').find((d) => d.startsWith('frame-src '));
        expect(frameSrc).toBe("frame-src 'none'");
    });

    // SPEC-046 GAP-046-11 follow-up: the manual Cloudflare Web Analytics
    // snippet (BaseLayout.astro) loads beacon.min.js from
    // static.cloudflareinsights.com (handled by script-src strict-dynamic
    // + nonce), then POSTs Core Web Vitals telemetry to
    // cloudflareinsights.com — that endpoint must be reachable.
    it('must allowlist cloudflareinsights.com in connect-src for CF Web Analytics RUM beacon', () => {
        const header = buildCspHeader({ nonce: 'x' });
        const connectSrc = header.split('; ').find((d) => d.startsWith('connect-src '));
        expect(connectSrc).toBeDefined();
        expect(connectSrc).toContain('https://cloudflareinsights.com');
    });
});

// ---------------------------------------------------------------------------
// SPEC-113: Profile completion guard helpers
// ---------------------------------------------------------------------------

describe('isProfileCompletionRoute', () => {
    it('should return true for the completar-perfil route', () => {
        expect(isProfileCompletionRoute({ path: '/es/mi-cuenta/completar-perfil/' })).toBe(true);
    });

    it('should return true for sub-paths under completar-perfil', () => {
        expect(isProfileCompletionRoute({ path: '/es/mi-cuenta/completar-perfil/paso-2/' })).toBe(
            true
        );
    });

    it('should return true for all supported locales', () => {
        expect(isProfileCompletionRoute({ path: '/en/mi-cuenta/completar-perfil/' })).toBe(true);
        expect(isProfileCompletionRoute({ path: '/pt/mi-cuenta/completar-perfil/' })).toBe(true);
    });

    it('should return false for other mi-cuenta sub-routes', () => {
        expect(isProfileCompletionRoute({ path: '/es/mi-cuenta/perfil/' })).toBe(false);
        expect(isProfileCompletionRoute({ path: '/es/mi-cuenta/favoritos/' })).toBe(false);
    });

    it('should return false for the agregar-contrasena route', () => {
        expect(isProfileCompletionRoute({ path: '/es/mi-cuenta/agregar-contrasena/' })).toBe(false);
    });

    it('should return false for public routes', () => {
        expect(isProfileCompletionRoute({ path: '/es/alojamientos/' })).toBe(false);
    });

    it('should return false for empty path', () => {
        expect(isProfileCompletionRoute({ path: '' })).toBe(false);
    });
});

describe('isSetPasswordRoute', () => {
    it('should return true for the agregar-contrasena route', () => {
        expect(isSetPasswordRoute({ path: '/es/mi-cuenta/agregar-contrasena/' })).toBe(true);
    });

    it('should return true for all supported locales', () => {
        expect(isSetPasswordRoute({ path: '/en/mi-cuenta/agregar-contrasena/' })).toBe(true);
        expect(isSetPasswordRoute({ path: '/pt/mi-cuenta/agregar-contrasena/' })).toBe(true);
    });

    it('should return false for the completar-perfil route', () => {
        expect(isSetPasswordRoute({ path: '/es/mi-cuenta/completar-perfil/' })).toBe(false);
    });

    it('should return false for other mi-cuenta sub-routes', () => {
        expect(isSetPasswordRoute({ path: '/es/mi-cuenta/perfil/' })).toBe(false);
        expect(isSetPasswordRoute({ path: '/es/mi-cuenta/' })).toBe(false);
    });

    it('should return false for public routes', () => {
        expect(isSetPasswordRoute({ path: '/es/destinos/' })).toBe(false);
    });

    it('should return false for empty path', () => {
        expect(isSetPasswordRoute({ path: '' })).toBe(false);
    });
});

describe('isProfileCompletionRequiredSessionOptionalRoute', () => {
    it('returns true for /es/publicar/', () => {
        expect(isProfileCompletionRequiredSessionOptionalRoute({ path: '/es/publicar/' })).toBe(
            true
        );
    });

    it('returns true for /es/publicar/nueva/', () => {
        expect(
            isProfileCompletionRequiredSessionOptionalRoute({ path: '/es/publicar/nueva/' })
        ).toBe(true);
    });

    it('returns true across locales', () => {
        expect(
            isProfileCompletionRequiredSessionOptionalRoute({ path: '/en/publicar/nueva/' })
        ).toBe(true);
        expect(
            isProfileCompletionRequiredSessionOptionalRoute({ path: '/pt/publicar/nueva/' })
        ).toBe(true);
    });

    it('returns false for other session-optional segments (e.g. alojamientos)', () => {
        expect(isProfileCompletionRequiredSessionOptionalRoute({ path: '/es/alojamientos/' })).toBe(
            false
        );
        expect(isProfileCompletionRequiredSessionOptionalRoute({ path: '/es/feedback/' })).toBe(
            false
        );
    });

    it('returns false for protected routes (those go through isProtectedRoute)', () => {
        expect(isProfileCompletionRequiredSessionOptionalRoute({ path: '/es/mi-cuenta/' })).toBe(
            false
        );
    });

    it('returns false for public routes', () => {
        expect(isProfileCompletionRequiredSessionOptionalRoute({ path: '/es/' })).toBe(false);
        expect(isProfileCompletionRequiredSessionOptionalRoute({ path: '/' })).toBe(false);
    });

    it('returns false for empty path', () => {
        expect(isProfileCompletionRequiredSessionOptionalRoute({ path: '' })).toBe(false);
    });
});

describe('isProfileCompletionBypassRole', () => {
    it('should return true for admin role', () => {
        expect(isProfileCompletionBypassRole({ role: 'admin' })).toBe(true);
    });

    it('should return true for super_admin role', () => {
        expect(isProfileCompletionBypassRole({ role: 'super_admin' })).toBe(true);
    });

    it('should return false for regular user role', () => {
        expect(isProfileCompletionBypassRole({ role: 'user' })).toBe(false);
    });

    it('should return false for host role', () => {
        expect(isProfileCompletionBypassRole({ role: 'host' })).toBe(false);
    });

    it('should return false for empty role string', () => {
        expect(isProfileCompletionBypassRole({ role: '' })).toBe(false);
    });

    it('should be case-sensitive (Admin with capital A is not a bypass)', () => {
        expect(isProfileCompletionBypassRole({ role: 'Admin' })).toBe(false);
    });
});

describe('buildProfileCompletionRedirect', () => {
    it('should build correct URL for es locale', () => {
        expect(buildProfileCompletionRedirect({ locale: 'es' })).toBe(
            '/es/mi-cuenta/completar-perfil/'
        );
    });

    it('should build correct URL for en locale', () => {
        expect(buildProfileCompletionRedirect({ locale: 'en' })).toBe(
            '/en/mi-cuenta/completar-perfil/'
        );
    });

    it('should build correct URL for pt locale', () => {
        expect(buildProfileCompletionRedirect({ locale: 'pt' })).toBe(
            '/pt/mi-cuenta/completar-perfil/'
        );
    });

    it('should always end with a trailing slash', () => {
        const url = buildProfileCompletionRedirect({ locale: 'es' });
        expect(url.endsWith('/')).toBe(true);
    });
});

describe('buildSetPasswordRedirect', () => {
    it('should build correct URL for es locale', () => {
        expect(buildSetPasswordRedirect({ locale: 'es' })).toBe(
            '/es/mi-cuenta/agregar-contrasena/'
        );
    });

    it('should build correct URL for en locale', () => {
        expect(buildSetPasswordRedirect({ locale: 'en' })).toBe(
            '/en/mi-cuenta/agregar-contrasena/'
        );
    });

    it('should build correct URL for pt locale', () => {
        expect(buildSetPasswordRedirect({ locale: 'pt' })).toBe(
            '/pt/mi-cuenta/agregar-contrasena/'
        );
    });

    it('should always end with a trailing slash', () => {
        const url = buildSetPasswordRedirect({ locale: 'es' });
        expect(url.endsWith('/')).toBe(true);
    });
});
