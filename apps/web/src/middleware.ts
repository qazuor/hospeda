/**
 * Astro middleware for locale validation and authentication protection.
 * Handles:
 * 1. Skipping static assets and API routes
 * 2. Validating locale from URL path and redirecting invalid locales
 * 3. Setting validated locale in context.locals
 * 4. Protecting /mi-cuenta/* routes with authentication checks
 */

import { defineMiddleware } from 'astro:middleware';
import {
    buildLocaleRedirect,
    buildLoginRedirect,
    extractLocaleFromPath,
    isProtectedRoute,
    isServerIslandRoute,
    isStaticAssetRoute,
    parseSessionUser
} from './lib/middleware-helpers';

/**
 * Main middleware handler for all requests.
 * Processes locale validation and authentication checks before routing.
 */
export const onRequest = defineMiddleware(async (context, next) => {
    const path = context.url.pathname;

    // Step 1: Skip static assets and API routes
    if (isStaticAssetRoute({ path })) {
        return next();
    }

    // Step 1.5: Server Island requests need session parsing but NOT locale validation.
    // Server Islands are fetched by Astro at /_server-islands/{ComponentName} and
    // don't have a locale segment. We parse the session so components like
    // AuthSection.astro can read Astro.locals.user, then continue without redirecting.
    if (isServerIslandRoute({ path })) {
        const user = await parseSessionUser({
            cookieHeader: context.request.headers.get('cookie')
        });
        (context.locals as { user: typeof user }).user = user;
        return next();
    }

    // Step 2: Extract and validate locale from path
    const { locale, restOfPath } = extractLocaleFromPath({ path });

    // If locale is invalid, redirect to default locale with same path
    if (locale === null) {
        // For paths without any locale segment, redirect to default locale
        const redirectUrl = buildLocaleRedirect({ restOfPath: restOfPath || path });
        return context.redirect(redirectUrl);
    }

    // Step 3: Set validated locale in context.locals for use in pages
    // NOTE: Type assertion required due to Astro 5 type generation limitations.
    // The Locals interface is properly declared in src/env.d.ts but not automatically
    // picked up by TypeScript. This is a known issue and doesn't affect runtime behavior.
    (context.locals as { locale: typeof locale }).locale = locale;

    // Step 3.5: Validate session by calling Better Auth API
    const user = await parseSessionUser({
        cookieHeader: context.request.headers.get('cookie')
    });
    (context.locals as { user: typeof user }).user = user;

    // Step 4: Check authentication for protected routes
    if (isProtectedRoute({ path })) {
        // User must be authenticated for protected routes
        if (!user) {
            // Redirect to login with return URL
            const loginUrl = buildLoginRedirect({ locale, currentUrl: path });
            return context.redirect(loginUrl);
        }
    }

    // Continue to the route handler
    return next();
});
