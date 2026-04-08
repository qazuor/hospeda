/**
 * Astro middleware for locale validation and authentication protection.
 *
 * Pipeline (in order):
 * 1. Skip static assets and API routes
 * 2. Handle Server Island requests (parse session, skip locale enforcement)
 * 3. Enforce trailing slash (301 redirect before Astro resolves the route)
 * 4. Extract and validate locale from URL path; redirect invalid locales to default
 * 5. Set validated locale in context.locals
 * 6. Parse session only for routes that need it (protected + auth)
 * 7. Protect /mi-cuenta/* routes (redirect to login if unauthenticated)
 * 8. Rewrite 404 responses to the custom 404 page
 * 9. Set Content-Security-Policy-Report-Only header on HTML responses
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
 * Main middleware handler for all requests in the web2 application.
 */
export const onRequest = defineMiddleware(async (context, next) => {
    const path = context.url.pathname;

    // Step 1: Skip static assets and API routes — no middleware processing needed.
    if (isStaticAssetRoute({ path })) {
        return next();
    }

    // Step 2: Server Island requests need session data but NOT locale validation.
    // Astro routes Server Island requests via /_server-islands/* with their own
    // internal resolution; injecting a locale redirect here would break them.
    if (isServerIslandRoute({ path })) {
        const user = await parseSessionUser({
            cookieHeader: context.request.headers.get('cookie')
        });
        (context.locals as { user: typeof user }).user = user;
        return next();
    }

    // Step 3: Enforce trailing slash before Astro tries to resolve the route.
    // With trailingSlash: 'always' in astro.config.mjs, a path without a trailing
    // slash would cause Astro to throw instead of returning a clean 404.
    if (path !== '/' && !path.endsWith('/')) {
        const search = context.url.search;
        return context.redirect(`${path}/${search}`, 301);
    }

    // Step 4: Extract and validate locale from the URL path.
    const { locale, restOfPath } = extractLocaleFromPath({ path });

    // If the locale segment is missing or not a supported locale, redirect to the
    // default locale while preserving the rest of the path.
    if (locale === null) {
        const redirectUrl = buildLocaleRedirect({ restOfPath: restOfPath || path });
        return context.redirect(redirectUrl);
    }

    // Step 5: Store the validated locale in locals for downstream pages/components.
    (context.locals as { locale: typeof locale }).locale = locale;

    // Step 6: Parse the session only for routes that actually need it.
    // Calling the auth API on every request would be wasteful; public pages
    // don't need the user object at all.
    const needsSession = isProtectedRoute({ path }) || isAuthRoute({ path });

    if (needsSession) {
        const user = await parseSessionUser({
            cookieHeader: context.request.headers.get('cookie')
        });
        (context.locals as { user: typeof user }).user = user;

        // Step 7: Redirect unauthenticated users away from protected routes.
        if (isProtectedRoute({ path }) && !user) {
            const loginUrl = buildLoginRedirect({ locale, currentUrl: path });
            return context.redirect(loginUrl);
        }
    } else {
        // Ensure locals.user is always defined so pages don't need to check for undefined.
        (context.locals as { user: null }).user = null;
    }

    const response = await next();

    // Step 8: If the downstream handler returned a 404, rewrite to our custom 404 page
    // so it renders with the full site layout and i18n context.
    if (response.status === 404) {
        return context.rewrite('/404');
    }

    // Step 9: Attach a Content-Security-Policy-Report-Only header to all HTML responses.
    // This is the single source of truth for the CSP policy.
    // Phase 1 uses Report-Only so violations are reported without blocking content.
    // Switch to 'Content-Security-Policy' for Phase 2 enforcement.
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('text/html')) {
        const sentryDsn = import.meta.env.PUBLIC_SENTRY_DSN as string | undefined;
        const sentryReportUri = sentryDsn ? buildSentryReportUri({ dsn: sentryDsn }) : null;

        const CSP_HEADER_NAME = 'Content-Security-Policy-Report-Only';

        const directives = [
            "default-src 'self'",
            "script-src 'self' 'strict-dynamic' 'unsafe-inline'",
            "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: https:",
            `connect-src 'self' ${import.meta.env.PUBLIC_API_URL ?? ''} https://*.sentry.io https://*.vercel.app`,
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
