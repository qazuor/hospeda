/**
 * @file middleware-helpers.test.ts
 * @description Unit tests for middleware helper functions.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALLOWED_REMOTE_HOSTS } from '../../src/lib/media';
import {
    buildAdminLoginRedirect,
    buildChangePasswordRedirect,
    buildCspHeader,
    buildLocaleRedirect,
    buildLoginRedirect,
    buildProfileCompletionRedirect,
    buildSetPasswordRedirect,
    extractLocaleFromPath,
    IMAGE_ENDPOINT_CACHE_CONTROL,
    isAdminBypassUser,
    isAuthRoute,
    isChangePasswordRoute,
    isImageEndpointRoute,
    isProfileCompletionBypassRole,
    isProfileCompletionRequiredSessionOptionalRoute,
    isProfileCompletionRoute,
    isProtectedRoute,
    isServerIslandRoute,
    isSessionOptionalRoute,
    isSetPasswordRoute,
    isStaticAssetRoute,
    parseSessionUser,
    requestHasSessionCookie,
    resolveSentryReportUri
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

    // Regression: the first segment used to be consumed unconditionally when it
    // was not a supported locale, so a path with NO locale segment at all lost
    // its first segment. `/destinos/colon/` redirected to `/es/colon/`, a 404.
    // The two cases are distinguished by SHAPE: a language tag is two letters
    // (optionally with a region), a route segment is a word.
    it('should keep the whole path when the first segment is not shaped like a locale', () => {
        expect(extractLocaleFromPath({ path: '/destinos/colon/' })).toEqual({
            locale: null,
            restOfPath: '/destinos/colon/'
        });
        expect(extractLocaleFromPath({ path: '/alojamientos/' })).toEqual({
            locale: null,
            restOfPath: '/alojamientos/'
        });
    });

    it('should still strip a segment that IS shaped like a locale but is unsupported', () => {
        // `/fr/...` is a genuine unsupported locale: the visitor asked for
        // French, so the segment is replaced rather than kept.
        expect(extractLocaleFromPath({ path: '/fr/alojamientos/' })).toEqual({
            locale: null,
            restOfPath: '/alojamientos/'
        });
        expect(extractLocaleFromPath({ path: '/it/' })).toEqual({
            locale: null,
            restOfPath: '/'
        });
    });

    it('should treat a regional language tag as a locale segment', () => {
        expect(extractLocaleFromPath({ path: '/en-US/alojamientos/' })).toEqual({
            locale: null,
            restOfPath: '/alojamientos/'
        });
        expect(extractLocaleFromPath({ path: '/pt-BR/eventos/' })).toEqual({
            locale: null,
            restOfPath: '/eventos/'
        });
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
        // Regression: a `.json`-extension endpoint was 301-redirected to a
        // trailing-slash form (which Astro never resolves), causing it to 404.
        expect(isStaticAssetRoute({ path: '/es/search-index.json' })).toBe(true);
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

describe('requestHasSessionCookie', () => {
    it('returns true when the plain (dev) session cookie is present', () => {
        expect(requestHasSessionCookie('better-auth.session_token=abc123')).toBe(true);
    });

    it('returns true when the __Secure-prefixed (production) session cookie is present', () => {
        expect(requestHasSessionCookie('__Secure-better-auth.session_token=abc123')).toBe(true);
    });

    it('returns true when the session cookie is present alongside other cookies', () => {
        expect(
            requestHasSessionCookie('theme=dark; better-auth.session_token=abc123; locale=es')
        ).toBe(true);
    });

    it('returns false when only unrelated cookies are present', () => {
        expect(requestHasSessionCookie('theme=dark; locale=es')).toBe(false);
    });

    it('returns false for an empty cookie header', () => {
        expect(requestHasSessionCookie('')).toBe(false);
    });

    it('returns false for a null cookie header', () => {
        expect(requestHasSessionCookie(null)).toBe(false);
    });

    it('does not false-positive on a cookie name that merely contains the substring', () => {
        // e.g. a hypothetical "not-better-auth.session_token" or a value
        // containing the string must NOT match — only an exact cookie name.
        expect(requestHasSessionCookie('foo-better-auth.session_token=abc123')).toBe(false);
        expect(requestHasSessionCookie('other=better-auth.session_token-lookalike-value')).toBe(
            false
        );
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

describe('isImageEndpointRoute (HOS-160 lever C)', () => {
    it('detects /_image requests', () => {
        expect(isImageEndpointRoute({ path: '/_image' })).toBe(true);
        expect(isImageEndpointRoute({ path: '/_image/?href=%2Fhero.jpg&w=800&f=webp' })).toBe(true);
    });

    it('returns false for other static and page routes', () => {
        expect(isImageEndpointRoute({ path: '/_astro/index.abc.js' })).toBe(false);
        expect(isImageEndpointRoute({ path: '/_server-islands/AuthSection' })).toBe(false);
        expect(isImageEndpointRoute({ path: '/es/' })).toBe(false);
        expect(isImageEndpointRoute({ path: '' })).toBe(false);
    });

    it('exposes an immutable, long-lived Cache-Control value', () => {
        expect(IMAGE_ENDPOINT_CACHE_CONTROL).toContain('immutable');
        expect(IMAGE_ENDPOINT_CACHE_CONTROL).toContain('max-age=31536000');
    });
});

describe('buildLoginRedirect', () => {
    it('should build login URL with encoded return path', () => {
        const result = buildLoginRedirect({ locale: 'es', currentUrl: '/es/mi-cuenta/perfil/' });
        expect(result).toBe('/es/auth/signin/?returnUrl=%2Fes%2Fmi-cuenta%2Fperfil%2F');
    });
});

describe('buildAdminLoginRedirect', () => {
    it('builds an absolute web signin URL with the admin URL as encoded callbackUrl', () => {
        const result = buildAdminLoginRedirect({
            siteUrl: 'https://hospeda.com.ar',
            locale: 'es',
            adminUrl: 'https://admin.hospeda.com.ar/dashboard'
        });
        expect(result).toBe(
            'https://hospeda.com.ar/es/auth/signin/?callbackUrl=https%3A%2F%2Fadmin.hospeda.com.ar%2Fdashboard'
        );
    });

    it('respects the requested locale', () => {
        const result = buildAdminLoginRedirect({
            siteUrl: 'https://hospeda.com.ar',
            locale: 'en',
            adminUrl: 'https://admin.hospeda.com.ar'
        });
        expect(result).toBe(
            'https://hospeda.com.ar/en/auth/signin/?callbackUrl=https%3A%2F%2Fadmin.hospeda.com.ar'
        );
    });

    it('strips a trailing slash on siteUrl so the path is not doubled', () => {
        const result = buildAdminLoginRedirect({
            siteUrl: 'https://hospeda.com.ar/',
            locale: 'es',
            adminUrl: 'https://admin.hospeda.com.ar'
        });
        expect(result).toBe(
            'https://hospeda.com.ar/es/auth/signin/?callbackUrl=https%3A%2F%2Fadmin.hospeda.com.ar'
        );
    });

    it('works with a localhost dev siteUrl + admin URL', () => {
        const result = buildAdminLoginRedirect({
            siteUrl: 'http://localhost:4321',
            locale: 'es',
            adminUrl: 'http://localhost:3000/dashboard'
        });
        expect(result).toBe(
            'http://localhost:4321/es/auth/signin/?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Fdashboard'
        );
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

    // Regression: this helper was the only redirect builder in the middleware
    // that dropped the query string. Steps 3, 3.1 and 3.2 all append
    // `context.url.search`; Step 4 did not, so every locale-less URL lost its
    // parameters in the 301 — `/?utm_source=newsletter` arrived at a bare
    // `/es/` and the campaign attribution was gone before analytics saw it.
    it('should preserve the query string when one is supplied', () => {
        const result = buildLocaleRedirect({
            restOfPath: '/',
            search: '?utm_source=newsletter&utm_campaign=verano'
        });
        expect(result).toBe('/es/?utm_source=newsletter&utm_campaign=verano');
    });

    it('should preserve the query string on a nested path', () => {
        const result = buildLocaleRedirect({ restOfPath: '/alojamientos/', search: '?page=2' });
        expect(result).toBe('/es/alojamientos/?page=2');
    });

    it('should emit no stray separator when there is no query string', () => {
        // `URL.search` is '' (not undefined) for a query-less URL, so the empty
        // case is the common one and must not produce a trailing '?'.
        expect(buildLocaleRedirect({ restOfPath: '/', search: '' })).toBe('/es/');
        expect(buildLocaleRedirect({ restOfPath: '/' })).toBe('/es/');
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

/**
 * A response with no inline blocks. Most `buildCspHeader` assertions below are
 * about host allowlists and static directives, which are independent of the
 * per-response hashes — spelling out empty lists at every call site would bury
 * what each test is actually checking.
 */
const NO_HASHES = { scriptHashes: [] as readonly string[], styleHashes: [] as readonly string[] };

describe('buildCspHeader', () => {
    it('should emit the supplied inline-script hashes as script-src sources', () => {
        const header = buildCspHeader({
            scriptHashes: ['sha256-SCRIPTHASH'],
            styleHashes: []
        });
        const scriptSrc = header.split('; ').find((d) => d.startsWith('script-src ')) ?? '';
        expect(scriptSrc).toContain("'sha256-SCRIPTHASH'");
    });

    it('should emit the supplied inline-style hashes as style-src sources', () => {
        const header = buildCspHeader({ scriptHashes: [], styleHashes: ['sha256-STYLEHASH'] });
        const styleSrc = header.split('; ').find((d) => d.startsWith('style-src ')) ?? '';
        expect(styleSrc).toContain("'sha256-STYLEHASH'");
    });

    it('should not put script hashes in style-src, nor style hashes in script-src', () => {
        const header = buildCspHeader({
            scriptHashes: ['sha256-SCRIPTHASH'],
            styleHashes: ['sha256-STYLEHASH']
        });
        const scriptSrc = header.split('; ').find((d) => d.startsWith('script-src ')) ?? '';
        const styleSrc = header.split('; ').find((d) => d.startsWith('style-src ')) ?? '';
        expect(scriptSrc).not.toContain('STYLEHASH');
        expect(styleSrc).not.toContain('SCRIPTHASH');
    });

    it('should leave no dangling separator when a hash list is empty', () => {
        const header = buildCspHeader({ scriptHashes: [], styleHashes: [] });
        expect(header).not.toContain('  ');
        expect(header).not.toContain(' ;');
    });

    it('should include API URL in connect-src when provided', () => {
        const header = buildCspHeader({ ...NO_HASHES, apiUrl: 'https://api.example.com' });
        expect(header).toContain('https://api.example.com');
    });

    it('should omit API URL from connect-src when empty', () => {
        const header = buildCspHeader({ ...NO_HASHES, apiUrl: '' });
        expect(header).not.toContain("connect-src 'self'  ");
    });

    it('should omit API URL from connect-src when undefined', () => {
        const header = buildCspHeader({ ...NO_HASHES });
        expect(header).toContain("connect-src 'self'");
    });

    it('should include sentry report-uri when provided', () => {
        const header = buildCspHeader({
            ...NO_HASHES,
            sentryReportUri: 'https://sentry.io/report'
        });
        expect(header).toContain('report-uri https://sentry.io/report');
    });

    it('keeps https://*.sentry.io in connect-src when the tunnel is OFF (default)', () => {
        // SPEC-181 follow-up: with no first-party Sentry tunnel, the browser SDK
        // reports directly to *.sentry.io, so the CSP must still allow it.
        const header = buildCspHeader({ ...NO_HASHES });
        const connectSrc = header.split('; ').find((d) => d.startsWith('connect-src ')) ?? '';
        expect(connectSrc).toContain('https://*.sentry.io');
    });

    it('drops https://*.sentry.io from connect-src when the tunnel is ON', () => {
        // SPEC-181 follow-up: when PUBLIC_SENTRY_TUNNEL is set, envelopes go
        // through the same-origin /api/event path (covered by 'self'); the
        // external host must NOT appear or ad-blockers regain a host to block.
        const header = buildCspHeader({ ...NO_HASHES, sentryTunnelEnabled: true });
        const connectSrc = header.split('; ').find((d) => d.startsWith('connect-src ')) ?? '';
        expect(connectSrc).not.toContain('sentry.io');
        // 'self' still covers the same-origin tunnel path.
        expect(connectSrc).toContain("'self'");
    });

    it('should allow OpenStreetMap tile hosts in img-src and connect-src (SPEC-097)', () => {
        const header = buildCspHeader({ ...NO_HASHES });
        expect(header).toContain('https://*.tile.openstreetmap.org');
        expect(header).toContain('https://*.openstreetmap.org');
    });

    it('should NOT include external PostHog hosts — analytics is proxied first-party via /api/relay (SPEC-181)', () => {
        // Arrange
        const header = buildCspHeader({ ...NO_HASHES });

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

        // script-src carries 'self' (which covers the same-origin /api/relay
        // path the PostHog bootstrapper injects its SDK from).
        expect(scriptSrc).toContain("'self'");
    });

    it('should not include report-uri when not provided', () => {
        const header = buildCspHeader({ ...NO_HASHES });
        expect(header).not.toContain('report-uri');
    });

    it('should restrict img-src to specific domains', () => {
        const header = buildCspHeader({ ...NO_HASHES });
        expect(header).toContain('img-src');
        // The CSP only allowlists the origins we actually fetch from (Cloudinary,
        // simpleicons, OpenStreetMap tiles, plus any apiUrl). It does NOT fall
        // back to a generic `data: https:` allowlist.
        expect(header).not.toContain("img-src 'self' data: https:");
    });

    it('should allowlist res.cloudinary.com in img-src', () => {
        const header = buildCspHeader({ ...NO_HASHES });
        const imgSrc = header.split('; ').find((d) => d.startsWith('img-src'));
        expect(imgSrc).toBeDefined();
        expect(imgSrc).toContain('https://res.cloudinary.com');
    });

    it('should allowlist every entry of ALLOWED_REMOTE_HOSTS in img-src', () => {
        // Prevents drift: ALLOWED_REMOTE_HOSTS is the single source of truth
        // shared with astro.config.mjs image.remotePatterns and the SSRF guard.
        // Any host added there must also be reachable from CSP img-src,
        // otherwise the browser blocks the image and Sentry receives a report.
        const header = buildCspHeader({ ...NO_HASHES });
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
        const header = buildCspHeader({ ...NO_HASHES });
        const imgSrc = header.split('; ').find((d) => d.startsWith('img-src ')) ?? '';
        expect(imgSrc).toContain('https://lh3.googleusercontent.com');
        expect(imgSrc).toContain('https://platform-lookaside.fbsbx.com');
    });

    it('should use exact cloudinary hostname, not a wildcard', () => {
        const header = buildCspHeader({ ...NO_HASHES });
        expect(header).not.toContain('https://*.cloudinary.com');
    });

    it('should allow blob: in img-src for AvatarUpload previews', () => {
        const header = buildCspHeader({ ...NO_HASHES });
        const imgSrc = header.split('; ').find((d) => d.startsWith('img-src'));
        expect(imgSrc).toBeDefined();
        expect(imgSrc).toContain('blob:');
    });

    it('should allow Astro client runtime inline style via SHA-256 hash', () => {
        // The Astro client runtime injects an inline <style> at hydration with
        // the fixed content `astro-island,astro-slot,astro-static-slot{display:contents}`.
        // Hash-allowed in style-src because the injection happens via JS after
        // the response was sent, so the walker never sees it. The hash is
        // stable (CSS is hardcoded
        // in Astro's runtime), so a regression here would indicate Astro
        // upstream changed the inlined CSS — bump the hash and update the
        // comment in buildCspHeader.
        const header = buildCspHeader({ ...NO_HASHES });
        const styleSrc = header.split('; ').find((d) => d.startsWith('style-src ')) ?? '';
        expect(styleSrc).toContain("'sha256-vv9IoKo7BSLbWcUHr3tNmfNVmm5L/9Cfn2H6LMk7/ow='");
    });

    it('should allow inline style attributes via style-src-attr', () => {
        // Inline style="..." attributes (used for tokenized colors on cards
        // and per-card transition-delay in the stagger pattern) cannot use a
        // hash by CSP spec. We override only -attr with 'unsafe-inline' so
        // <style> blocks remain hash-gated.
        const header = buildCspHeader({ ...NO_HASHES });
        const attrDirective = header.split('; ').find((d) => d.startsWith('style-src-attr ')) ?? '';
        expect(attrDirective).toContain("'unsafe-inline'");
    });

    it('should not leak unsafe-inline into directives other than style-src-attr', () => {
        // The lax override on -attr must NOT bleed into script-src, the main
        // style-src (which gates <style> blocks), or any other directive.
        const header = buildCspHeader({ ...NO_HASHES });
        const directives = header.split('; ').filter((d) => !d.startsWith('style-src-attr '));
        for (const d of directives) {
            expect(d).not.toContain("'unsafe-inline'");
        }
    });

    // SPEC-047 (rewritten in SPEC-140, again in HOS-369 WB0-1): lock the
    // script-src security posture — self + per-response content hashes + NO
    // 'unsafe-inline' and NO 'strict-dynamic'. The SPEC-047 original asserted
    // exact-string equality which made any new https: host (e.g. PostHog
    // ingestion hosts in SPEC-140) regress the test.
    it('script-src must have self + the response hashes and no unsafe-inline', () => {
        const header = buildCspHeader({ scriptHashes: ['sha256-abc123'], styleHashes: [] });
        const scriptSrc = header.split('; ').find((d) => d.startsWith('script-src '));
        expect(scriptSrc).toBeDefined();
        expect(scriptSrc).toContain("'self'");
        expect(scriptSrc).toContain("'sha256-abc123'");
        expect(scriptSrc).not.toContain('unsafe-inline');
    });

    it("script-src must NOT carry 'strict-dynamic' — it would make 'self' inert (HOS-369 D-9)", () => {
        // With 'strict-dynamic', browsers ignore 'self' and every host source,
        // allowing only nonce/hash-tagged scripts. A hash cannot vouch for an
        // external <script src> (that needs `integrity`, which Astro does not
        // emit), so every /_astro/*.js island bundle would be blocked.
        const header = buildCspHeader({ scriptHashes: ['sha256-abc123'], styleHashes: [] });
        const scriptSrc = header.split('; ').find((d) => d.startsWith('script-src ')) ?? '';
        expect(scriptSrc).not.toContain("'strict-dynamic'");
    });

    it('style-src must use hash-based policy without unsafe-inline', () => {
        const header = buildCspHeader({ scriptHashes: [], styleHashes: ['sha256-abc123'] });
        const styleSrc = header.split('; ').find((d) => d.startsWith('style-src '));
        expect(styleSrc).toBeDefined();
        expect(styleSrc).toContain("'sha256-abc123'");
        expect(styleSrc).not.toContain('unsafe-inline');
    });

    it('no directive may carry a nonce source — the migration removed them (HOS-369 D-9)', () => {
        // A nonce cached at the edge is a static, publicly readable token for
        // the whole TTL. See spec §5.13.
        const header = buildCspHeader({
            scriptHashes: ['sha256-abc123'],
            styleHashes: ['sha256-def456']
        });
        expect(header).not.toContain("'nonce-");
    });

    // SPEC-046 GAP-046-12 + SPEC-301: lock the embed surface. The ONLY origin we
    // embed is Cloudflare Turnstile's challenge iframe (feedback form), which must
    // be allowlisted here because 'strict-dynamic' does not govern frames. Every
    // other embed origin stays blocked, and frame-ancestors 'none' still stops
    // others from embedding us — the frame story stays explicit in both directions.
    it('must restrict frame-src to the Cloudflare Turnstile host only (GAP-046-12, SPEC-301)', () => {
        const header = buildCspHeader({ ...NO_HASHES });
        const frameSrc = header.split('; ').find((d) => d.startsWith('frame-src '));
        expect(frameSrc).toBe('frame-src https://challenges.cloudflare.com');
    });

    // SPEC-301 regression: the feedback form's Turnstile widget injects its
    // script from https://challenges.cloudflare.com — a cross-origin host that
    // 'self' does not cover, so it must appear in script-src explicitly.
    it('must allowlist the Cloudflare Turnstile host in script-src (SPEC-301)', () => {
        const header = buildCspHeader({ ...NO_HASHES });
        const scriptSrc = header.split('; ').find((d) => d.startsWith('script-src ')) ?? '';
        expect(scriptSrc).toContain('https://challenges.cloudflare.com');
    });

    // SPEC-046 GAP-046-11 follow-up: the manual Cloudflare Web Analytics
    // snippet (BaseLayout.astro) loads beacon.min.js from
    // static.cloudflareinsights.com, then POSTs Core Web Vitals telemetry to
    // cloudflareinsights.com. TWO different hosts in TWO different directives;
    // both are required or the beacon dies silently (HOS-369 WB0-1 — it used to
    // ride on 'strict-dynamic' via the nonce stamped on external tags).
    it('must allowlist static.cloudflareinsights.com in script-src for the CF Web Analytics beacon', () => {
        const header = buildCspHeader({ ...NO_HASHES });
        const scriptSrc = header.split('; ').find((d) => d.startsWith('script-src ')) ?? '';
        expect(scriptSrc).toContain('https://static.cloudflareinsights.com');
    });

    it('must allowlist cloudflareinsights.com in connect-src for CF Web Analytics RUM beacon', () => {
        const header = buildCspHeader({ ...NO_HASHES });
        const connectSrc = header.split('; ').find((d) => d.startsWith('connect-src '));
        expect(connectSrc).toBeDefined();
        expect(connectSrc).toContain('https://cloudflareinsights.com');
    });
});

describe('resolveSentryReportUri (Sentry prod hardening — dedicated hospeda-csp project)', () => {
    it('prefers the dedicated CSP report-uri when set', () => {
        const result = resolveSentryReportUri({
            sentryDsn: 'https://key@o123.ingest.sentry.io/456',
            dedicatedCspReportUri:
                'https://o999.ingest.us.sentry.io/api/789/security/?sentry_key=abc'
        });
        expect(result).toBe('https://o999.ingest.us.sentry.io/api/789/security/?sentry_key=abc');
    });

    it('falls back to the app DSN-derived report-uri when the dedicated var is unset', () => {
        const result = resolveSentryReportUri({
            sentryDsn: 'https://key@o123.ingest.sentry.io/456',
            dedicatedCspReportUri: undefined
        });
        expect(result).toBe('https://o123.ingest.sentry.io/api/456/security/?sentry_key=key');
    });

    it('returns null when neither is configured (CSP still emitted, just without report-uri)', () => {
        const result = resolveSentryReportUri({
            sentryDsn: undefined,
            dedicatedCspReportUri: undefined
        });
        expect(result).toBeNull();
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

describe('isSessionOptionalRoute', () => {
    // HOS-690: the commerce vertical landings ("Publicá tu restaurante" /
    // "Publicá tu experiencia") lost the CommerceLead form — the page now
    // sells the vertical with its own static benefits/price/FAQ content
    // instead of a lead form — so neither reads `Astro.locals.user` any more.
    // They moved OFF this list and onto `CACHEABLE_ROUTE_FAMILIES` in
    // `test/lib/cacheable-routes-parse-no-session.guard.test.ts`. Previously
    // (HOS-295) both were listed here because the CommerceLead island needed
    // the signed-in visitor's name/email prop, which only the middleware
    // populating `Astro.locals.user` on a session-optional route could supply.
    it('returns false for the former commerce lead pages (now cacheable)', () => {
        expect(isSessionOptionalRoute({ path: '/es/publicar-restaurante/' })).toBe(false);
        expect(isSessionOptionalRoute({ path: '/es/publicar-experiencia/' })).toBe(false);
    });

    it('returns false for the former commerce lead pages across locales', () => {
        expect(isSessionOptionalRoute({ path: '/en/publicar-restaurante/' })).toBe(false);
        expect(isSessionOptionalRoute({ path: '/pt/publicar-experiencia/' })).toBe(false);
    });

    it('does not treat `publicar` as a prefix match for other publicar-* segments', () => {
        // The check is an exact segment comparison, so `publicar` alone must
        // never stand in for a different `publicar-*` segment.
        expect(isSessionOptionalRoute({ path: '/es/publicar/' })).toBe(true);
        expect(isSessionOptionalRoute({ path: '/es/publicar-otra-cosa/' })).toBe(false);
    });

    it('returns true for the segments that still need the session', () => {
        expect(isSessionOptionalRoute({ path: '/es/feedback/' })).toBe(true);
        expect(isSessionOptionalRoute({ path: '/es/guest/' })).toBe(true);
    });

    it('returns FALSE for the cacheable catalog families (HOS-369 W1-2a)', () => {
        // Inverted: these six used to be session-optional because their pages
        // needed the visitor. Wave B0 moved all of that into the browser, and
        // they were removed — because parsing the session here is what lets the
        // SHELL (Header/Footer/BaseLayout) bake the visitor's name and e-mail
        // into island props, i.e. into the HTML an edge cache would then hand
        // to the next visitor. See
        // test/lib/cacheable-routes-parse-no-session.guard.test.ts.
        for (const family of [
            'alojamientos',
            'destinos',
            'eventos',
            'publicaciones',
            'gastronomia',
            'experiencias'
        ]) {
            expect(
                isSessionOptionalRoute({ path: `/es/${family}/` }),
                `${family} must not parse the session — it is edge-cacheable`
            ).toBe(false);
        }
    });

    it('returns false for fully public routes', () => {
        expect(isSessionOptionalRoute({ path: '/es/' })).toBe(false);
        expect(isSessionOptionalRoute({ path: '/es/contacto/' })).toBe(false);
        expect(isSessionOptionalRoute({ path: '/' })).toBe(false);
    });

    it('returns false for empty path', () => {
        expect(isSessionOptionalRoute({ path: '' })).toBe(false);
    });
});

describe('isProfileCompletionRequiredSessionOptionalRoute', () => {
    // HOS-295 decision: the commerce lead pages are deliberately NOT added to
    // `PROFILE_COMPLETION_REQUIRED_SESSION_OPTIONAL_SEGMENTS`. They are a
    // top-of-funnel capture form that works fully anonymously; bouncing a
    // signed-in visitor with an incomplete profile away from it would leave
    // them strictly worse off than a logged-out one, who can just submit.
    it('returns false for the commerce lead pages', () => {
        expect(
            isProfileCompletionRequiredSessionOptionalRoute({ path: '/es/publicar-restaurante/' })
        ).toBe(false);
        expect(
            isProfileCompletionRequiredSessionOptionalRoute({ path: '/es/publicar-experiencia/' })
        ).toBe(false);
    });

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
        expect(isProfileCompletionBypassRole({ roles: ['admin'] })).toBe(true);
    });

    it('should return true for super_admin role', () => {
        expect(isProfileCompletionBypassRole({ roles: ['super_admin'] })).toBe(true);
    });

    it('should return false for regular user role', () => {
        expect(isProfileCompletionBypassRole({ roles: ['user'] })).toBe(false);
    });

    it('should return false for host role', () => {
        expect(isProfileCompletionBypassRole({ roles: ['host'] })).toBe(false);
    });

    it('should return false for an empty role set', () => {
        expect(isProfileCompletionBypassRole({ roles: [] })).toBe(false);
        expect(isProfileCompletionBypassRole({ roles: [''] })).toBe(false);
    });

    it('should be case-sensitive (Admin with capital A is not a bypass)', () => {
        expect(isProfileCompletionBypassRole({ roles: ['Admin'] })).toBe(false);
    });

    // HOS-296: the predicate takes the whole role SET and matches on "holds a
    // bypass role", so a bypass hat still wins when it arrives alongside
    // several non-bypass hats.
    it('returns true when a bypass role is one of several held roles', () => {
        expect(isProfileCompletionBypassRole({ roles: ['user', 'host', 'admin'] })).toBe(true);
    });

    it('returns false when no held role is a bypass role', () => {
        expect(isProfileCompletionBypassRole({ roles: ['user', 'host', 'commerce_owner'] })).toBe(
            false
        );
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

// ---------------------------------------------------------------------------
// SPEC-239 T-055: isChangePasswordRoute + buildChangePasswordRedirect
// ---------------------------------------------------------------------------

describe('isChangePasswordRoute', () => {
    it('should return true for the cambiar-contrasena route', () => {
        expect(isChangePasswordRoute({ path: '/es/mi-cuenta/cambiar-contrasena/' })).toBe(true);
    });

    it('should return true for all supported locales', () => {
        expect(isChangePasswordRoute({ path: '/en/mi-cuenta/cambiar-contrasena/' })).toBe(true);
        expect(isChangePasswordRoute({ path: '/pt/mi-cuenta/cambiar-contrasena/' })).toBe(true);
    });

    it('should return true for sub-paths under cambiar-contrasena', () => {
        expect(isChangePasswordRoute({ path: '/es/mi-cuenta/cambiar-contrasena/confirmar/' })).toBe(
            true
        );
    });

    it('should return false for the agregar-contrasena route', () => {
        expect(isChangePasswordRoute({ path: '/es/mi-cuenta/agregar-contrasena/' })).toBe(false);
    });

    it('should return false for the completar-perfil route', () => {
        expect(isChangePasswordRoute({ path: '/es/mi-cuenta/completar-perfil/' })).toBe(false);
    });

    it('should return false for the mi-cuenta root', () => {
        expect(isChangePasswordRoute({ path: '/es/mi-cuenta/' })).toBe(false);
    });

    it('should return false for public routes', () => {
        expect(isChangePasswordRoute({ path: '/es/destinos/' })).toBe(false);
    });

    it('should return false for empty path', () => {
        expect(isChangePasswordRoute({ path: '' })).toBe(false);
    });
});

describe('buildChangePasswordRedirect', () => {
    it('should build correct URL for es locale', () => {
        expect(buildChangePasswordRedirect({ locale: 'es' })).toBe(
            '/es/mi-cuenta/cambiar-contrasena/'
        );
    });

    it('should build correct URL for en locale', () => {
        expect(buildChangePasswordRedirect({ locale: 'en' })).toBe(
            '/en/mi-cuenta/cambiar-contrasena/'
        );
    });

    it('should build correct URL for pt locale', () => {
        expect(buildChangePasswordRedirect({ locale: 'pt' })).toBe(
            '/pt/mi-cuenta/cambiar-contrasena/'
        );
    });

    it('should always end with a trailing slash', () => {
        const url = buildChangePasswordRedirect({ locale: 'es' });
        expect(url.endsWith('/')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// SPEC-249 T-020 / T-023 — commerce area is subject to the force-password gate
// ---------------------------------------------------------------------------

/**
 * The web middleware redirects a `mustChangePassword` user away from any
 * protected route that is NOT the change-password route itself (avoiding a
 * redirect loop). These assertions verify that the commerce self-service area
 * (`/[lang]/mi-cuenta/comercio/...`) falls inside that gated set — so a freshly
 * provisioned COMMERCE_OWNER is forced through `cambiar-contrasena` before
 * reaching it. The gate mechanism itself is reused from SPEC-239 (verify-only).
 */
describe('SPEC-249 — commerce area force-password gating (T-020 / T-023)', () => {
    const commercePaths = [
        '/es/mi-cuenta/comercio/',
        '/es/mi-cuenta/comercio/gastronomy/abc-123/editar/',
        '/en/mi-cuenta/comercio/experience/def-456/editar/'
    ];

    it('treats every commerce area path as a protected route (auth + gate apply)', () => {
        for (const path of commercePaths) {
            expect(isProtectedRoute({ path })).toBe(true);
        }
    });

    it('does NOT treat commerce paths as the change-password route (so the gate redirects them)', () => {
        for (const path of commercePaths) {
            expect(isChangePasswordRoute({ path })).toBe(false);
        }
    });

    it('exempts the change-password route itself (no redirect loop)', () => {
        expect(isChangePasswordRoute({ path: '/es/mi-cuenta/cambiar-contrasena/' })).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// HOS-254 — parseSessionUser must fail safe on API-URL config drift
// ---------------------------------------------------------------------------

/**
 * `parseSessionUser` is reached directly from public, unauthenticated
 * MercadoPago-return pages (checkout/index.astro, checkout/failure.astro) that
 * have no local try/catch. The internal `getMiddlewareApiUrl()` throws when
 * neither `HOSPEDA_API_URL` nor `PUBLIC_API_URL` is set, and that call sits
 * outside the try/catch guarding the fetch. Before HOS-254 that throw would
 * reject the caller and surface a 500 at a payment-critical moment; the guard
 * must now return `null` (anonymous session) instead.
 *
 * The env vars are deleted (not set to `''`) so `getMiddlewareApiUrl()`'s
 * `||` truthiness check actually fails — a locally-leaked value would otherwise
 * mask the regression (memory: `process.env X=undefined ≠ unset`).
 */
describe('parseSessionUser — API URL config drift (HOS-254)', () => {
    const ENV_KEYS = ['HOSPEDA_API_URL', 'PUBLIC_API_URL'] as const;
    const saved: Record<string, string | undefined> = {};

    beforeEach(() => {
        for (const key of ENV_KEYS) {
            saved[key] = process.env[key];
            delete process.env[key];
        }
    });

    afterEach(() => {
        for (const key of ENV_KEYS) {
            if (saved[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = saved[key];
            }
        }
    });

    it('returns null (fail-safe) instead of throwing when neither API URL var is set', async () => {
        // A non-null cookie header would otherwise proceed to resolve the API
        // URL and fetch; with both env vars unset the resolver throws before any
        // fetch, so the guard short-circuits to null without a network call.
        await expect(
            parseSessionUser({ cookieHeader: 'better-auth.session_token=abc' })
        ).resolves.toBeNull();
    });
});

// ---------------------------------------------------------------------------
// HOS-296 — parseSessionUser reads /auth/me and its role SET
// ---------------------------------------------------------------------------

/**
 * `parseSessionUser` was repointed from Better Auth's `/api/auth/get-session`
 * to `GET /api/v1/public/auth/me`, because `users.role` was dropped and the
 * native session response carries no role at all any more (spec §7.1, OQ-4).
 *
 * The load-bearing detail is that `/auth/me` declares `options: { skipAuth:
 * true }`: an absent, expired, or invalid session answers **200 with a guest
 * actor**, never 401. Gating on `response.ok` would therefore admit every
 * anonymous visitor as a signed-in user — the payload's `isAuthenticated` flag
 * is the only trustworthy signal, and these tests pin exactly that.
 */
describe('parseSessionUser — /auth/me (HOS-296)', () => {
    const COOKIE = 'better-auth.session_token=abc';
    const savedApiUrl = process.env.HOSPEDA_API_URL;

    beforeEach(() => {
        process.env.HOSPEDA_API_URL = 'https://api.test';
    });

    afterEach(() => {
        vi.restoreAllMocks();
        if (savedApiUrl === undefined) {
            delete process.env.HOSPEDA_API_URL;
        } else {
            process.env.HOSPEDA_API_URL = savedApiUrl;
        }
    });

    function mockAuthMe(body: unknown, ok = true) {
        const fetchMock = vi
            .fn()
            .mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => body });
        global.fetch = fetchMock as unknown as typeof fetch;
        return fetchMock;
    }

    it('calls /api/v1/public/auth/me, not /api/auth/get-session', async () => {
        const fetchMock = mockAuthMe({
            data: { actor: { id: 'u1', email: 'u@test', roles: ['USER'] }, isAuthenticated: true }
        });

        await parseSessionUser({ cookieHeader: COOKIE });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.test/api/v1/public/auth/me');
    });

    it('forwards the cookie header so the API can resolve the session', async () => {
        const fetchMock = mockAuthMe({
            data: { actor: { id: 'u1', email: 'u@test', roles: ['USER'] }, isAuthenticated: true }
        });

        await parseSessionUser({ cookieHeader: COOKIE });

        expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ headers: { cookie: COOKIE } });
    });

    /**
     * H-158: the provider nav gate reads this off the session.
     *
     * The property is that the flag TRAVELS — a payload that carries it must
     * reach `SessionUser` with it intact. If it silently dropped, the sidebar
     * would simply lose the entry again, which is the original bug and looks
     * identical to "this account is not a provider".
     *
     * It is read from the TOP LEVEL of the payload, not from the actor: the
     * `/auth/me` handler computes it for authenticated callers only, so that
     * `actorMiddleware` — which runs on every authenticated API request in the
     * platform — does not pay for it.
     */
    it('carries ownsHostTradeListing from the payload onto the session user', async () => {
        mockAuthMe({
            data: {
                actor: { id: 'u1', name: 'Prov', email: 'p@test', roles: ['USER'] },
                isAuthenticated: true,
                ownsHostTradeListing: true
            }
        });

        await expect(parseSessionUser({ cookieHeader: COOKIE })).resolves.toMatchObject({
            ownsHostTradeListing: true
        });
    });

    it('reads a non-boolean ownsHostTradeListing as false, never as truthy', async () => {
        // Same defensive rule as `roles` and `permissions`: a malformed payload
        // must land on the lowest-privilege reading. `'yes'` is truthy in JS
        // and would advertise a panel the account may not own.
        mockAuthMe({
            data: {
                actor: { id: 'u1', name: 'Prov', email: 'p@test', roles: ['USER'] },
                isAuthenticated: true,
                ownsHostTradeListing: 'yes'
            }
        });

        await expect(parseSessionUser({ cookieHeader: COOKIE })).resolves.toMatchObject({
            ownsHostTradeListing: false
        });
    });

    it('maps the actor onto the session user, including the FULL role set', async () => {
        mockAuthMe({
            data: {
                actor: {
                    id: 'u1',
                    name: 'Multi Hat',
                    email: 'multi@test',
                    image: 'https://img.test/a.png',
                    roles: ['USER', 'HOST', 'COMMERCE_OWNER'],
                    permissions: ['post.create', 'post.update.own']
                },
                isAuthenticated: true
            }
        });

        await expect(parseSessionUser({ cookieHeader: COOKIE })).resolves.toEqual({
            id: 'u1',
            name: 'Multi Hat',
            email: 'multi@test',
            roles: ['USER', 'HOST', 'COMMERCE_OWNER'],
            permissions: ['post.create', 'post.update.own'],
            image: 'https://img.test/a.png',
            mustChangePassword: false,
            // Absent from this payload, so it reads as "owns no listing" —
            // the lowest-privilege default (H-158).
            ownsHostTradeListing: false
        });
    });

    // HOS-374 OQ-1: the "trusted editor" is two per-user grants in
    // `user_permission` layered on the plain EDITOR role, never a role of its
    // own — so a role-only session cannot tell the two apart, and every gate
    // that must (the publish/delete controls in /mi-cuenta, ABSENT rather than
    // disabled for a plain editor per OQ-3) reads this set instead.
    it('carries the granular permission set, which roles cannot stand in for', async () => {
        mockAuthMe({
            data: {
                actor: {
                    id: 'u1',
                    email: 'trusted@test',
                    roles: ['EDITOR'],
                    permissions: ['post.create', 'post.update.own', 'post.publish.own']
                },
                isAuthenticated: true
            }
        });

        const user = await parseSessionUser({ cookieHeader: COOKIE });

        // Two actors with the IDENTICAL role set differ only here.
        expect(user?.roles).toEqual(['EDITOR']);
        expect(user?.permissions).toContain('post.publish.own');
    });

    it('falls back to an EMPTY permission set when the payload omits it', async () => {
        // Fail closed: a gate reading this must deny, never grant, on a
        // malformed payload. Mirrors the same rule for `roles`.
        mockAuthMe({
            data: {
                actor: { id: 'u1', email: 'u@test', roles: ['EDITOR'] },
                isAuthenticated: true
            }
        });

        await expect(parseSessionUser({ cookieHeader: COOKIE })).resolves.toMatchObject({
            permissions: []
        });
    });

    it('drops non-string entries instead of forwarding a partial set', async () => {
        mockAuthMe({
            data: {
                actor: {
                    id: 'u1',
                    email: 'u@test',
                    roles: ['EDITOR'],
                    permissions: ['post.create', 42, null, 'post.publish.own']
                },
                isAuthenticated: true
            }
        });

        await expect(parseSessionUser({ cookieHeader: COOKIE })).resolves.toMatchObject({
            permissions: ['post.create', 'post.publish.own']
        });
    });

    // ---- The guest-actor trap -------------------------------------------
    it('returns null for a 200 response carrying a GUEST actor (isAuthenticated false)', async () => {
        // The exact shape /auth/me answers with for an anonymous visitor:
        // HTTP 200 (skipAuth), a guest actor, `isAuthenticated: false`.
        // Trusting `response.ok` here would sign every visitor in.
        mockAuthMe({
            data: {
                actor: { id: 'guest', roles: [], permissions: [] },
                isAuthenticated: false
            }
        });

        await expect(parseSessionUser({ cookieHeader: COOKIE })).resolves.toBeNull();
    });

    it('returns null when isAuthenticated is absent altogether', async () => {
        mockAuthMe({ data: { actor: { id: 'u1', email: 'u@test', roles: ['USER'] } } });

        await expect(parseSessionUser({ cookieHeader: COOKIE })).resolves.toBeNull();
    });

    it('returns null when isAuthenticated is truthy-but-not-true', async () => {
        // Strict `!== true`: no coercion games decide who is signed in.
        mockAuthMe({
            data: { actor: { id: 'u1', email: 'u@test', roles: ['USER'] }, isAuthenticated: 'yes' }
        });

        await expect(parseSessionUser({ cookieHeader: COOKIE })).resolves.toBeNull();
    });

    it('returns null when the actor has no id even though isAuthenticated is true', async () => {
        mockAuthMe({ data: { actor: { roles: ['USER'] }, isAuthenticated: true } });

        await expect(parseSessionUser({ cookieHeader: COOKIE })).resolves.toBeNull();
    });

    it('returns null without fetching when there is no cookie header', async () => {
        const fetchMock = mockAuthMe({});

        await expect(parseSessionUser({ cookieHeader: null })).resolves.toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns null on a non-ok response', async () => {
        mockAuthMe({}, false);

        await expect(parseSessionUser({ cookieHeader: COOKIE })).resolves.toBeNull();
    });

    it('returns null (never throws) when the transport fails', async () => {
        global.fetch = vi
            .fn()
            .mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

        await expect(parseSessionUser({ cookieHeader: COOKIE })).resolves.toBeNull();
    });

    // ---- Degradation, not explosion -------------------------------------
    it('degrades to an EMPTY role set (lowest privilege) when roles are missing or malformed', async () => {
        mockAuthMe({ data: { actor: { id: 'u1', email: 'u@test' }, isAuthenticated: true } });
        await expect(parseSessionUser({ cookieHeader: COOKIE })).resolves.toMatchObject({
            roles: []
        });

        mockAuthMe({
            data: { actor: { id: 'u1', email: 'u@test', roles: 'HOST' }, isAuthenticated: true }
        });
        await expect(parseSessionUser({ cookieHeader: COOKIE })).resolves.toMatchObject({
            roles: []
        });
    });

    it('drops non-string entries from the role array', async () => {
        mockAuthMe({
            data: {
                actor: { id: 'u1', email: 'u@test', roles: ['HOST', null, 7, 'ADMIN'] },
                isAuthenticated: true
            }
        });

        await expect(parseSessionUser({ cookieHeader: COOKIE })).resolves.toMatchObject({
            roles: ['HOST', 'ADMIN']
        });
    });

    // ---- mustChangePassword (SPEC-239 / HOS-296) ------------------------
    it('reads mustChangePassword off the actor, in the SAME single request', async () => {
        // HOS-296: the flag used to require an opt-in second `get-session`
        // round-trip because it was a Better Auth `additionalField` and the
        // actor did not carry it. `actorMiddleware` now forwards it, so
        // `/mi-cuenta/*` is back to exactly ONE request.
        const fetchMock = mockAuthMe({
            data: {
                actor: {
                    id: 'u1',
                    email: 'u@test',
                    roles: ['COMMERCE_OWNER'],
                    mustChangePassword: true
                },
                isAuthenticated: true
            }
        });

        const user = await parseSessionUser({ cookieHeader: COOKIE });

        expect(user?.mustChangePassword).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
            'https://api.test/api/v1/public/auth/me'
        ]);
    });

    it('NEVER calls Better Auth get-session', async () => {
        const fetchMock = mockAuthMe({
            data: { actor: { id: 'u1', email: 'u@test', roles: ['USER'] }, isAuthenticated: true }
        });

        await parseSessionUser({ cookieHeader: COOKIE });

        expect(
            fetchMock.mock.calls.some((call) => String(call[0]).includes('/api/auth/get-session'))
        ).toBe(false);
    });

    it('fails open (false) when the actor omits the flag entirely', async () => {
        mockAuthMe({
            data: { actor: { id: 'u1', email: 'u@test', roles: ['USER'] }, isAuthenticated: true }
        });

        await expect(parseSessionUser({ cookieHeader: COOKIE })).resolves.toMatchObject({
            mustChangePassword: false
        });
    });
});

// ---------------------------------------------------------------------------
// HOS-296 — isAdminBypassUser reads the role SET (sweep-inventory site #5)
// ---------------------------------------------------------------------------

/**
 * `isAdminBypassUser` hand-cast the `/auth/me` payload to a LOCAL
 * `{ actor?: { role?: string } }` shape. That cast type-checks against
 * nothing, so dropping the `role` scalar would have left it permanently
 * `undefined` — no compile error, no runtime error, just every admin losing
 * the profile-completion bypass.
 */
describe('isAdminBypassUser — role set (HOS-296)', () => {
    const COOKIE = 'better-auth.session_token=abc';
    const savedApiUrl = process.env.HOSPEDA_API_URL;

    beforeEach(() => {
        process.env.HOSPEDA_API_URL = 'https://api.test';
    });

    afterEach(() => {
        vi.restoreAllMocks();
        if (savedApiUrl === undefined) {
            delete process.env.HOSPEDA_API_URL;
        } else {
            process.env.HOSPEDA_API_URL = savedApiUrl;
        }
    });

    function mockAuthMe(body: unknown, ok = true) {
        global.fetch = vi.fn().mockResolvedValue({
            ok,
            status: ok ? 200 : 500,
            json: async () => body
        }) as unknown as typeof fetch;
    }

    it('reads data.actor.roles (array), not a role scalar', async () => {
        // `PROFILE_COMPLETION_BYPASS_ROLES` is lowercase (a pre-existing bug
        // tracked separately — see the helper's JSDoc), so the lowercase value
        // is what this predicate actually matches today. The point asserted
        // here is the SHAPE: the array field is read, and a stray `role`
        // scalar is ignored.
        mockAuthMe({ data: { actor: { roles: ['admin'] }, isAuthenticated: true } });
        await expect(isAdminBypassUser({ cookieHeader: COOKIE })).resolves.toBe(true);

        mockAuthMe({ data: { actor: { role: 'admin' }, isAuthenticated: true } });
        await expect(isAdminBypassUser({ cookieHeader: COOKIE })).resolves.toBe(false);
    });

    it('matches a bypass role held alongside other hats', async () => {
        mockAuthMe({
            data: { actor: { roles: ['user', 'host', 'admin'] }, isAuthenticated: true }
        });

        await expect(isAdminBypassUser({ cookieHeader: COOKIE })).resolves.toBe(true);
    });

    it('returns false for a 200 guest response (skipAuth trap)', async () => {
        mockAuthMe({ data: { actor: { roles: [] }, isAuthenticated: false } });

        await expect(isAdminBypassUser({ cookieHeader: COOKIE })).resolves.toBe(false);
    });

    it('returns false without fetching when there is no cookie header', async () => {
        const fetchMock = vi.fn();
        global.fetch = fetchMock as unknown as typeof fetch;

        await expect(isAdminBypassUser({ cookieHeader: null })).resolves.toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('fails closed (false) when the request throws', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('boom')) as unknown as typeof fetch;

        await expect(isAdminBypassUser({ cookieHeader: COOKIE })).resolves.toBe(false);
    });
});
