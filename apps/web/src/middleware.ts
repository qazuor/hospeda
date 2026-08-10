/**
 * Astro middleware for locale validation and authentication protection.
 *
 * Pipeline (in order):
 * 1. Skip static assets and API routes
 * 2. Handle Server Island requests (skip locale enforcement; no session
 *    parse — see the Step 2 block below for why)
 * 3. Enforce trailing slash (301 redirect before Astro resolves the route)
 * 3.1. Legacy URL aliases (e.g. `/mi-cuenta/messages` -> `/mi-cuenta/consultas`,
 *      `/blog` -> `/publicaciones`, `/publicaciones/autor` -> `/autores`)
 *      redirect before locale/route resolution
 * 4. Extract and validate locale from URL path; redirect invalid locales to default
 * 5. Set validated locale in context.locals
 * 6. Parse session only for routes that need it (protected + auth)
 * 7. Protect /mi-cuenta/* routes (redirect to login if unauthenticated)
 * 8. Rewrite 404 responses to the custom 404 page
 * 8b. Rewrite 410 (Gone) responses to the same styled page, forcing the 410 status
 * 9. Set Content-Security-Policy header (enforce mode, HOS-30 Phase 2) on HTML responses
 * 10. Set X-Robots-Tag noindex on hosts in HOSPEDA_NOINDEX_HOSTS (e.g. staging)
 * 11. Serialize the collected cache tags into the Cache-Tag header on
 *     edge-cacheable responses (HOS-369 W1-1)
 */

import { defineMiddleware } from 'astro:middleware';
import { CACHE_TAG_HEADER_NAME, serializeCacheTags } from '@repo/cache-tags';
import { collectCspHashes } from '../integrations/csp-hash-collector';
import { schedulePurgeOnDeploy } from './lib/cache/purge-on-deploy';
import { isEdgeCacheableControl } from './lib/cache/response-cache';
import {
    getInternalApiUrl,
    getInternalRequestSecret,
    getNoindexHosts,
    isDevelopment,
    isProduction
} from './lib/env';
import { initIconSprite } from './lib/icon-sprite';
import { reportInternalBypassSelfCheck } from './lib/internal-bypass-report';
import {
    buildChangePasswordRedirect,
    buildCspHeader,
    buildLocaleRedirect,
    buildLoginRedirect,
    buildProfileCompletionRedirect,
    buildSetPasswordRedirect,
    extractLocaleFromPath,
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
import { CJS_ESM_BRIDGES_WARMED } from './lib/warm-cjs-esm-bridges';

/**
 * Boot-time link of CommonJS -> ESM-only dependency bridges (HOS-370).
 *
 * Middleware is part of the SSR **entry** chunk, so importing the warm-up module
 * here is what forces those bridges to be linked during boot — single-threaded,
 * before the listener accepts traffic — instead of mid-request from a lazily
 * loaded route chunk, where the synchronous `require(esm)` link can lose a race
 * and permanently 500 that route. The assertion exists so the module cannot be
 * tree-shaken out of the entry: a side-effect-only import with no referenced
 * binding is droppable, a referenced one is not.
 */
if (!CJS_ESM_BRIDGES_WARMED) {
    throw new Error('[middleware] CJS/ESM bridge warm-up module failed to load');
}

/**
 * Boot-time activation of the external icon sprite (HOS-369 W3-6).
 *
 * Middleware is part of the SSR **entry** chunk, so this runs once during boot,
 * before the listener accepts traffic — which is the only correct time. Sprite
 * mode is a module-level singleton in `@repo/icons`; flipping it from a layout
 * or a page would leave every icon already rendered in that tree inline, and the
 * document would ship both forms. Building the sprite itself (rendering ~1,000
 * symbols and hashing them) also belongs to boot, not to a request.
 *
 * It stays OFF until this call, which is what leaves `apps/admin` — which has no
 * sprite endpoint and never makes it — rendering icons exactly as before.
 *
 * Guarded by `import.meta.env.SSR` for the same reason the self-check below is:
 * it is false under vitest, and a module-level singleton flipped there would
 * reach into every OTHER test in the same worker that renders an icon, changing
 * markup those tests never asked about. Production and `astro build` both see
 * `true`, so the shipped behaviour is unconditional.
 */
if (import.meta.env.SSR) {
    initIconSprite();
}

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
 * Startup self-check for the SSR internal-request rate-limit bypass
 * (HOS-155, incident follow-up to HOS-103).
 *
 * Runs exactly once, at module load, only when actually running on the SSR
 * server (`import.meta.env.SSR`) — never during the build/prerender pass and
 * never in the browser bundle. On misconfiguration this ALERTS LOUDLY (ERROR
 * log + Sentry capture) but deliberately never throws: a bug in the alert
 * path itself must not turn into a boot crash-loop. See
 * `./lib/internal-bypass-selfcheck.ts` for the pure check logic and
 * `./lib/internal-bypass-report.ts` for the (unit-tested) alerting wrapper,
 * plus full incident background.
 *
 * This block's build-time safety (it never runs during `astro build`) relies
 * on the HOS-74 invariant that NO route declares `export const prerender =
 * true` — enforced by the guard test in `./lib/__tests__/csp-middleware.test.ts`.
 */
if (import.meta.env.SSR) {
    try {
        reportInternalBypassSelfCheck({
            internalApiUrl: getInternalApiUrl(),
            internalRequestSecret: getInternalRequestSecret(),
            isProd: isProduction()
        });
    } catch (error) {
        // The self-check must never break middleware module load.
        console.error('[web] SSR internal-bypass self-check threw unexpectedly:', error);
    }
}

/**
 * Main middleware handler for all requests in the web application.
 */
export const onRequest = defineMiddleware(async (context, next) => {
    // Step -1: Take this process's one shot at purging the edge cache for the
    // deploy that started it (HOS-427). Deliberately the FIRST thing in the
    // handler, before the static-asset early return, so the container's very
    // first request — which in practice is Coolify's healthcheck — starts the
    // clock. It no-ops on every subsequent call, never awaits, and never
    // throws; the purge itself settles and runs in the background. See
    // `./lib/cache/purge-on-deploy.ts` for why it waits before firing.
    void schedulePurgeOnDeploy();

    const path = context.url.pathname;

    // Step 0: Open the cache-tag collector for this request. Created before any
    // branch returns so `Astro.locals.cacheTags` is never undefined for a
    // downstream caller, whatever path the request takes. Serialized into the
    // `Cache-Tag` header at Step 11 (HOS-369 W1-1).
    context.locals.cacheTags = new Set<string>();

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

    // Step 3.3 (HOS-375): The author page moved out from under the blog — it now
    // carries events as well as posts, so living at `/publicaciones/autor/` said
    // the wrong thing about its content. One regex covers the whole subtree: the
    // tail capture carries both the bare slug and the `/page/<n>/` pagination
    // suffix, whose shape was kept byte-identical on the new route precisely so
    // this stays a splice of the path's head.
    //
    // 301, not the 308 the messages alias uses: 308's only added guarantee is
    // method preservation on POST/PUT, and this is a GET-only public page. What
    // matters here is consolidating search authority onto the new URL, which
    // both codes do.
    //
    // `/publicaciones/autor/` with no slug redirects to `/autores/`, which does
    // not exist yet (NG-1) and 404s. That is deliberate and not a regression:
    // the old bare URL was a 404 too, since the route it lived on was `[slug]`.
    // The day an authors index ships, this redirect already points at it.
    const legacyAuthorMatch = path.match(/^\/(es|en|pt)\/publicaciones\/autor(\/.*)?$/);
    if (legacyAuthorMatch) {
        const localeSegment = legacyAuthorMatch[1];
        const tail = legacyAuthorMatch[2] ?? '/';
        const search = context.url.search;
        return context.redirect(`/${localeSegment}/autores${tail}${search}`, 301);
    }

    // Step 4: Extract and validate locale from the URL path.
    const { locale, restOfPath } = extractLocaleFromPath({ path });

    // If the locale segment is missing or not a supported locale, redirect to the
    // default locale while preserving the rest of the path AND the query string.
    // REQ-19: 301 (permanent) — this is a stable URL strategy decision; Google
    // passes full link equity through 301s but not through the default 302.
    //
    // `context.url.search` is passed for the same reason Steps 3, 3.1 and 3.2
    // pass it: dropping it silently strips campaign parameters from every
    // locale-less link (`/?utm_source=newsletter` → a bare `/es/`), and the
    // attribution is gone before analytics sees the first pageview.
    if (locale === null) {
        const redirectUrl = buildLocaleRedirect({
            restOfPath: restOfPath || path,
            search: context.url.search
        });
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
        // HOS-296: `parseSessionUser` reads `/api/v1/public/auth/me` — the only
        // endpoint carrying the role SET — in exactly ONE request. The step-7.2
        // `mustChangePassword` gate below is served from the same payload
        // (`actor.mustChangePassword`), so no route pays a second round-trip.
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
                // Role bypass approach: the admin/super_admin bypass roles are
                // resolved lazily from /api/v1/public/auth/me, only when a
                // redirect would otherwise occur. This avoids an extra HTTP
                // call on every request where the flags already pass.
                // (`user.roles` is available here since HOS-296, but keeping
                // the lazy fetch preserves the existing call pattern and its
                // fail-closed error handling.)

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

    // Step 8b: A soft-deleted PUBLIC entity returns 410 Gone (the SEO desindex
    // signal — HOS-117 T-022 for accommodations/posts, HOS-256 for events/
    // destinations). Without this branch a 410 falls straight through with an
    // empty body — a blank page, no site chrome, i18n, or navigation. Render the
    // same styled error page for chrome, but FORCE the status back to 410:
    // Astro assigns `/404` a 404 status by convention, so a bare
    // `rewrite('/404')` would coerce the 410 → 404 and lose the desindex signal
    // (verified empirically); the re-wrap below only overrides the status line
    // while the body and headers pass through unchanged.
    //
    // The rewritten error page (404 and 410 alike) ships WITHOUT the CSP header.
    // `context.rewrite('/404')` DOES re-run onRequest for `/404` (Astro spins up
    // a fresh middleware pass per rewrite — the same reason it caps rewrite depth
    // at 4 with a 508 "Loop Detected"), but that re-entered pass hits Step 1's
    // `isStaticAssetRoute()` match for `/404` (`path === '/404'`/`'/404/'`) and
    // returns immediately, BEFORE Step 9 (CSP) ever runs — so CSP is never applied
    // to error pages regardless. Pre-existing gap the 404 branch already has; the
    // 410 branch inherits it for parity (not a new regression), tracked in HOS-263.
    //
    // This branch intentionally uses `rendered.headers` and drops the original
    // 410 response's headers. That is safe ONLY because every current 410
    // producer (`alojamientos/[slug].astro`, `eventos/[slug].astro`,
    // `destinos/[...path].astro`, `experiencias/[slug].astro`,
    // `gastronomia/[slug].astro`, `publicaciones/[slug].astro`) returns
    // `new Response(null, { status: 410 })` with no headers — a future 410
    // producer that attaches headers (e.g. Cache-Control) would silently lose
    // them here.
    if (response.status === 410) {
        const rendered = await context.rewrite('/404');
        return new Response(rendered.body, {
            status: 410,
            headers: rendered.headers
        });
    }

    // Step 9: Attach a Content-Security-Policy header (enforce mode, HOS-30 Phase 2,
    // T-020) to all HTML responses. The policy allows every inline <style>/<script>
    // by the sha256 of its own content, computed from the rendered body below.
    // The body is NOT modified — it is only read (HOS-369 WB0-1). The previous
    // implementation stamped a per-request nonce instead, which Cloudflare would
    // cache alongside the body and turn into a publicly readable token for the
    // whole TTL (spec §5.13 / D-9). A content hash cannot desynchronize from the
    // body it describes, cached or not.
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

        // Hash sources for this exact response. They stay empty on the
        // defensive prerendered branch (HOS-74: no page currently opts into
        // `prerender`, so it is unreachable for a served response — prerendered
        // files bypass this middleware entirely at request time). Reading the
        // body there would consume the static file's stream, and a build-time
        // hash could not describe a body served straight off disk anyway.
        let scriptHashes: readonly string[] = [];
        let styleHashes: readonly string[] = [];

        if (!context.isPrerendered) {
            // SSR pages: read the rendered body, hash its inline blocks, and
            // hand back a Response over the SAME body — the HTML is never
            // modified. Content-Length is dropped defensively (re-encoding a
            // decoded string is byte-identical for valid UTF-8, but Node
            // recomputes it on send, so a stale value can never ship).
            const originalBody = await response.text();
            const collected = await collectCspHashes({ html: originalBody });
            scriptHashes = collected.scriptHashes;
            styleHashes = collected.styleHashes;

            const newHeaders = new Headers(response.headers);
            newHeaders.delete('content-length');
            response = new Response(originalBody, {
                status: response.status,
                headers: newHeaders
            });
        }

        const directives = buildCspHeader({
            scriptHashes,
            styleHashes,
            apiUrl: (import.meta.env.PUBLIC_API_URL as string | undefined) ?? undefined,
            sentryReportUri,
            // Drop the external *.sentry.io connect-src when the first-party
            // Sentry tunnel is active (SPEC-181 follow-up).
            sentryTunnelEnabled: Boolean(import.meta.env.PUBLIC_SENTRY_TUNNEL),
            // Dev-only CSP relaxations, both caused by Astro's ClientRouter
            // behaving differently under `astro dev` (see buildCspHeader JSDoc):
            // HOS-91's style-src, plus frame-src 'self' for the hidden
            // same-origin iframe it uses to prepare `client:only` islands.
            isDev: isDevelopment()
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

    // Step 11: Emit the `Cache-Tag` header so this response can be purged
    // selectively instead of by flushing the whole zone (HOS-369 W1-1, §5.5).
    //
    // Written here, after the render, rather than by the page that decided the
    // caching: layouts and nested components run their frontmatter after the
    // page's, so a header written in page frontmatter could not include what
    // they contribute. It is also written after the CSP branch above, which
    // REPLACES `response` with a new object — setting the header before that
    // point would drop it on the floor for every SSR HTML page.
    //
    // Only tagged, shared-cacheable responses get the header. An untagged
    // cacheable response is prevented upstream: `applyCacheHeaders` cannot
    // declare one (see `lib/cache/response-cache.ts`), and the static guard
    // `test/static-guards/cacheable-responses-declare-tags.guard.test.ts` fails
    // the build if any source file sets a public `Cache-Control` on its own.
    //
    // Cloudflare consumes and strips `Cache-Tag` before the response reaches the
    // visitor, so the entity slugs and ids inside it are never exposed and cost
    // the client nothing.
    if (context.locals.cacheTags.size > 0) {
        const cacheControl = response.headers.get('Cache-Control');
        if (isEdgeCacheableControl({ cacheControl })) {
            const { header } = serializeCacheTags({ tags: context.locals.cacheTags });
            if (header !== null) {
                response.headers.set(CACHE_TAG_HEADER_NAME, header);
            }
        }
    }

    return response;
});
