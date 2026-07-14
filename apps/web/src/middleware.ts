/**
 * Astro middleware for locale validation and authentication protection.
 *
 * Pipeline (in order):
 * 1. Skip static assets and API routes
 * 2. Handle Server Island requests (skip locale enforcement; no session
 *    parse — see the Step 2 block below for why)
 * 3. Enforce trailing slash (301 redirect before Astro resolves the route)
 * 3.1. Legacy URL aliases (e.g. `/mi-cuenta/messages` -> `/mi-cuenta/consultas`,
 *      `/blog` -> `/publicaciones`) redirect before locale/route resolution
 * 4. Extract and validate locale from URL path; redirect invalid locales to default
 * 5. Set validated locale in context.locals
 * 6. Parse session only for routes that need it (protected + auth)
 * 7. Protect /mi-cuenta/* routes (redirect to login if unauthenticated)
 * 8. Rewrite 404 responses to the custom 404 page
 * 9. Set Content-Security-Policy header (enforce mode, HOS-30 Phase 2) on HTML responses
 * 10. Set X-Robots-Tag noindex on hosts in HOSPEDA_NOINDEX_HOSTS (e.g. staging)
 */

import { defineMiddleware } from 'astro:middleware';
import { injectNonce } from '../integrations/csp-nonce-injector';
import { getNoindexHosts, isDevelopment } from './lib/env';
import {
    buildChangePasswordRedirect,
    buildCspHeader,
    buildLocaleRedirect,
    buildLoginRedirect,
    buildProfileCompletionRedirect,
    buildSetPasswordRedirect,
    extractLocaleFromPath,
    generateCspNonce,
    IMAGE_ENDPOINT_CACHE_CONTROL,
    isAdminBypassUser,
    isAuthRoute,
    isChangePasswordRoute,
    isImageEndpointRoute,
    isProfileCompletionRequiredSessionOptionalRoute,
    isProfileCompletionRoute,
    isProtectedRoute,
    isServerIslandRoute,
    isSessionOptionalRoute,
    isSetPasswordRoute,
    isStaticAssetRoute,
    parseNoindexHosts,
    parseProfileStatus,
    parseSessionUser,
    resolveSentryReportUri
} from './lib/middleware-helpers';

/**
 * Hosts whose responses must include `X-Robots-Tag: noindex, nofollow`.
 * The same list also drives the restrictive `robots.txt` body served
 * by `pages/robots.txt.ts`; `parseNoindexHosts` is the single source of
 * truth so the two mechanisms can never drift.
 */
const NOINDEX_HOSTS = parseNoindexHosts(getNoindexHosts());

/**
 * CSP header name for all HTML responses.
 * HOS-30 T-020: Phase 2 enforce — flipped from `Content-Security-Policy-Report-Only`.
 */
const CSP_HEADER_NAME = 'Content-Security-Policy';

/**
 * Main middleware handler for all requests in the web application.
 */
export const onRequest = defineMiddleware(async (context, next) => {
    const path = context.url.pathname;

    // Generate a CSP nonce for this request (used by BaseLayout for inline scripts/styles)
    const cspNonce = generateCspNonce();
    (context.locals as { cspNonce: string }).cspNonce = cspNonce;

    // Step 1: Skip static assets and API routes — no middleware processing needed.
    if (isStaticAssetRoute({ path })) {
        // The on-demand image endpoint (`/_image`) is a dynamic route, so the
        // @astrojs/node adapter's automatic long-cache header (physical
        // dist/client/_astro/* files only) never reaches it — every request
        // would re-run a Sharp transform and be re-fetched. Give it an explicit
        // immutable cache so the LCP hero is cached by the browser/CDN
        // (HOS-160 lever C). All other static routes pass through untouched.
        if (isImageEndpointRoute({ path })) {
            const response = await next();
            // Only cache SUCCESSFUL transforms as immutable. A transient Sharp
            // failure (500) or a bad `href` (404) must NOT be pinned for a year
            // by the browser/CDN, which would keep serving a broken hero long
            // after the cause is fixed, with no natural revalidation.
            if (response.ok) {
                response.headers.set('Cache-Control', IMAGE_ENDPOINT_CACHE_CONTROL);
            }
            return response;
        }
        return next();
    }

    // Step 2: Server Island requests skip locale validation (Astro routes them
    // via /_server-islands/* with their own internal resolution; injecting a
    // locale redirect here would break them).
    //
    // This block used to ALSO call `parseSessionUser()` unconditionally for
    // every Server Island request. `server:defer` islands are each a SEPARATE
    // browser→server HTTP request, so an island mounted on every page (the
    // mobile menu) fired an extra `get-session` call on EVERY page view
    // site-wide, flooding the API's `auth` rate-limit bucket (50/5min per IP).
    // Removed: the two islands that used to rely on this (`MobileMenuIsland`,
    // `NextEventsSection`) now resolve auth state themselves — the mobile menu
    // reads the shared client-side `authMeSnapshot` cache (see
    // `MobileMenuIsland.astro`'s file doc), and `NextEventsSection` uses an
    // optimistic client-hydration fallback (see its own comments) — neither
    // depends on `Astro.locals.user` being populated here anymore.
    if (isServerIslandRoute({ path })) {
        (context.locals as { user: null }).user = null;
        return next();
    }

    // Step 3: Enforce trailing slash before Astro tries to resolve the route.
    // With trailingSlash: 'always' in astro.config.mjs, a path without a trailing
    // slash would cause Astro to throw instead of returning a clean 404.
    if (path !== '/' && !path.endsWith('/')) {
        const search = context.url.search;
        return context.redirect(`${path}/${search}`, 301);
    }

    // Step 3.1: Legacy URL alias — the inbox page was originally hosted at
    // `/{locale}/mi-cuenta/messages/...` (English slug). It was renamed to
    // `/consultas/` for parity with the rest of the account section, which is
    // all-Spanish. Any old link (bookmark, email) gets a permanent 308
    // redirect so deep links to specific conversations
    // (`/messages/{conversationId}`) continue to work.
    const legacyMessagesMatch = path.match(/^\/(es|en|pt)\/mi-cuenta\/messages(\/.*)?$/);
    if (legacyMessagesMatch) {
        const localeSegment = legacyMessagesMatch[1];
        const tail = legacyMessagesMatch[2] ?? '/';
        const search = context.url.search;
        return context.redirect(`/${localeSegment}/mi-cuenta/consultas${tail}${search}`, 308);
    }

    // Step 3.2 (BETA-162): Legacy/natural URL alias — the blog lives at
    // `/{locale}/publicaciones/` but `/{locale}/blog` is the URL a user or
    // search engine would naturally type/guess. It 404'd with no redirect.
    // Permanent 301 (not 308, per BETA-162) since this is a one-way SEO/UX
    // alias, not a deep-link-preserving rename like the messages case above.
    const legacyBlogMatch = path.match(/^\/(es|en|pt)\/blog(\/.*)?$/);
    if (legacyBlogMatch) {
        const localeSegment = legacyBlogMatch[1];
        const tail = legacyBlogMatch[2] ?? '/';
        const search = context.url.search;
        return context.redirect(`/${localeSegment}/publicaciones${tail}${search}`, 301);
    }

    // Step 4: Extract and validate locale from the URL path.
    const { locale, restOfPath } = extractLocaleFromPath({ path });

    // If the locale segment is missing or not a supported locale, redirect to the
    // default locale while preserving the rest of the path.
    // REQ-19: 301 (permanent) — this is a stable URL strategy decision; Google
    // passes full link equity through 301s but not through the default 302.
    if (locale === null) {
        const redirectUrl = buildLocaleRedirect({ restOfPath: restOfPath || path });
        return context.redirect(redirectUrl, 301);
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

        // Step 7.2 (SPEC-239): Must-change-password gate.
        //
        // Commerce owners are provisioned with a server-generated password and
        // the `mustChangePassword` flag set to true. Until they choose a personal
        // password, ALL protected routes (except the change-password page itself
        // and auth/signout) redirect to /mi-cuenta/cambiar-contrasena/.
        //
        // Whitelist:
        //   - The cambiar-contrasena page itself (prevents redirect loop).
        //   - Auth routes (signout must always work).
        // Fail-open: if mustChangePassword is missing/false, pass through.
        if (
            user &&
            user.mustChangePassword === true &&
            isProtectedRoute({ path }) &&
            !isChangePasswordRoute({ path }) &&
            !isAuthRoute({ path })
        ) {
            const redirectUrl = buildChangePasswordRedirect({ locale });
            return context.redirect(redirectUrl);
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

    // Step 9: Attach a Content-Security-Policy header (enforce mode, HOS-30 Phase 2,
    // T-020) to all HTML responses AND stamp the per-request nonce on every inline
    // <style>/<script> Astro emitted without one (so they match the policy below).
    // The CSP header is the single source of truth; the body rewrite makes the
    // policy actually enforceable for inline emissions Astro doesn't tag itself.
    //
    // NOTE (HOS-74): this middleware runs per-request ONLY for SSR routes. A route
    // with `export const prerender = true` runs middleware just once — at build
    // time, to emit its static file; in production @astrojs/node `standalone`
    // serves that file straight off disk WITHOUT re-invoking middleware, so a
    // header set here never reaches it. `staticHeaders: true` only forwards the
    // headers Astro's native `security.csp` build feature registers, NOT this
    // hand-built header. That is why every content page was moved off `prerender`
    // onto this SSR path (HOS-74; the home page led the way under HOS-30 2.C). Do
    // NOT re-add `prerender` to any page that needs the CSP header — it will
    // silently ship with no policy. The `context.isPrerendered` term below is
    // unreachable for a served response (prerendered files bypass this middleware
    // at request time) and kept only as a defensive guard.
    const contentType = response.headers.get('content-type') ?? '';
    const isHtmlPage = contentType.includes('text/html') || context.isPrerendered;

    if (isHtmlPage) {
        const sentryDsn = import.meta.env.PUBLIC_SENTRY_DSN as string | undefined;
        const dedicatedCspReportUri = import.meta.env.PUBLIC_SENTRY_CSP_REPORT_URI as
            | string
            | undefined;
        const sentryReportUri = resolveSentryReportUri({ sentryDsn, dedicatedCspReportUri });

        const directives = buildCspHeader({
            nonce: cspNonce,
            apiUrl: (import.meta.env.PUBLIC_API_URL as string | undefined) ?? undefined,
            sentryReportUri,
            // Drop the external *.sentry.io connect-src when the first-party
            // Sentry tunnel is active (SPEC-181 follow-up).
            sentryTunnelEnabled: Boolean(import.meta.env.PUBLIC_SENTRY_TUNNEL),
            // HOS-91: relax style-src in dev only (see buildCspHeader JSDoc).
            isDev: isDevelopment()
        });

        if (!context.isPrerendered) {
            // SSR pages: rewrite body to stamp nonces on inline <style>/<script>
            // tags before setting the header. Content-Length is dropped because the
            // rewrite changes body size; Node will recompute it on send.
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
        }
        // Defensive branch (HOS-74: no page currently opts into `prerender`, so
        // this is unreachable for a served response — prerendered files bypass
        // this middleware entirely at request time). Historically, prerendered
        // pages skipped the body rewrite because nonces cannot be embedded at
        // build time — any un-nonced inline <style>/<script> was dropped under
        // enforce mode. Kept as a guard.

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
