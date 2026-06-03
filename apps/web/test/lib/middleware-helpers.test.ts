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

    it('should treat file-extension endpoints as static so trailing-slash enforcement skips them', () => {
        // Regression: /beta/search-index.json was 301-redirected to
        // /beta/search-index.json/ (which Astro never resolves), so the beta
        // docs search index returned 404 and the UI hung on "Cargando índice…".
        expect(isStaticAssetRoute({ path: '/beta/search-index.json' })).toBe(true);
        expect(isStaticAssetRoute({ path: '/sitemap-dynamic.xml' })).toBe(true);
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

    it('should prefix root path with default locale', () => {
        const result = buildLocaleRedirect({ restOfPath: '/' });
        expect(result).toBe('/es/');
    });

    it('should prefix nested path with default locale', () => {
        const result = buildLocaleRedirect({ restOfPath: '/destinos/concepcion/' });
        expect(result).toBe('/es/destinos/concepcion/');
    });

    it('should normalise a missing leading slash in restOfPath', () => {
        const result = buildLocaleRedirect({ restOfPath: 'alojamientos/' });
        expect(result).toBe('/es/alojamientos/');
    });
});

// ---------------------------------------------------------------------------
// REQ-19: Locale-prefix redirect MUST return 301 (permanent), not 302.
//
// The locale redirect (unprefixed path → /{locale}/... ) is a stable routing
// decision locked by URL strategy.  Google passes full link equity through
// 301s but not 302s.
//
// The middleware call site is `middleware.ts` around the `locale === null`
// branch (Step 4).  These tests document the contract so a reviewer can
// verify the status code from the middleware diff and these assertions guard
// the helper-level URL output that feeds the 301.
//
// Regression guard: `buildLoginRedirect` (used for the 302 auth redirect) is
// tested separately to confirm it still produces a different URL shape — that
// redirect must remain temporary (it redirects to the login page and includes
// a `returnUrl` param, semantically ephemeral).
// ---------------------------------------------------------------------------
describe('REQ-19: buildLocaleRedirect produces the URL fed to the 301 redirect', () => {
    it('returns a /{defaultLocale}/... path for an unprefixed slug path', () => {
        // This URL is passed to context.redirect(..., 301) in middleware.ts
        // (Step 4 — locale === null branch). Assert the URL shape is correct.
        const url = buildLocaleRedirect({ restOfPath: '/alojamientos/' });
        expect(url).toBe('/es/alojamientos/');
        // Must start with the default locale prefix (the permanent destination)
        expect(url.startsWith('/es/')).toBe(true);
    });

    it('returns /es/ for root path (the root → default locale redirect)', () => {
        // extractLocaleFromPath({ path: '/' }) returns { locale: null, restOfPath: '/' }
        // so buildLocaleRedirect({ restOfPath: '/' }) is the target of the 301.
        const url = buildLocaleRedirect({ restOfPath: '/' });
        expect(url).toBe('/es/');
    });

    it('never includes a returnUrl param (that would make it an auth redirect, not a locale redirect)', () => {
        // Regression guard: locale redirects MUST NOT carry returnUrl.
        // If this changes the caller is mixing up the two redirect types.
        const url = buildLocaleRedirect({ restOfPath: '/alojamientos/' });
        expect(url).not.toContain('returnUrl');
    });
});

describe('REQ-19 regression guard: buildLoginRedirect (auth redirect) must remain distinct from locale redirect', () => {
    it('auth redirect URL includes /auth/signin/ and a returnUrl param (keeps its 302 semantics)', () => {
        // The login redirect is a different call site in middleware.ts and MUST
        // remain a 302 (the user is redirected to log in and then back — ephemeral).
        // We verify it produces a structurally different URL so the two are never confused.
        const loginUrl = buildLoginRedirect({ locale: 'es', currentUrl: '/es/mi-cuenta/perfil/' });
        expect(loginUrl).toContain('/auth/signin/');
        expect(loginUrl).toContain('returnUrl=');
        // It must NOT look like a locale redirect (no plain /es/... without auth path)
        expect(loginUrl.startsWith('/es/auth/')).toBe(true);
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

    it('keeps https://*.sentry.io in connect-src when the tunnel is OFF (default)', () => {
        // SPEC-181 follow-up: with no first-party Sentry tunnel, the browser SDK
        // reports directly to *.sentry.io, so the CSP must still allow it.
        const header = buildCspHeader({ nonce: 'x' });
        const connectSrc = header.split('; ').find((d) => d.startsWith('connect-src ')) ?? '';
        expect(connectSrc).toContain('https://*.sentry.io');
    });

    it('drops https://*.sentry.io from connect-src when the tunnel is ON', () => {
        // SPEC-181 follow-up: when PUBLIC_SENTRY_TUNNEL is set, envelopes go
        // through the same-origin /api/event path (covered by 'self'); the
        // external host must NOT appear or ad-blockers regain a host to block.
        const header = buildCspHeader({ nonce: 'x', sentryTunnelEnabled: true });
        const connectSrc = header.split('; ').find((d) => d.startsWith('connect-src ')) ?? '';
        expect(connectSrc).not.toContain('sentry.io');
        // 'self' still covers the same-origin tunnel path.
        expect(connectSrc).toContain("'self'");
    });

    it('should allow OpenStreetMap tile hosts in img-src and connect-src (SPEC-097)', () => {
        const header = buildCspHeader({ nonce: 'x' });
        expect(header).toContain('https://*.tile.openstreetmap.org');
        expect(header).toContain('https://*.openstreetmap.org');
    });

    it('should NOT include external PostHog hosts — analytics is proxied first-party via /api/relay (SPEC-181)', () => {
        // Arrange
        const header = buildCspHeader({ nonce: 'x' });

        // Act / Assert — directive-scoped checks (not just substring presence
        // anywhere in the header) so accidental cross-directive leaks fail.
        const scriptSrc = header.split('; ').find((d) => d.startsWith('script-src ')) ?? '';
        const connectSrc = header.split('; ').find((d) => d.startsWith('connect-src ')) ?? '';
        const imgSrc = header.split('; ').find((d) => d.startsWith('img-src ')) ?? '';

        // SPEC-181: PostHog ingestion + assets go through the same-origin /api/relay
        // proxy (covered by 'self'). The external hosts must NOT appear in any
        // directive, or ad-blockers regain a host to block. Replaces the SPEC-140
        // allowlist; guards against accidental re-introduction.
        expect(scriptSrc).not.toContain('us.i.posthog.com');
        expect(scriptSrc).not.toContain('us-assets.i.posthog.com');
        expect(connectSrc).not.toContain('us.i.posthog.com');
        expect(connectSrc).not.toContain('us-assets.i.posthog.com');
        expect(imgSrc).not.toContain('us.i.posthog.com');

        // script-src stays on strict-dynamic with the request nonce.
        expect(scriptSrc).toContain("'nonce-x' 'strict-dynamic'");
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

    it('should allowlist Google and Facebook OAuth avatar hosts in img-src', () => {
        // Better Auth stores the OAuth-returned picture URL on user.image and
        // @repo/auth-ui renders it via plain <img>. Without these hosts the
        // navbar avatar gets blocked for signed-in users (or generates CSP
        // reports while the policy is Report-Only).
        const header = buildCspHeader({ nonce: 'x' });
        const imgSrc = header.split('; ').find((d) => d.startsWith('img-src ')) ?? '';
        expect(imgSrc).toContain('https://lh3.googleusercontent.com');
        expect(imgSrc).toContain('https://platform-lookaside.fbsbx.com');
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

    it('should allow Astro client runtime inline style via SHA-256 hash', () => {
        // The Astro client runtime injects an inline <style> at hydration with
        // the fixed content `astro-island,astro-slot,astro-static-slot{display:contents}`.
        // Hash-allowed in style-src because the injection happens via JS after
        // the middleware nonce rewrite. The hash is stable (CSS is hardcoded
        // in Astro's runtime), so a regression here would indicate Astro
        // upstream changed the inlined CSS — bump the hash and update the
        // comment in buildCspHeader.
        const header = buildCspHeader({ nonce: 'x' });
        const styleSrc = header.split('; ').find((d) => d.startsWith('style-src ')) ?? '';
        expect(styleSrc).toContain("'sha256-vv9IoKo7BSLbWcUHr3tNmfNVmm5L/9Cfn2H6LMk7/ow='");
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
