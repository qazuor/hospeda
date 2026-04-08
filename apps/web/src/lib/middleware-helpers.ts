/**
 * Middleware helper functions for route validation, locale extraction, and auth checks.
 * These pure functions are extracted for testability and separation of concerns.
 *
 * Route segment constants (PROTECTED_SEGMENTS, AUTH_SEGMENTS) come from `routes.ts`
 * rather than being hardcoded here so they have a single source of truth.
 */

import { DEFAULT_LOCALE, type SupportedLocale, isValidLocale } from './i18n';
import { webLogger } from './logger';
import { AUTH_SEGMENTS, PROTECTED_SEGMENTS, STATIC_PREFIXES } from './routes';

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

    // Internal Astro/Vite paths and API routes
    if (path.startsWith('/_')) {
        return true;
    }

    for (const prefix of STATIC_PREFIXES) {
        if (path.startsWith(prefix)) {
            return true;
        }
    }

    /** Common static asset extensions served from /public/. */
    const staticExtensions =
        /\.(ico|png|jpg|jpeg|webp|svg|gif|css|js|woff2?|ttf|eot|xml|txt|pdf)$/i;
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

    try {
        const response = await fetch(`${apiUrl}/api/auth/get-session`, {
            headers: {
                cookie: cookieHeader
            }
        });

        if (!response.ok) {
            return null;
        }

        const data = (await response.json()) as {
            user?: { id?: string; name?: string; email?: string };
        };

        if (!data?.user?.id || !data?.user?.email) {
            return null;
        }

        return {
            id: data.user.id,
            name: data.user.name || '',
            email: data.user.email
        };
    } catch {
        webLogger.warn('[middleware] Failed to validate session against Better Auth API');
        return null;
    }
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
 * @param params - Object with nonce, optional API URL, and optional Sentry report URI
 * @returns Formatted CSP directive string
 */
export function buildCspHeader({
    nonce,
    apiUrl,
    sentryReportUri
}: {
    readonly nonce: string;
    readonly apiUrl?: string;
    readonly sentryReportUri?: string | null;
}): string {
    const validApiUrl = apiUrl && apiUrl.trim().length > 0 ? apiUrl.trim() : null;

    const directives = [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
        `style-src 'self' https://fonts.googleapis.com 'nonce-${nonce}'`,
        "font-src 'self' https://fonts.gstatic.com",
        `img-src 'self' data: blob: https://*.vercel-storage.com https://*.public.blob.vercel-storage.com${validApiUrl ? ` ${new URL(validApiUrl).origin}` : ''}`,
        `connect-src 'self'${validApiUrl ? ` ${validApiUrl}` : ''} https://*.sentry.io https://*.vercel.app`,
        "worker-src 'self' blob:",
        'child-src blob:',
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
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
