/**
 * Middleware helper functions for route validation, locale extraction, and auth checks.
 * These pure functions are extracted for testability and separation of concerns.
 *
 * Route segment constants (PROTECTED_SEGMENTS, AUTH_SEGMENTS) come from `routes.ts`
 * rather than being hardcoded here so they have a single source of truth.
 */

import * as Sentry from '@sentry/astro';
import { DEFAULT_LOCALE, type SupportedLocale, isValidLocale } from './i18n';
import { webLogger } from './logger';
import { ALLOWED_REMOTE_HOSTS } from './media';
import {
    AUTH_SEGMENTS,
    BETA_PREFIX,
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

/**
 * Checks if a URL path belongs to the private beta tester documentation site.
 * Beta routes live under `/beta` (no `/{lang}/` namespace, Spanish-only).
 *
 * @param params - Object containing the URL path string
 * @returns True if the path is a beta docs route
 *
 * @example
 * ```ts
 * isBetaRoute({ path: '/beta/' })                    // true
 * isBetaRoute({ path: '/beta/turista/crear-cuenta/' }) // true
 * isBetaRoute({ path: '/es/alojamientos/' })         // false
 * ```
 */
export function isBetaRoute({ path }: { path: string }): boolean {
    if (!path) {
        return false;
    }
    return path === BETA_PREFIX || path.startsWith(`${BETA_PREFIX}/`);
}

/**
 * Builds a redirect URL to the login page with a return URL parameter.
 *
 * @param params - Object with locale and the current URL to redirect back to after login
 * @returns Absolute path to the signin page with returnUrl encoded as a query param
 *
 * @example
 * ```ts
 * buildLoginRedirect({ locale: 'es', currentUrl: '/es/mi-cuenta/perfil/' })
 * // => '/es/auth/signin?returnUrl=%2Fes%2Fmi-cuenta%2Fperfil%2F'
 * ```
 */
export function buildLoginRedirect({
    locale,
    currentUrl
}: {
    locale: SupportedLocale;
    currentUrl: string;
}): string {
    const encodedReturnUrl = encodeURIComponent(currentUrl);
    return `/${locale}/auth/signin/?returnUrl=${encodedReturnUrl}`;
}

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
     * User role from the Better Auth session (USER, HOST, ADMIN, etc.).
     * Populated from the `role` additional field configured in
     * `apps/api/src/lib/auth.ts`. `null` only when unexpectedly missing;
     * consumers should treat that as the lowest-privilege case.
     */
    readonly role: string | null;
    /**
     * Avatar URL from the Better Auth session (`users.image`). `null` when the
     * user has no avatar. Without this, server-rendered surfaces (header,
     * account dashboard) cannot show the avatar and fall back to initials
     * forever (BETA-32).
     */
    readonly image: string | null;
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
                '[web2 middleware] Neither HOSPEDA_API_URL nor PUBLIC_API_URL is configured'
            );
        }
        return url.replace(/\/$/, '');
    }
    throw new Error('[web2 middleware] process is not available to read API URL');
}

/**
 * Validates a session by calling the Better Auth API's get-session endpoint.
 * Returns the parsed user if the session is valid, or null otherwise.
 *
 * The cookie header is forwarded as-is to the auth API so Better Auth can
 * identify the session from its own session cookie.
 *
 * @param params - Object with the raw Cookie request header value (or null)
 * @returns Parsed user data, or null if the session is missing or invalid
 */
export async function parseSessionUser({
    cookieHeader
}: {
    cookieHeader: string | null;
}): Promise<SessionUser | null> {
    if (!cookieHeader) {
        return null;
    }

    const apiUrl = getMiddlewareApiUrl();

    // Instrument the Better Auth round-trip so we can measure p50/p95 in
    // Sentry and decide whether server-side session caching (SPEC-111 §4.3
    // candidate) is worth the architectural cost. Span is a no-op when
    // Sentry is not initialized (PUBLIC_SENTRY_DSN unset).
    return Sentry.startSpan(
        {
            name: 'web.middleware.parseSessionUser',
            op: 'http.client',
            attributes: {
                'http.url': `${apiUrl}/api/auth/get-session`,
                'http.method': 'GET'
            }
        },
        async (span) => {
            try {
                const response = await fetch(`${apiUrl}/api/auth/get-session`, {
                    headers: {
                        cookie: cookieHeader
                    }
                });

                span?.setAttribute('http.response.status_code', response.status);

                if (!response.ok) {
                    return null;
                }

                const data = (await response.json()) as {
                    user?: {
                        id?: string;
                        name?: string;
                        email?: string;
                        // `role` is an additional field configured in
                        // apps/api/src/lib/auth.ts (Better Auth
                        // `user.additionalFields`). It is returned by
                        // `/api/auth/get-session` whenever the session has a
                        // user. Used by AccountLayout to gate the sidebar
                        // "Mis propiedades" link (SPEC-143 Finding #12).
                        role?: string;
                        // Avatar URL (`users.image`), forwarded so SSR surfaces
                        // can render the avatar instead of initials (BETA-32).
                        image?: string;
                    };
                };

                if (!data?.user?.id || !data?.user?.email) {
                    return null;
                }

                return {
                    id: data.user.id,
                    name: data.user.name || '',
                    email: data.user.email,
                    role: data.user.role ?? null,
                    image: typeof data.user.image === 'string' ? data.user.image : null
                };
            } catch {
                span?.setStatus({ code: 2, message: 'internal_error' });
                webLogger.warn('[middleware] Failed to validate session against Better Auth API');

                return null;
            }
        }
    );
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
 * @param params - Object with nonce, optional API URL, and optional Sentry report URI
 * @returns Formatted CSP directive string
 */
export function buildCspHeader({
    nonce,
    apiUrl,
    sentryReportUri,
    sentryTunnelEnabled = false
}: {
    readonly nonce: string;
    readonly apiUrl?: string;
    readonly sentryReportUri?: string | null;
    readonly sentryTunnelEnabled?: boolean;
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
    const directives = [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
        // The Astro client runtime injects an inline <style> at hydration time
        // with the fixed content `astro-island,astro-slot,astro-static-slot{display:contents}`.
        // Because the injection happens via JS AFTER the middleware response
        // rewrite, `injectNonce` (which only walks the initial SSR HTML) can't
        // stamp a nonce on it, and the browser blocks/reports it. The CSS
        // content is hardcoded in Astro's runtime so its SHA-256 is stable —
        // hash-allow it explicitly to keep `style-src` strict otherwise.
        `style-src 'self' https://fonts.googleapis.com 'nonce-${nonce}' 'sha256-vv9IoKo7BSLbWcUHr3tNmfNVmm5L/9Cfn2H6LMk7/ow='`,
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
        "frame-src 'none'",
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
export { buildSentryReportUri } from '@repo/utils';

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
 * Checks if the given role should bypass the profile completion + set-password
 * guard per spec §3.5 (admin and super_admin roles skip the flow).
 *
 * @param params - Object with the role string
 * @returns True when the role is exempt from profile completion checks
 */
export function isProfileCompletionBypassRole({ role }: { role: string }): boolean {
    return (PROFILE_COMPLETION_BYPASS_ROLES as readonly string[]).includes(role);
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
 * Calls GET /api/v1/public/auth/me to obtain the actor's role.  Only called
 * when a redirect would otherwise be issued, so the extra HTTP call is rare.
 *
 * Returns false on any error so we default to requiring profile completion
 * (safer: an admin getting the completion form once is a better outcome than
 * a regular user never being redirected).
 *
 * @param params - Object with the raw Cookie request header value (or null)
 * @returns True if the user's role grants a bypass of the completion flow
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
            data?: { actor?: { role?: string } };
        };

        const role = data?.data?.actor?.role ?? '';
        return isProfileCompletionBypassRole({ role });
    } catch {
        webLogger.warn('[middleware] Failed to fetch actor role from /auth/me for bypass check');
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
