/**
 * Middleware helper functions for route validation, locale extraction, and auth checks.
 * These pure functions are extracted for testability and separation of concerns.
 */

import { DEFAULT_LOCALE, type SupportedLocale, isValidLocale } from './i18n';

/**
 * Result of extracting a locale from a URL path.
 */
export interface LocaleExtractionResult {
    /**
     * The extracted locale if valid, null otherwise.
     */
    readonly locale: SupportedLocale | null;

    /**
     * The remaining path after the locale segment (e.g., "/about" from "/es/about").
     */
    readonly restOfPath: string;
}

/**
 * Extracts and validates locale from a URL path in the format "/{locale}/...".
 * Returns the validated locale and the remaining path.
 *
 * @param path - The URL pathname to parse.
 * @returns Object containing the locale (or null if invalid) and the rest of the path.
 *
 * @example
 * ```ts
 * extractLocaleFromPath('/es/alojamientos'); // { locale: 'es', restOfPath: '/alojamientos' }
 * extractLocaleFromPath('/en/about/'); // { locale: 'en', restOfPath: '/about/' }
 * extractLocaleFromPath('/fr/test'); // { locale: null, restOfPath: '/test' }
 * extractLocaleFromPath('/'); // { locale: null, restOfPath: '/' }
 * extractLocaleFromPath(''); // { locale: null, restOfPath: '' }
 * ```
 */
export function extractLocaleFromPath({ path }: { path: string }): LocaleExtractionResult {
    if (!path || path === '/') {
        return { locale: null, restOfPath: path };
    }

    // Remove leading slash for splitting
    const trimmedPath = path.startsWith('/') ? path.slice(1) : path;
    const segments = trimmedPath.split('/');

    // Extract first segment as potential locale
    const potentialLocale = segments[0];
    if (!potentialLocale) {
        return { locale: null, restOfPath: path };
    }

    // Validate locale
    if (!isValidLocale(potentialLocale)) {
        return { locale: null, restOfPath: `/${segments.slice(1).join('/')}` };
    }

    // Construct rest of path
    const restSegments = segments.slice(1);
    const restOfPath = restSegments.length > 0 ? `/${restSegments.join('/')}` : '/';

    return { locale: potentialLocale, restOfPath };
}

/**
 * Checks if a URL path is a protected route requiring authentication.
 * Protected routes are those under "/{locale}/mi-cuenta/*".
 *
 * @param path - The URL pathname to check.
 * @returns True if the path is a protected route, false otherwise.
 *
 * @example
 * ```ts
 * isProtectedRoute({ path: '/es/mi-cuenta/profile' }); // true
 * isProtectedRoute({ path: '/en/mi-cuenta/' }); // true
 * isProtectedRoute({ path: '/pt/mi-cuenta' }); // true
 * isProtectedRoute({ path: '/es/alojamientos' }); // false
 * isProtectedRoute({ path: '/es/about' }); // false
 * isProtectedRoute({ path: '/' }); // false
 * ```
 */
export function isProtectedRoute({ path }: { path: string }): boolean {
    if (!path) {
        return false;
    }

    // Match pattern: /{locale}/mi-cuenta/*
    // We check if the second segment after removing leading slash is "mi-cuenta"
    const trimmedPath = path.startsWith('/') ? path.slice(1) : path;
    const segments = trimmedPath.split('/');

    // Need at least 2 segments: [locale, 'mi-cuenta']
    if (segments.length < 2) {
        return false;
    }

    // Second segment should be 'mi-cuenta'
    return segments[1] === 'mi-cuenta';
}

/**
 * Checks if a URL path is a static asset or system route that should bypass middleware.
 * Includes: _astro/*, *.ico, robots.txt, sitemap.xml, API routes (/api/*).
 *
 * @param path - The URL pathname to check.
 * @returns True if the path should be skipped by middleware, false otherwise.
 *
 * @example
 * ```ts
 * isStaticAssetRoute({ path: '/_astro/client.abc123.js' }); // true
 * isStaticAssetRoute({ path: '/favicon.ico' }); // true
 * isStaticAssetRoute({ path: '/robots.txt' }); // true
 * isStaticAssetRoute({ path: '/sitemap.xml' }); // true
 * isStaticAssetRoute({ path: '/api/search' }); // true
 * isStaticAssetRoute({ path: '/es/alojamientos' }); // false
 * isStaticAssetRoute({ path: '/about' }); // false
 * ```
 */
export function isStaticAssetRoute({ path }: { path: string }): boolean {
    if (!path) {
        return false;
    }

    // Check for Astro internal build assets (but NOT server islands, which need session parsing)
    if (path.startsWith('/_astro/')) {
        return true;
    }

    // Check for common static files
    const staticFiles = ['/favicon.ico', '/robots.txt', '/sitemap.xml'];
    if (staticFiles.includes(path)) {
        return true;
    }

    // Check for API routes
    if (path.startsWith('/api/')) {
        return true;
    }

    return false;
}

/**
 * Checks if a URL path is a Server Island request.
 * Server Islands are requested at `/_server-islands/{ComponentName}` and need
 * session parsing (for auth state) but NOT locale validation.
 *
 * @param path - The URL pathname to check.
 * @returns True if the path is a server island request.
 */
export function isServerIslandRoute({ path }: { path: string }): boolean {
    return !!path && path.startsWith('/_server-islands/');
}

/**
 * Builds a redirect URL to the login page with a return URL parameter.
 *
 * @param locale - The locale for the login page.
 * @param currentUrl - The current URL to return to after login.
 * @returns The login page URL with encoded return URL.
 *
 * @example
 * ```ts
 * buildLoginRedirect({ locale: 'es', currentUrl: '/es/mi-cuenta/profile' });
 * // Returns: '/es/auth/signin?returnUrl=%2Fes%2Fmi-cuenta%2Fprofile'
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
    return `/${locale}/auth/signin?returnUrl=${encodedReturnUrl}`;
}

/**
 * Builds a redirect URL for an invalid locale, converting to the default locale.
 *
 * @param restOfPath - The path after the invalid locale segment.
 * @returns The redirect URL with the default locale.
 *
 * @example
 * ```ts
 * buildLocaleRedirect({ restOfPath: '/alojamientos' });
 * // Returns: '/es/alojamientos'
 * ```
 */
export function buildLocaleRedirect({ restOfPath }: { restOfPath: string }): string {
    // Ensure path starts with /
    const normalizedPath = restOfPath.startsWith('/') ? restOfPath : `/${restOfPath}`;
    return `/${DEFAULT_LOCALE}${normalizedPath}`;
}

/**
 * User information parsed from session cookie.
 */
export interface SessionUser {
    /**
     * The unique user ID.
     */
    readonly id: string;

    /**
     * The user's display name.
     */
    readonly name: string;

    /**
     * The user's email address.
     */
    readonly email: string;
}

/**
 * Resolves the API base URL from environment variables (server-side only).
 *
 * @returns The API base URL.
 */
/**
 * Middleware-specific API URL resolver using process.env (not import.meta.env).
 * Middleware runs in a Node.js context where import.meta.env is not available,
 * so this cannot use the shared getApiUrl() from lib/env.ts.
 */
function getApiUrl(): string {
    if (typeof process !== 'undefined') {
        return (
            process.env.HOSPEDA_API_URL ||
            process.env.PUBLIC_API_URL ||
            'http://localhost:3001'
        ).replace(/\/$/, '');
    }
    return 'http://localhost:3001';
}

/**
 * Validates a session by calling the Better Auth API's get-session endpoint.
 * Forwards the full cookie header to let Better Auth resolve the session.
 *
 * Returns the authenticated user data on success, or null if the session
 * is invalid, expired, or the API is unreachable (non-blocking).
 *
 * @param cookieHeader - The raw Cookie header from the incoming request.
 * @returns User information object if session is valid, null otherwise.
 *
 * @example
 * ```ts
 * const user = await parseSessionUser({ cookieHeader: null });
 * // Returns: null
 *
 * const user = await parseSessionUser({
 *   cookieHeader: 'better-auth.session_token=abc123'
 * });
 * // Returns: { id: '...', name: '...', email: '...' } or null
 * ```
 */
export async function parseSessionUser({
    cookieHeader
}: {
    cookieHeader: string | null;
}): Promise<SessionUser | null> {
    // If no cookie header exists, user is not authenticated
    if (!cookieHeader) {
        return null;
    }

    const apiUrl = getApiUrl();

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
        // Non-blocking: log warning and return null on API failure
        console.warn('[middleware] Failed to validate session against Better Auth API');
        return null;
    }
}
