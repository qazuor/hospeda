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
 * 10. Set X-Robots-Tag noindex on hosts in HOSPEDA_NOINDEX_HOSTS (e.g. staging)
 */

import { defineMiddleware } from 'astro:middleware';
import { injectNonce } from '../integrations/csp-nonce-injector';
import { getApiUrl, getNoindexHosts } from './lib/env';
import {
    buildCspHeader,
    buildLocaleRedirect,
    buildLoginRedirect,
    buildProfileCompletionRedirect,
    buildSentryReportUri,
    buildSetPasswordRedirect,
    extractLocaleFromPath,
    generateCspNonce,
    isAdminBypassUser,
    isAuthRoute,
    isBetaRoute,
    isProfileCompletionRequiredSessionOptionalRoute,
    isProfileCompletionRoute,
    isProtectedRoute,
    isServerIslandRoute,
    isSessionOptionalRoute,
    isSetPasswordRoute,
    isStaticAssetRoute,
    parseNoindexHosts,
    parseProfileStatus,
    parseSessionUser
} from './lib/middleware-helpers';

/**
 * Hosts whose responses must include `X-Robots-Tag: noindex, nofollow`.
 * The same list also drives the restrictive `robots.txt` body served
 * by `pages/robots.txt.ts`; `parseNoindexHosts` is the single source of
 * truth so the two mechanisms can never drift.
 */
const NOINDEX_HOSTS = parseNoindexHosts(getNoindexHosts());

/**
 * Main middleware handler for all requests in the web2 application.
 */
export const onRequest = defineMiddleware(async (context, next) => {
    const path = context.url.pathname;

    // Generate a CSP nonce for this request (used by BaseLayout for inline scripts/styles)
    const cspNonce = generateCspNonce();
    (context.locals as { cspNonce: string }).cspNonce = cspNonce;

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

    // Step 3.5: Beta tester docs live under `/beta` outside the `/{lang}/` namespace.
    // Skip locale enforcement, session parsing, and auth checks. Still attach the
    // CSP header below (security) and stamp `X-Robots-Tag: noindex, nofollow` so
    // crawlers don't index the private docs even if the URL leaks.
    if (isBetaRoute({ path })) {
        (context.locals as { user: null }).user = null;
        let betaResponse = await next();

        betaResponse.headers.set('X-Robots-Tag', 'noindex, nofollow');

        const betaContentType = betaResponse.headers.get('content-type') ?? '';
        if (betaContentType.includes('text/html')) {
            // Stamp the per-request nonce on any inline <style>/<script>
            // emitted by Astro without one, so they match the policy we set
            // below. Content-Length is recomputed by Node from the new body.
            const originalBody = await betaResponse.text();
            const { html: rewrittenBody } = injectNonce({
                html: originalBody,
                nonce: cspNonce
            });
            const newHeaders = new Headers(betaResponse.headers);
            newHeaders.delete('content-length');
            betaResponse = new Response(rewrittenBody, {
                status: betaResponse.status,
                headers: newHeaders
            });

            const sentryDsn = import.meta.env.PUBLIC_SENTRY_DSN as string | undefined;
            const sentryReportUri = sentryDsn ? buildSentryReportUri({ dsn: sentryDsn }) : null;
            const directives = buildCspHeader({
                nonce: cspNonce,
                apiUrl: getApiUrl(),
                sentryReportUri
            });
            betaResponse.headers.set('Content-Security-Policy-Report-Only', directives);
        }

        return betaResponse;
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
    //
    // `context.isPrerendered` (Astro 5+) is true when the route being rendered
    // is statically prerendered. On prerendered pages there is no real request,
    // so accessing `request.headers` triggers an Astro 6 warning and there is
    // no session to parse anyway. Skip session work for those pages and treat
    // the visitor as anonymous — client islands will hydrate and fetch their
    // own session via `/api/v1/public/auth/me` when needed.
    const needsSession =
        !context.isPrerendered &&
        (isProtectedRoute({ path }) || isAuthRoute({ path }) || isSessionOptionalRoute({ path }));

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

        // Step 7.5 (SPEC-113): Profile completion + set-password guard.
        //
        // Runs on protected routes with a valid user, plus on the subset of
        // session-optional routes listed in
        // `PROFILE_COMPLETION_REQUIRED_SESSION_OPTIONAL_SEGMENTS` (e.g.
        // `/publicar/*`). Guests on those routes still pass through normally
        // — only signed-in users with incomplete profiles get bounced.
        //
        // Admin and super_admin roles skip the flow entirely (spec §3.5).  The
        // two completion routes themselves are whitelisted so form submissions
        // are never caught in a redirect loop.
        const guardApplies =
            user &&
            (isProtectedRoute({ path }) ||
                isProfileCompletionRequiredSessionOptionalRoute({ path }));

        if (guardApplies) {
            // Fetch the completion flags in parallel with session (already done)
            // — the status call is fast (two indexed DB lookups on the API side).
            const cookieHeader = context.request.headers.get('cookie');
            const profileStatus = await parseProfileStatus({ cookieHeader });

            // profileStatus may be null on API errors — fail-open (allow through).
            if (profileStatus) {
                // Determine the actor's role.  The session returned by
                // parseSessionUser does not include the role, so we rely on the
                // profile status to carry it indirectly.  Instead, we need to
                // get the role from the actor at runtime.  Since the /profile/status
                // endpoint is already called and we trust the session, the simplest
                // approach is: if the user is authenticated and the endpoint
                // succeeded, we have the flags. We don't have the role here.
                //
                // Role bypass approach: we fetch it lazily from /api/v1/public/auth/me
                // only when required (i.e. when a redirect would otherwise occur).
                // This avoids an extra HTTP call on every request where flags pass.

                const needsProfileCompletion =
                    !profileStatus.profileCompleted &&
                    !isProfileCompletionRoute({ path }) &&
                    !isSetPasswordRoute({ path });

                if (needsProfileCompletion) {
                    // Check admin bypass before redirecting.
                    const isBypass = await isAdminBypassUser({ cookieHeader });
                    if (!isBypass) {
                        const redirectUrl = buildProfileCompletionRedirect({ locale });
                        return context.redirect(redirectUrl);
                    }
                } else {
                    const needsSetPassword =
                        profileStatus.profileCompleted &&
                        profileStatus.hasOAuthAccount &&
                        !profileStatus.hasCredentialAccount &&
                        !profileStatus.setPasswordPrompted &&
                        !isSetPasswordRoute({ path }) &&
                        !isProfileCompletionRoute({ path });

                    if (needsSetPassword) {
                        const isBypass = await isAdminBypassUser({ cookieHeader });
                        if (!isBypass) {
                            const redirectUrl = buildSetPasswordRedirect({ locale });
                            return context.redirect(redirectUrl);
                        }
                    }
                }
            }
        }
    } else {
        // Ensure locals.user is always defined so pages don't need to check for undefined.
        (context.locals as { user: null }).user = null;
    }

    let response = await next();

    // Step 8: If the downstream handler returned a 404, rewrite to our custom 404 page
    // so it renders with the full site layout and i18n context.
    if (response.status === 404) {
        return context.rewrite('/404');
    }

    // Step 9: Attach a Content-Security-Policy-Report-Only header to all HTML responses
    // AND stamp the per-request nonce on every inline <style>/<script> Astro
    // emitted without one (so they match the policy below). The CSP header
    // is the single source of truth; the body rewrite makes the policy
    // actually enforceable for inline emissions Astro doesn't tag itself.
    // Phase 1 uses Report-Only so violations are reported without blocking content.
    // Switch to 'Content-Security-Policy' for Phase 2 enforcement.
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('text/html')) {
        // Rewrite body first so the policy header we set after this reflects
        // the same nonce that's now stamped on every unguarded inline tag.
        // Content-Length is dropped because the rewrite changes body size;
        // Node will recompute it on send.
        const originalBody = await response.text();
        const { html: rewrittenBody } = injectNonce({
            html: originalBody,
            nonce: cspNonce
        });
        const newHeaders = new Headers(response.headers);
        newHeaders.delete('content-length');
        response = new Response(rewrittenBody, {
            status: response.status,
            headers: newHeaders
        });

        const sentryDsn = import.meta.env.PUBLIC_SENTRY_DSN as string | undefined;
        const sentryReportUri = sentryDsn ? buildSentryReportUri({ dsn: sentryDsn }) : null;

        const CSP_HEADER_NAME = 'Content-Security-Policy-Report-Only';

        const directives = buildCspHeader({
            nonce: cspNonce,
            apiUrl: (import.meta.env.PUBLIC_API_URL as string | undefined) ?? undefined,
            sentryReportUri
        });

        response.headers.set(CSP_HEADER_NAME, directives);
    }

    // Step 10: Mark staging-style hosts as non-indexable. The header takes
    // precedence over any permissive `robots.txt` so it's enough on its own
    // to keep search engines out while we share the real app on a subdomain
    // before the official launch.
    if (NOINDEX_HOSTS.length > 0) {
        const requestHost = context.url.hostname.toLowerCase();
        if (NOINDEX_HOSTS.includes(requestHost)) {
            response.headers.set('X-Robots-Tag', 'noindex, nofollow');
        }
    }

    return response;
});
