/**
 * Middleware helper functions for route validation, locale extraction, and auth checks.
 * These pure functions are extracted for testability and separation of concerns.
 *
 * Route segment constants (PROTECTED_SEGMENTS, AUTH_SEGMENTS) come from `routes.ts`
 * rather than being hardcoded here so they have a single source of truth.
 */

import { buildSentryReportUri } from '@repo/utils';
import * as Sentry from '@sentry/astro';
import { DEFAULT_LOCALE, isValidLocale, type SupportedLocale } from './i18n';
import { webLogger } from './logger';
import { ALLOWED_REMOTE_HOSTS } from './media';
import {
    AUTH_SEGMENTS,
    CHANGE_PASSWORD_SEGMENT,
    PROFILE_COMPLETION_BYPASS_ROLES,
    PROFILE_COMPLETION_REQUIRED_SESSION_OPTIONAL_SEGMENTS,
    PROFILE_COMPLETION_SEGMENT,
    PROTECTED_SEGMENTS,
    SESSION_OPTIONAL_SEGMENTS,
    SET_PASSWORD_SEGMENT,
    STATIC_PREFIXES
} from './routes';

/**
 * Result of extracting a locale from a URL path.
 */
export interface LocaleExtractionResult {
    readonly locale: SupportedLocale | null;
    readonly restOfPath: string;
}

/**
 * Extracts and validates locale from a URL path in the format "/{locale}/...".
 *
 * @param params - Object containing the URL path string
 * @returns Extracted locale (or null if missing/invalid) and the remaining path
 *
 * @example
 * ```ts
 * extractLocaleFromPath({ path: '/es/alojamientos/' })
 * // => { locale: 'es', restOfPath: '/alojamientos/' }
 *
 * extractLocaleFromPath({ path: '/xx/foo/' })
 * // => { locale: null, restOfPath: '/foo/' }
 * ```
 */
export function extractLocaleFromPath({ path }: { path: string }): LocaleExtractionResult {
    if (!path || path === '/') {
        return { locale: null, restOfPath: path };
    }

    const trimmedPath = path.startsWith('/') ? path.slice(1) : path;
    const segments = trimmedPath.split('/');

    const potentialLocale = segments[0];
    if (!potentialLocale) {
        return { locale: null, restOfPath: path };
    }

    if (!isValidLocale(potentialLocale)) {
        return { locale: null, restOfPath: `/${segments.slice(1).join('/')}` };
    }

    const restSegments = segments.slice(1);
    const restOfPath = restSegments.length > 0 ? `/${restSegments.join('/')}` : '/';

    return { locale: potentialLocale, restOfPath };
}

/**
 * Checks if a URL path is a protected route requiring authentication.
 * Protected routes match: `/{locale}/{protectedSegment}/...`
 *
 * @param params - Object containing the URL path string
 * @returns True if the path is protected
 *
 * @example
 * ```ts
 * isProtectedRoute({ path: '/es/mi-cuenta/perfil/' }) // true
 * isProtectedRoute({ path: '/es/alojamientos/' })     // false
 * ```
 */
export function isProtectedRoute({ path }: { path: string }): boolean {
    if (!path) {
        return false;
    }

    const trimmedPath = path.startsWith('/') ? path.slice(1) : path;
    const segments = trimmedPath.split('/');

    if (segments.length < 2) {
        return false;
    }

    return (PROTECTED_SEGMENTS as readonly string[]).includes(segments[1] ?? '');
}

/**
 * Checks if the given path is an authentication route.
 * Auth routes match: `/{locale}/{authSegment}/...`
 *
 * @param params - Object containing the URL path string
 * @returns True if the path is an auth route
 *
 * @example
 * ```ts
 * isAuthRoute({ path: '/es/auth/signin/' }) // true
 * isAuthRoute({ path: '/es/destinos/' })    // false
 * ```
 */
export function isAuthRoute({ path }: { path: string }): boolean {
    if (!path) {
        return false;
    }

    const trimmedPath = path.startsWith('/') ? path.slice(1) : path;
    const segments = trimmedPath.split('/');

    if (segments.length < 2) {
        return false;
    }

    return (AUTH_SEGMENTS as readonly string[]).includes(segments[1] ?? '');
}

/**
 * Checks if a URL path is a session-optional route.
 * These routes parse the session when available but do NOT require authentication.
 *
 * @param params - Object containing the URL path string
 * @returns True if the path wants session data without requiring it
 */
export function isSessionOptionalRoute({ path }: { path: string }): boolean {
    if (!path) {
        return false;
    }

    const trimmedPath = path.startsWith('/') ? path.slice(1) : path;
    const segments = trimmedPath.split('/');

    if (segments.length < 2) {
        return false;
    }

    return (SESSION_OPTIONAL_SEGMENTS as readonly string[]).includes(segments[1] ?? '');
}

/**
 * Checks if a URL path is a session-optional route that ALSO requires the
 * profile-completion guard to fire when the visitor is signed in (SPEC-113).
 *
 * Distinct from `isSessionOptionalRoute` so guests still pass through these
 * routes unhindered, but authenticated users with `profile_completed = false`
 * get bounced to `completar-perfil/` exactly like they would from a fully
 * protected route. See `PROFILE_COMPLETION_REQUIRED_SESSION_OPTIONAL_SEGMENTS`
 * for the segment list.
 *
 * @param params - Object containing the URL path string
 * @returns True if the path is in the completion-required session-optional list
 */
export function isProfileCompletionRequiredSessionOptionalRoute({
    path
}: {
    readonly path: string;
}): boolean {
    if (!path) {
        return false;
    }
    const trimmedPath = path.startsWith('/') ? path.slice(1) : path;
    const segments = trimmedPath.split('/');
    if (segments.length < 2) {
        return false;
    }
    return (PROFILE_COMPLETION_REQUIRED_SESSION_OPTIONAL_SEGMENTS as readonly string[]).includes(
        segments[1] ?? ''
    );
}

/**
 * Checks if a URL path is a static asset or system route that should bypass middleware.
 *
 * Bypasses:
 * - Internal Astro/Vite routes starting with `/_`
 * - Common static file extensions (images, fonts, CSS, JS, etc.)
 * - Well-known static files (robots.txt, sitemap.xml, etc.)
 * - API routes (handled separately)
 * - Astro error pages (/404, /500)
 *
 * @param params - Object containing the URL path string
 * @returns True if middleware should skip this path
 */
export function isStaticAssetRoute({ path }: { path: string }): boolean {
    if (!path) {
        return false;
    }

    // Internal Astro/Vite paths and API routes (except server islands which need session parsing)
    if (path.startsWith('/_') && !path.startsWith('/_server-islands/')) {
        return true;
    }

    for (const prefix of STATIC_PREFIXES) {
        if (path.startsWith(prefix)) {
            return true;
        }
    }

    /**
     * Common static asset extensions served from /public/, plus file-extension
     * endpoints (e.g. `*.json.ts`). These must skip middleware so the
     * trailing-slash enforcement below does not 301-redirect them to a
     * `/path/` form that Astro never resolves for file-extension routes.
     */
    const staticExtensions =
        /\.(ico|png|jpg|jpeg|webp|svg|gif|css|js|woff2?|ttf|eot|xml|txt|pdf|json)$/i;
    if (staticExtensions.test(path)) {
        return true;
    }

    const staticFiles = ['/favicon.ico', '/robots.txt', '/sitemap.xml'];
    if (staticFiles.includes(path)) {
        return true;
    }

    /** Error pages rendered internally by Astro (404.astro, 500.astro). */
    if (path === '/404' || path === '/500' || path === '/404/' || path === '/500/') {
        return true;
    }

    return false;
}

/**
 * Checks if a URL path is a Server Island request.
 * Server Islands use the `/_server-islands/` prefix in Astro 5.
 *
 * @param params - Object containing the URL path string
 * @returns True if this is a Server Island request
 */
export function isServerIslandRoute({ path }: { path: string }): boolean {
    return !!path && path.startsWith('/_server-islands/');
}

/** URL prefix of Astro's on-demand image transform endpoint. */
export const IMAGE_ENDPOINT_PREFIX = '/_image';

/**
 * `Cache-Control` applied to `/_image` responses (HOS-160 lever C). The
 * `@astrojs/node` adapter only auto-caches physical `dist/client/_astro/*`
 * files, so this dynamic endpoint would otherwise re-run a Sharp transform and
 * be re-fetched on every request. A year-long immutable cache is safe because
 * the transformed output is content-addressed by the query string (`href` +
 * `w`/`h` + `f`ormat), and the local `astro:assets` sources served through
 * `/_image` are themselves content-hashed (remote images use a raw `<img>` per
 * the web styleguide, so they never reach this endpoint).
 */
export const IMAGE_ENDPOINT_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/**
 * Checks if a URL path targets Astro's on-demand image endpoint (`/_image`).
 *
 * @param params - Object containing the URL path string
 * @returns True for `/_image` requests
 */
export function isImageEndpointRoute({ path }: { path: string }): boolean {
    return !!path && path.startsWith(IMAGE_ENDPOINT_PREFIX);
}

// `buildLoginRedirect` now lives in the client-safe `./auth-redirect` module so
// React islands can use it without dragging this server-only module (logger,
// Sentry, process.env) into the browser bundle. Re-exported here so existing
// server consumers keep importing it from `middleware-helpers` unchanged.
export { buildLoginRedirect } from './auth-redirect';

/**
 * Builds a redirect URL for an invalid or missing locale, defaulting to the default locale.
 *
 * @param params - Object with the remaining path after the (invalid) locale segment
 * @returns Absolute path prefixed with DEFAULT_LOCALE
 *
 * @example
 * ```ts
 * buildLocaleRedirect({ restOfPath: '/alojamientos/' })
 * // => '/es/alojamientos/'
 * ```
 */
export function buildLocaleRedirect({ restOfPath }: { restOfPath: string }): string {
    const normalizedPath = restOfPath.startsWith('/') ? restOfPath : `/${restOfPath}`;
    return `/${DEFAULT_LOCALE}${normalizedPath}`;
}

/**
 * User information parsed from session cookie.
 */
export interface SessionUser {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    /**
     * Every role the user holds (USER, HOST, COMMERCE_OWNER, ADMIN, ...).
     *
     * HOS-296 replaced the former single `role` scalar with this set: one
     * account can wear several hats at once and there is deliberately NO
     * derived "primary role". Resolved per request by `actorMiddleware` and
     * read from `GET /api/v1/public/auth/me` (`data.actor.roles`) — Better
     * Auth's `get-session` no longer carries any role at all, because
     * `users.role` was dropped and `additionalFields` is a plain column
     * mapping (spec §7.1, OQ-4).
     *
     * Empty only when the payload was unexpectedly malformed; consumers must
     * treat that as the lowest-privilege case (no host/commerce access).
     */
    readonly roles: readonly string[];
    /**
     * Avatar URL from the actor (`users.image`, mirrored onto `Actor.image`
     * by `actorMiddleware`). `null` when the user has no avatar. Without this,
     * server-rendered surfaces (header, account dashboard) cannot show the
     * avatar and fall back to initials forever (BETA-32).
     */
    readonly image: string | null;
    /**
     * SPEC-239 T-041: Force-password-change flag.
     * `true` when the user was provisioned with a server-generated password
     * (commerce owner accounts) and must rotate it before using protected
     * routes. Mirrors `users.mustChangePassword`.
     *
     * HOS-296: read from `data.actor.mustChangePassword` on the SAME
     * `/auth/me` response as everything else. It briefly required a second,
     * parallel `get-session` request — the flag was a Better Auth
     * `additionalField` and nothing else exposed it — until `actorMiddleware`
     * started forwarding it onto the actor. Note the `/auth/me` payload ALSO
     * carries a top-level `passwordChangeRequired`; that is a DIFFERENT flag
     * (`adminInfo`-scoped, computed only for actors with `ACCESS_PANEL_ADMIN`)
     * and is NOT a substitute — it is always false for the commerce owners
     * this gate exists for.
     */
    readonly mustChangePassword: boolean;
}

/**
 * Profile completion flags for a given user.
 * Returned by GET /api/v1/protected/profile/status (SPEC-113 T-113-06).
 */
export interface ProfileStatus {
    readonly profileCompleted: boolean;
    readonly setPasswordPrompted: boolean;
    readonly hasOAuthAccount: boolean;
    readonly hasCredentialAccount: boolean;
}

/**
 * Middleware-specific API URL resolver that reads from process.env.
 * Uses process.env instead of import.meta.env because middleware runs
 * at request time on the server, where import.meta.env may not be
 * populated for all variables in SSR contexts.
 */
function getMiddlewareApiUrl(): string {
    if (typeof process !== 'undefined') {
        const url = process.env.HOSPEDA_API_URL || process.env.PUBLIC_API_URL;
        if (!url) {
            throw new Error(
                '[web middleware] Neither HOSPEDA_API_URL nor PUBLIC_API_URL is configured'
            );
        }
        return url.replace(/\/$/, '');
    }
    throw new Error('[web middleware] process is not available to read API URL');
}

/**
 * Validates a session by calling `GET /api/v1/public/auth/me` and returns the
 * parsed user, or `null` when the visitor is not authenticated.
 *
 * The cookie header is forwarded as-is so the API's auth + actor middleware
 * can resolve the session from Better Auth's own session cookie.
 *
 * **HOS-296 — why `/auth/me` and not `get-session`.** `users.role` was
 * dropped, so Better Auth's `additionalFields` (a plain column mapping) has
 * no role to expose and `get-session` carries none at all. The role SET is
 * resolved per request by `actorMiddleware` and served on the actor, exactly
 * like billing entitlements (spec §7.1, OQ-4 actor-only). This SUBSTITUTES
 * the previous per-request `get-session` call — it does not add one.
 *
 * **The 200-with-a-guest-actor trap.** `/auth/me` is declared
 * `options: { skipAuth: true }`, so an absent/expired/invalid session gets a
 * **200 response carrying a guest actor**, never a 401. `response.ok` is
 * therefore NOT an authentication signal: the payload's `isAuthenticated`
 * flag is. Gating on `ok` alone would let every anonymous visitor through as
 * a signed-in user.
 *
 * @param params.cookieHeader - Raw `Cookie` request header value (or null).
 * @returns Parsed user data, or null if the session is missing or invalid.
 */
export async function parseSessionUser({
    cookieHeader
}: {
    readonly cookieHeader: string | null;
}): Promise<SessionUser | null> {
    if (!cookieHeader) {
        return null;
    }

    // HOS-254: resolve the API URL defensively. `getMiddlewareApiUrl()` throws
    // when neither HOSPEDA_API_URL nor PUBLIC_API_URL is set, and this call
    // sits OUTSIDE the try/catch that guards the fetch below. `parseSessionUser`
    // is now reached directly from public, unauthenticated MercadoPago-return
    // pages (checkout/index.astro, checkout/failure.astro) that have no local
    // try/catch, so a config-drift throw here would surface a 500 at a
    // payment-critical moment. Fail safe to an anonymous session instead, so
    // `resolveSubscriptionPlansPath` maps null → the tourist plans page.
    let apiUrl: string;
    try {
        apiUrl = getMiddlewareApiUrl();
    } catch {
        webLogger.warn(
            '[middleware] API URL not configured; treating session as anonymous (parseSessionUser)'
        );
        return null;
    }

    // Instrument the session round-trip so we can measure p50/p95 in Sentry
    // and decide whether server-side session caching (SPEC-111 §4.3
    // candidate) is worth the architectural cost. Span is a no-op when
    // Sentry is not initialized (PUBLIC_SENTRY_DSN unset).
    return Sentry.startSpan(
        {
            name: 'web.middleware.parseSessionUser',
            op: 'http.client',
            attributes: {
                'http.url': `${apiUrl}/api/v1/public/auth/me`,
                'http.method': 'GET'
            }
        },
        async (span) => {
            try {
                const response = await fetch(`${apiUrl}/api/v1/public/auth/me`, {
                    headers: {
                        cookie: cookieHeader
                    }
                });

                span?.setAttribute('http.response.status_code', response.status);

                if (!response.ok) {
                    return null;
                }

                // Shape of `GET /api/v1/public/auth/me` — see
                // `apps/api/src/routes/auth/me.ts` and `AuthMeResponseSchema`
                // in `@repo/schemas`. Declared locally (rather than imported)
                // to keep the middleware bundle free of the schema package;
                // every field is optional so a shape change degrades to the
                // lowest-privilege case instead of throwing.
                const data = (await response.json()) as {
                    data?: {
                        actor?: {
                            id?: string;
                            name?: string;
                            email?: string;
                            image?: string;
                            // HOS-296: the role SET, resolved per request by
                            // `actorMiddleware` from `user_role`. Replaces the
                            // former `role` scalar, which no longer exists in
                            // any payload.
                            roles?: readonly string[];
                            // SPEC-239 commerce-owner password gate. Lives on
                            // the actor since HOS-296 — see `SessionUser`.
                            mustChangePassword?: boolean;
                        };
                        isAuthenticated?: boolean;
                    };
                };

                // `/auth/me` is `skipAuth`, so an invalid session yields
                // 200 + a guest actor. `isAuthenticated` is the ONLY reliable
                // signal — see this function's JSDoc.
                const actor = data?.data?.actor;
                if (data?.data?.isAuthenticated !== true || !actor?.id) {
                    return null;
                }

                return {
                    id: actor.id,
                    name: actor.name || '',
                    email: actor.email || '',
                    roles: Array.isArray(actor.roles)
                        ? actor.roles.filter((role): role is string => typeof role === 'string')
                        : [],
                    image: typeof actor.image === 'string' ? actor.image : null,
                    // Fail-open on anything but an explicit `true`, matching
                    // the gate's own "if the flag is missing/false, pass
                    // through" semantics.
                    mustChangePassword: actor.mustChangePassword === true
                };
            } catch {
                span?.setStatus({ code: 2, message: 'internal_error' });
                webLogger.warn('[middleware] Failed to validate session against the auth API');

                return null;
            }
        }
    );
}

/**
 * Better Auth session cookie names this app must recognize.
 *
 * Better Auth's default cookie is `<cookiePrefix>.session_token`, with
 * `cookiePrefix` defaulting to `"better-auth"` (see `apps/api/src/lib/auth.ts`
 * — neither `advanced.cookiePrefix` nor `advanced.cookies.session_token.name`
 * is overridden there, so the default applies). When `useSecureCookies` is on
 * (production — `NODE_ENV === 'production'` in `auth.ts`), Better Auth sets
 * the cookie with the `__Secure-` prefix instead of the plain name. Both
 * forms must be checked since dev/staging and production can differ.
 */
const SESSION_COOKIE_NAMES = [
    'better-auth.session_token',
    '__Secure-better-auth.session_token'
] as const;

/**
 * Checks whether a raw `Cookie` request header carries a Better Auth session
 * cookie, WITHOUT validating the session (no network call).
 *
 * This is a cheap, synchronous presence check — it does not confirm the
 * session is still valid server-side. It exists specifically for contexts
 * that must not call `parseSessionUser` / `get-session` per request (e.g.
 * `server:defer` Server Islands — see `NextEventsSection.astro`), because
 * that round-trip on every page view floods the API's `auth` rate-limit
 * bucket (the bug fixed by removing the per-page-view session parse in
 * `middleware.ts` Step 2). A visitor with an EXPIRED session cookie will
 * still test positive here; callers that gate a single bulk API call on this
 * check accept that trade-off (one 401 that gracefully falls back, not an
 * N+1) — see the call site for details.
 *
 * @param cookieHeader - Raw `Cookie` request header value (or `null`)
 * @returns `true` if a recognized session cookie name is present
 *
 * @example
 * ```ts
 * requestHasSessionCookie('better-auth.session_token=abc; theme=dark') // true
 * requestHasSessionCookie('theme=dark') // false
 * requestHasSessionCookie(null) // false
 * ```
 */
export function requestHasSessionCookie(cookieHeader: string | null): boolean {
    if (!cookieHeader) {
        return false;
    }

    return cookieHeader.split(';').some((pair) => {
        const separatorIndex = pair.indexOf('=');
        const name = (separatorIndex === -1 ? pair : pair.slice(0, separatorIndex)).trim();
        return (SESSION_COOKIE_NAMES as readonly string[]).includes(name);
    });
}

/**
 * Generates a cryptographic nonce for Content Security Policy.
 * Produces a base64-encoded string from 16 random bytes.
 *
 * @returns A unique base64-encoded nonce string
 */
export function generateCspNonce(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return btoa(String.fromCharCode(...bytes));
}

/**
 * Builds a Content-Security-Policy header value using nonce-based script/style policy.
 *
 * SPEC-047: `script-src` and `style-src` deliberately omit `'unsafe-inline'`.
 * Every inline `<script>` / `<style>` in the web app must carry a
 * `nonce={cspNonce}` attribute (enforced by `scripts/check-inline-nonce.sh`)
 * so it participates in CSP integrity. `'strict-dynamic'` on `script-src`
 * grants nonce-loaded scripts the right to load further scripts they
 * legitimately need, without falling back to host allowlists.
 *
 * HOS-91: in `astro dev`, Vite injects component CSS as nonce-less `<style>`
 * tags client-side, and Astro 7's ClientRouter re-injects them on every
 * soft-navigation. The enforcing, nonce-based `style-src` blocks all of them
 * (confirmed: 20/20 soft-nav `<style>` tags had `.sheet === null`), so pages
 * render unstyled after any client-side nav until a full reload. `isDev`
 * relaxes `style-src` to a plain `'unsafe-inline'` policy in dev ONLY;
 * build/prod keeps the strict nonce+hash policy unchanged.
 *
 * @param params - Object with nonce, optional API URL, optional Sentry report URI, and dev-mode flag
 * @returns Formatted CSP directive string
 */
export function buildCspHeader({
    nonce,
    apiUrl,
    sentryReportUri,
    sentryTunnelEnabled = false,
    isDev = false
}: {
    readonly nonce: string;
    readonly apiUrl?: string;
    readonly sentryReportUri?: string | null;
    readonly sentryTunnelEnabled?: boolean;
    readonly isDev?: boolean;
}): string {
    const validApiUrl = apiUrl && apiUrl.trim().length > 0 ? apiUrl.trim() : null;

    // Remote image hosts mirror `ALLOWED_REMOTE_HOSTS` (single source of truth
    // shared with `astro.config.mjs` `image.remotePatterns` and the SSRF guard
    // `isAllowedRemoteHost()`). Adding a new host there auto-flows into CSP.
    // `localhost` is dropped since CSP host-source matching does not apply to
    // it; non-HTTPS hosts only matter in dev where img-src isn't enforced.
    const remoteImgHosts = ALLOWED_REMOTE_HOSTS.filter((h) => h !== 'localhost')
        .map((h) => `https://${h}`)
        .join(' ');

    // OAuth avatar hosts. Better Auth stores the provider-returned picture URL
    // on `user.image`, and `@repo/auth-ui` renders it via plain `<img>`. These
    // are NOT image-content hosts that flow through Astro <Image>, so they do
    // not belong in `ALLOWED_REMOTE_HOSTS` (which doubles as the SSRF guard for
    // server-side image fetches). Keep them as a separate explicit list:
    //   - lh3.googleusercontent.com  → Google OAuth picture
    //   - platform-lookaside.fbsbx.com → Facebook OAuth picture (Graph CDN)
    const oauthAvatarHosts =
        'https://lh3.googleusercontent.com https://platform-lookaside.fbsbx.com';

    // SPEC-181: PostHog analytics is proxied first-party under `/api/relay/*` (a
    // Cloudflare Worker forwards to PostHog Cloud US — see
    // infra/cloudflare/posthog-proxy/). Because the proxy path is same-origin,
    // `'self'` already covers script/connect/img for PostHog — no external
    // `us.i.posthog.com` / `us-assets.i.posthog.com` allowlist entries are needed
    // (SPEC-140 added them when the SDK talked to PostHog directly; removed here).
    // COUPLING: the Worker must be live and `PUBLIC_POSTHOG_HOST` set to the proxy
    // origin BEFORE this CSP is enforced, or PostHog breaks silently (deploy order
    // in the Worker README). `script-src` keeps 'strict-dynamic' (the nonce-tagged
    // bootstrapper loads the SDK).
    //
    // SPEC-181 follow-up: Sentry has its OWN first-party tunnel under `/api/event`
    // (a separate Cloudflare Worker — infra/cloudflare/sentry-tunnel/). When the
    // tunnel is enabled (`PUBLIC_SENTRY_TUNNEL` set), the browser SDK POSTs
    // envelopes to that same-origin path, so the external `https://*.sentry.io`
    // `connect-src` entry is dropped ('self' covers it). When the tunnel is NOT
    // enabled, `https://*.sentry.io` stays so the SDK can report to Sentry
    // directly. The two proxy paths bind to DIFFERENT Workers (do not merge).
    // NOTE: the `report-uri` directive still points at *.sentry.io directly — CSP
    // violation reports are browser-emitted (not SDK envelopes) and are not
    // tunneled; that directive is independent of `connect-src`.
    const sentryConnectSrc = sentryTunnelEnabled ? '' : ' https://*.sentry.io';

    // HOS-91: CSP3 rule — a `style-src` directive that carries a nonce or a
    // hash source causes browsers to IGNORE `'unsafe-inline'` in that SAME
    // directive (nonces/hashes and 'unsafe-inline' are mutually exclusive per
    // spec, precisely so an attacker who can't guess the nonce can't fall
    // back to unsafe-inline). So the dev variant below must DROP the nonce
    // and the hash entirely rather than append 'unsafe-inline' next to them —
    // appending it alongside the nonce would be inert and the dev bug would
    // persist. Dev-only: build/prod keeps the strict nonce+hash policy.
    const styleSrc = isDev
        ? "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'"
        : `style-src 'self' https://fonts.googleapis.com 'nonce-${nonce}' 'sha256-vv9IoKo7BSLbWcUHr3tNmfNVmm5L/9Cfn2H6LMk7/ow='`;

    const directives = [
        "default-src 'self'",
        // Cloudflare Turnstile (invisible bot-detection on the feedback form,
        // SPEC-301) loads its widget script from https://challenges.cloudflare.com.
        // With 'strict-dynamic' a compliant browser already trusts the script the
        // nonce-tagged island injects, but the explicit host is the fallback for
        // browsers that ignore 'strict-dynamic'. Adding it is harmless to the
        // strict policy (host-source allowlists are ignored when strict-dynamic
        // is honored).
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com`,
        // The Astro client runtime injects an inline <style> at hydration time
        // with the fixed content `astro-island,astro-slot,astro-static-slot{display:contents}`.
        // Because the injection happens via JS AFTER the middleware response
        // rewrite, `injectNonce` (which only walks the initial SSR HTML) can't
        // stamp a nonce on it, and the browser blocks/reports it. The CSS
        // content is hardcoded in Astro's runtime so its SHA-256 is stable —
        // hash-allow it explicitly to keep `style-src` strict otherwise.
        // See `styleSrc` above for the HOS-91 dev-only relaxation.
        styleSrc,
        // `style-src` (above) defaults to gating BOTH `<style>` elements and
        // inline `style="..."` attributes. Nonces cannot be applied to style
        // attributes by spec, so a strict nonce-based `style-src` blocks every
        // inline color/transition style we set on cards, badges, and the
        // `data-reveal` stagger pattern (see apps/web/src/lib/colors.ts and
        // STYLE_GUIDE.md). Override only the `-attr` variant with
        // `'unsafe-inline'` so:
        //   - `<style>` blocks still require the nonce (the high-XSS-impact path)
        //   - `style="..."` attributes are allowed (low-XSS-impact patterns
        //     used for tokenized inline colors and per-card transition delays)
        "style-src-attr 'unsafe-inline'",
        "font-src 'self' https://fonts.gstatic.com",
        `img-src 'self' data: blob: ${remoteImgHosts} ${oauthAvatarHosts} https://cdn.simpleicons.org https://*.tile.openstreetmap.org https://*.openstreetmap.org${validApiUrl ? ` ${new URL(validApiUrl).origin}` : ''}`,
        `connect-src 'self'${validApiUrl ? ` ${validApiUrl}` : ''}${sentryConnectSrc} https://*.tile.openstreetmap.org https://cloudflareinsights.com`,
        "worker-src 'self' blob:",
        'child-src blob:',
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        // Cloudflare Turnstile renders its challenge in an iframe served from
        // https://challenges.cloudflare.com. 'strict-dynamic' does NOT govern
        // frames, so this host MUST be allowlisted here or the widget can never
        // mount and no token is produced (SPEC-301 feedback form). Every other
        // embed origin stays blocked; frame-ancestors 'none' still stops others
        // from embedding us.
        'frame-src https://challenges.cloudflare.com',
        "frame-ancestors 'none'",
        "media-src 'self'",
        'upgrade-insecure-requests',
        sentryReportUri ? `report-uri ${sentryReportUri}` : null
    ]
        .filter(Boolean)
        .join('; ');

    return directives;
}

// Re-export from shared package for backward compatibility
export { buildSentryReportUri };

/**
 * Resolves the CSP `report-uri` target for the current request.
 *
 * Prefers `PUBLIC_SENTRY_CSP_REPORT_URI` — a dedicated Sentry project
 * (`hospeda-csp`) used ONLY for browser-emitted CSP violation reports, kept
 * separate from the app's own error-tracking project so violation noise never
 * pollutes the app's issue stream. Falls back to the report endpoint derived
 * from the app's own `PUBLIC_SENTRY_DSN` (previous behavior, via
 * {@link buildSentryReportUri}) when the dedicated var is unset, so CSP
 * enforcement is never affected by this var being unset — the previous
 * per-app-DSN behavior keeps working exactly as before.
 *
 * @param params - Object with the app's own Sentry DSN and the optional
 *   dedicated CSP report-uri override.
 * @returns The report-uri target, or `null` when neither is configured.
 */
export function resolveSentryReportUri({
    sentryDsn,
    dedicatedCspReportUri
}: {
    readonly sentryDsn: string | undefined;
    readonly dedicatedCspReportUri: string | undefined;
}): string | null {
    if (dedicatedCspReportUri) {
        return dedicatedCspReportUri;
    }
    return sentryDsn ? buildSentryReportUri({ dsn: sentryDsn }) : null;
}

// SPEC-182: the admin→web cross-origin signin redirect helper is colocated with
// the callbackUrl validator in `auth-callback.ts` (both manage the same param),
// but is re-exported here so consumers can import it alongside the other
// redirect builders (and so the admin guard's reference point — see T-005 —
// resolves from the documented `middleware-helpers` location).
export { buildAdminLoginRedirect } from './auth-callback';

// ---------------------------------------------------------------------------
// SPEC-113: Profile completion guard helpers
// ---------------------------------------------------------------------------

/**
 * Checks if the current URL path is the profile completion form itself.
 * This is whitelisted in the guard so the form can actually be submitted.
 *
 * Matches: /{locale}/mi-cuenta/completar-perfil/ (and any sub-paths)
 *
 * @param params - Object containing the URL path string
 * @returns True if the path is the completar-perfil route
 */
export function isProfileCompletionRoute({ path }: { path: string }): boolean {
    if (!path) return false;
    const segments = path.replace(/^\//, '').split('/');
    // /{locale}/mi-cuenta/completar-perfil/...
    return (
        segments.length >= 3 &&
        (PROTECTED_SEGMENTS as readonly string[]).includes(segments[1] ?? '') &&
        segments[2] === PROFILE_COMPLETION_SEGMENT
    );
}

/**
 * Checks if the current URL path is the set-password form itself.
 * This is whitelisted in the guard so the form can be submitted or skipped.
 *
 * Matches: /{locale}/mi-cuenta/agregar-contrasena/ (and any sub-paths)
 *
 * @param params - Object containing the URL path string
 * @returns True if the path is the agregar-contrasena route
 */
export function isSetPasswordRoute({ path }: { path: string }): boolean {
    if (!path) return false;
    const segments = path.replace(/^\//, '').split('/');
    // /{locale}/mi-cuenta/agregar-contrasena/...
    return (
        segments.length >= 3 &&
        (PROTECTED_SEGMENTS as readonly string[]).includes(segments[1] ?? '') &&
        segments[2] === SET_PASSWORD_SEGMENT
    );
}

/**
 * Checks whether any of the user's held roles bypasses the profile completion
 * + set-password guard per spec §3.5 (admin and super_admin skip the flow).
 *
 * HOS-296: takes the whole role SET and matches on "holds a bypass role",
 * so a user who is both, say, HOST and ADMIN still gets the bypass.
 *
 * KNOWN PRE-EXISTING BUG (NOT introduced here, deliberately NOT fixed here):
 * `PROFILE_COMPLETION_BYPASS_ROLES` is `['admin', 'super_admin']` — lowercase
 * — while every real role value is UPPERCASE (`RoleEnum.ADMIN === 'ADMIN'`).
 * The comparison has therefore never matched a real actor, so the bypass is
 * already dead in production. Fixing the casing is a behavior change that
 * would let admins skip profile completion for the first time; it needs its
 * own issue rather than riding along with the multi-role cut, so this
 * function preserves the existing (case-sensitive) comparison exactly.
 *
 * @param params - `{ roles }` (RO-RO): every role the user holds.
 * @returns True when at least one held role is exempt from profile completion.
 */
export function isProfileCompletionBypassRole({
    roles
}: {
    readonly roles: readonly string[];
}): boolean {
    return roles.some((role) =>
        (PROFILE_COMPLETION_BYPASS_ROLES as readonly string[]).includes(role)
    );
}

/**
 * Builds the redirect URL for the profile completion form.
 *
 * @param params - Object with locale
 * @returns Absolute path to `/{locale}/mi-cuenta/completar-perfil/`
 */
export function buildProfileCompletionRedirect({ locale }: { locale: SupportedLocale }): string {
    return `/${locale}/mi-cuenta/${PROFILE_COMPLETION_SEGMENT}/`;
}

/**
 * Builds the redirect URL for the set-password form.
 *
 * @param params - Object with locale
 * @returns Absolute path to `/{locale}/mi-cuenta/agregar-contrasena/`
 */
export function buildSetPasswordRedirect({ locale }: { locale: SupportedLocale }): string {
    return `/${locale}/mi-cuenta/${SET_PASSWORD_SEGMENT}/`;
}

/**
 * Checks whether the currently authenticated user holds an admin or super_admin
 * role that grants them a bypass of the profile completion guard (spec §3.5).
 *
 * Calls GET /api/v1/public/auth/me to obtain the actor's role SET. Only called
 * when a redirect would otherwise be issued, so the extra HTTP call is rare.
 *
 * HOS-296: reads `data.actor.roles` (array). The previous implementation
 * hand-cast the payload to a LOCAL `{ actor?: { role?: string } }` type — a
 * cast the compiler cannot check against the real response, so dropping the
 * `role` scalar would have left it silently `undefined` here with no build
 * error (spec §7.2, sweep-inventory site #5).
 *
 * Returns false on any error so we default to requiring profile completion
 * (safer: an admin getting the completion form once is a better outcome than
 * a regular user never being redirected).
 *
 * @param params - Object with the raw Cookie request header value (or null)
 * @returns True if one of the user's roles grants a bypass of the completion flow
 */
export async function isAdminBypassUser({
    cookieHeader
}: {
    cookieHeader: string | null;
}): Promise<boolean> {
    if (!cookieHeader) {
        return false;
    }

    const apiUrl = getMiddlewareApiUrl();

    try {
        const response = await fetch(`${apiUrl}/api/v1/public/auth/me`, {
            headers: {
                cookie: cookieHeader
            }
        });

        if (!response.ok) {
            return false;
        }

        const data = (await response.json()) as {
            data?: { actor?: { roles?: readonly string[] }; isAuthenticated?: boolean };
        };

        // `/auth/me` is `skipAuth`: an invalid session answers 200 with a
        // guest actor, so `response.ok` proves nothing about authentication.
        if (data?.data?.isAuthenticated !== true) {
            return false;
        }

        const rawRoles = data.data.actor?.roles;
        const roles = Array.isArray(rawRoles)
            ? rawRoles.filter((role): role is string => typeof role === 'string')
            : [];
        return isProfileCompletionBypassRole({ roles });
    } catch {
        webLogger.warn('[middleware] Failed to fetch actor roles from /auth/me for bypass check');
        return false;
    }
}

/**
 * Fetches profile completion status from the API for a given user session.
 *
 * Calls GET /api/v1/protected/profile/status — an endpoint that requires an
 * authenticated session (cookie forwarded) and returns the four completion
 * flags used by the middleware guard (SPEC-113 T-113-06).
 *
 * Returns null on any network error so the middleware can fail-open
 * (allow through) rather than blocking every user on an API outage.
 *
 * @param params - Object with the raw Cookie request header value (or null)
 * @returns Profile status flags, or null if the request fails
 */
export async function parseProfileStatus({
    cookieHeader
}: {
    cookieHeader: string | null;
}): Promise<ProfileStatus | null> {
    if (!cookieHeader) {
        return null;
    }

    const apiUrl = getMiddlewareApiUrl();

    try {
        const response = await fetch(`${apiUrl}/api/v1/protected/profile/status`, {
            headers: {
                cookie: cookieHeader
            }
        });

        if (!response.ok) {
            return null;
        }

        const data = (await response.json()) as {
            data?: {
                profileCompleted?: boolean;
                setPasswordPrompted?: boolean;
                hasOAuthAccount?: boolean;
                hasCredentialAccount?: boolean;
            };
        };

        if (!data?.data) {
            return null;
        }

        return {
            profileCompleted: data.data.profileCompleted ?? false,
            setPasswordPrompted: data.data.setPasswordPrompted ?? false,
            hasOAuthAccount: data.data.hasOAuthAccount ?? false,
            hasCredentialAccount: data.data.hasCredentialAccount ?? false
        };
    } catch {
        webLogger.warn('[middleware] Failed to fetch profile status from API');
        return null;
    }
}

/**
 * Default noindex host (used when `HOSPEDA_NOINDEX_HOSTS` is unset).
 * Kept narrow on purpose: a missing env var is safer to default to the
 * known pre-launch staging host than to leave indexing wide open.
 */
const DEFAULT_NOINDEX_HOST = 'staging.hospeda.com.ar';

/**
 * Parse the `HOSPEDA_NOINDEX_HOSTS` env var (comma-separated host list)
 * into a normalised lowercase array. Used by both the global middleware
 * (which sets `X-Robots-Tag: noindex, nofollow`) and the dynamic
 * `robots.txt` endpoint (which serves `Disallow: /` for those hosts).
 *
 * Centralising the parser here means a future host alias only needs the
 * env var update — no risk of one mechanism updating without the other
 * (header sent but robots.txt still permissive, or vice versa).
 *
 * @param raw - Raw string from `import.meta.env.HOSPEDA_NOINDEX_HOSTS`.
 *              Pass `undefined` to fall back to the default.
 * @returns Lowercase, trimmed, deduplicated host list. Always non-empty
 *          (falls back to {@link DEFAULT_NOINDEX_HOST} when input is
 *          undefined / empty / all-whitespace).
 */
export function parseNoindexHosts(raw: string | undefined): ReadonlyArray<string> {
    const source = raw && raw.trim().length > 0 ? raw : DEFAULT_NOINDEX_HOST;
    const seen = new Set<string>();
    for (const part of source.split(',')) {
        const host = part.trim().toLowerCase();
        if (host.length > 0) seen.add(host);
    }
    return [...seen];
}

// ---------------------------------------------------------------------------
// SPEC-239: Must-change-password guard helpers
// ---------------------------------------------------------------------------

/**
 * Checks if the current URL path is the change-password form itself.
 * This route is whitelisted in the guard so the form can actually be submitted.
 *
 * Matches: /{locale}/mi-cuenta/cambiar-contrasena/ (and any sub-paths)
 *
 * @param params - Object containing the URL path string
 * @returns True if the path is the cambiar-contrasena route
 */
export function isChangePasswordRoute({ path }: { path: string }): boolean {
    if (!path) return false;
    const segments = path.replace(/^\//, '').split('/');
    // /{locale}/mi-cuenta/cambiar-contrasena/...
    return (
        segments.length >= 3 &&
        (PROTECTED_SEGMENTS as readonly string[]).includes(segments[1] ?? '') &&
        segments[2] === CHANGE_PASSWORD_SEGMENT
    );
}

/**
 * Builds the redirect URL for the change-password form.
 *
 * @param params - Object with locale
 * @returns Absolute path to `/{locale}/mi-cuenta/cambiar-contrasena/`
 */
export function buildChangePasswordRedirect({ locale }: { locale: SupportedLocale }): string {
    return `/${locale}/mi-cuenta/${CHANGE_PASSWORD_SEGMENT}/`;
}
