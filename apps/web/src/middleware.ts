/**
 * Astro middleware for locale validation and authentication protection.
 * Handles:
 * 1. Skipping static assets and API routes
 * 2. Enforcing trailing slash (redirect before Astro route resolution)
 * 3. Validating locale from URL path and redirecting invalid locales
 * 4. Setting validated locale in context.locals
 * 5. Protecting /mi-cuenta/* routes with authentication checks
 * 6. Rewriting 404 responses to the custom 404 page
 * 7. Setting Content-Security-Policy header on HTML responses
 */

import { defineMiddleware } from 'astro:middleware';
import {
    buildLocaleRedirect,
    buildLoginRedirect,
    buildSentryReportUri,
    extractLocaleFromPath,
    isAuthRoute,
    isProtectedRoute,
    isServerIslandRoute,
    isStaticAssetRoute,
    parseSessionUser
} from './lib/middleware-helpers';

/**
 * Main middleware handler for all requests.
 */
export const onRequest = defineMiddleware(async (context, next) => {
    const path = context.url.pathname;

    // Step 1: Skip static assets and API routes
    if (isStaticAssetRoute({ path })) {
        return next();
    }

    // Step 1.5: Server Island requests need session parsing but NOT locale validation.
    if (isServerIslandRoute({ path })) {
        const user = await parseSessionUser({
            cookieHeader: context.request.headers.get('cookie')
        });
        (context.locals as { user: typeof user }).user = user;
        return next();
    }

    // Step 2: Enforce trailing slash before Astro tries to resolve the route.
    // Without this, non-existent paths without trailing slash cause Astro to throw
    // an error instead of returning a clean 404 (since trailingSlash: 'always').
    if (path !== '/' && !path.endsWith('/')) {
        const search = context.url.search;
        return context.redirect(`${path}/${search}`, 301);
    }

    // Step 3: Extract and validate locale from path
    const { locale, restOfPath } = extractLocaleFromPath({ path });

    // If locale is invalid, redirect to default locale with same path
    if (locale === null) {
        const redirectUrl = buildLocaleRedirect({ restOfPath: restOfPath || path });
        return context.redirect(redirectUrl);
    }

    // Step 4: Set validated locale in context.locals
    (context.locals as { locale: typeof locale }).locale = locale;

    // Step 4.5: Parse session only for routes that need it (protected + auth).
    const needsSession = isProtectedRoute({ path }) || isAuthRoute({ path });

    if (needsSession) {
        const user = await parseSessionUser({
            cookieHeader: context.request.headers.get('cookie')
        });
        (context.locals as { user: typeof user }).user = user;

        // Step 5: User must be authenticated for protected routes
        if (isProtectedRoute({ path }) && !user) {
            const loginUrl = buildLoginRedirect({ locale, currentUrl: path });
            return context.redirect(loginUrl);
        }
    } else {
        (context.locals as { user: null }).user = null;
    }

    const response = await next();

    // Step 6: If the downstream route returned a 404, rewrite to our custom 404 page.
    if (response.status === 404) {
        return context.rewrite('/404');
    }

    // Step 7: Set Content-Security-Policy-Report-Only header on HTML responses.
    // This is the single source of truth for CSP policy (Astro experimental.csp is disabled).
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('text/html')) {
        const sentryDsn = import.meta.env.PUBLIC_SENTRY_DSN;
        const sentryReportUri = sentryDsn ? buildSentryReportUri({ dsn: sentryDsn }) : null;

        // Phase 1: Report-Only mode. Change to 'Content-Security-Policy' for Phase 2.
        const CSP_HEADER_NAME = 'Content-Security-Policy-Report-Only';

        const directives = [
            "default-src 'self'",
            "script-src 'self' 'strict-dynamic' 'unsafe-inline'",
            "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: https:",
            "connect-src 'self' https://*.sentry.io https://*.vercel.app",
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

        response.headers.set(CSP_HEADER_NAME, directives);
    }

    return response;
});
