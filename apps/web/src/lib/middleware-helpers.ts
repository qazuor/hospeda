/**
 * Middleware helper functions for route validation, locale extraction, and auth checks.
 * These pure functions are extracted for testability and separation of concerns.
 */

import { DEFAULT_LOCALE, type SupportedLocale, isValidLocale } from './i18n';
import { webLogger } from './logger';

/**
 * Result of extracting a locale from a URL path.
 */
export interface LocaleExtractionResult {
    readonly locale: SupportedLocale | null;
    readonly restOfPath: string;
}

/**
 * Extracts and validates locale from a URL path in the format "/{locale}/...".
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

    return segments[1] === 'mi-cuenta';
}

/**
 * Checks if the given path is an authentication route.
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

    return segments[1] === 'auth';
}

/**
 * Checks if a URL path is a static asset or system route that should bypass middleware.
 */
export function isStaticAssetRoute({ path }: { path: string }): boolean {
    if (!path) {
        return false;
    }

    if (path.startsWith('/_')) {
        return true;
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

    if (path.startsWith('/api/')) {
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
 */
export function isServerIslandRoute({ path }: { path: string }): boolean {
    return !!path && path.startsWith('/_server-islands/');
}

/**
 * Builds a redirect URL to the login page with a return URL parameter.
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
 * Middleware-specific API URL resolver using process.env (not import.meta.env).
 */
function getApiUrl(): string {
    if (typeof process !== 'undefined') {
        const url = process.env.HOSPEDA_API_URL || process.env.PUBLIC_API_URL;
        if (!url) {
            throw new Error(
                '[middleware] Neither HOSPEDA_API_URL nor PUBLIC_API_URL is configured'
            );
        }
        return url.replace(/\/$/, '');
    }
    throw new Error('[middleware] process is not available to read API URL');
}

/**
 * Validates a session by calling the Better Auth API's get-session endpoint.
 */
export async function parseSessionUser({
    cookieHeader
}: {
    cookieHeader: string | null;
}): Promise<SessionUser | null> {
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
        webLogger.warn('[middleware] Failed to validate session against Better Auth API');
        return null;
    }
}

// Re-export from shared package for backward compatibility
export { buildSentryReportUri } from '@repo/utils';
