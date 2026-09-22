import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';
import { createServerEntry } from '@tanstack/react-start/server-entry';
import { reportInternalBypassSelfCheck } from './lib/internal-bypass-report';
import { applySecurityHeaders } from './lib/security-headers';

/**
 * HOS-1153 startup self-check, the admin twin of the one `apps/web`'s
 * `src/middleware.ts` runs (HOS-155).
 *
 * Runs once at server-entry module load — this file is the SSR entry, so this
 * is the admin's earliest server-side hook. Deliberately at module scope and
 * not per-request: the config cannot change between requests, and an alert per
 * request would be noise.
 *
 * Reads `process.env` directly rather than the lazy `env` proxy, so the READ
 * does not depend on `validateAdminEnv()` succeeding. That is a narrower claim
 * than "the diagnostic always runs", and the difference matters: it reorders
 * nothing. If another module dereferences the proxy earlier in the bundle's
 * module graph and validation throws, the process dies before this line is
 * reached — measured with an invalid `VITE_SENTRY_ENVIRONMENT` baked into a
 * build, where the uncaught exception fires ~251 lines ahead of this check in
 * `index.mjs` and the alert never prints. That case is loud on its own (a fatal
 * boot error naming the offending var), so it is not the silent failure this
 * check exists for.
 *
 * What the direct read does buy: the check can report a config whose vars are
 * each individually VALID — both are `.optional()` — yet jointly incoherent,
 * which is exactly the shape validation cannot flag.
 *
 * Wrapped in try/catch as belt-and-suspenders: nothing here may ever prevent
 * the server from booting.
 */
try {
    reportInternalBypassSelfCheck({
        internalApiUrl: process.env.HOSPEDA_INTERNAL_API_URL,
        internalRequestSecret: process.env.HOSPEDA_INTERNAL_REQUEST_SECRET,
        isProd: process.env.NODE_ENV === 'production'
    });
} catch (error) {
    console.error('[admin] internal-bypass self-check threw at startup:', error);
}

/**
 * SPEC-209 T-002: cheap container healthcheck endpoint.
 *
 * TanStack Start >= 1.132.0 replaces the curried `createStartHandler({
 * createRouter })` + `defineHandlerCallback` pattern with a direct-callback
 * API. `createStartHandler(cb)` returns a plain `(request: Request) =>
 * Promise<Response>` function (verified against the installed
 * `@tanstack/react-start` 1.168.27 source: `requestHandler()` in
 * `dist/esm/server.js` wraps the resolver as `(request, requestOpts) =>
 * ...`), so the exported default handler is now called directly with the
 * Web API `Request`, not a `{ request }`-wrapped event object.
 *
 * `/healthz` is intercepted HERE — before `createStartHandler`'s resolver
 * runs — so no React tree is built and no QZPayBilling instance is
 * constructed. Because it bypasses `createStartHandler` entirely, it also
 * bypasses `cspMiddleware` (`../middleware.ts`) — so `healthcheckResponse`
 * applies the H-170 baseline security headers itself, directly, rather than
 * relying on that middleware. This is a container-internal probe (Coolify's
 * Docker healthcheck), not a browser-facing response, so the headers carry
 * no real security value here — they are added purely for response
 * consistency across the app's surfaces, at zero risk: the status/body/
 * content-type this endpoint is depended on for are untouched.
 *
 * Background: TanStack Start 1.131.26 + @tanstack/router-generator 1.131.26
 * compile `server.handlers.GET` into the SSR bundle correctly, but the
 * route generator never emits `serverRouteTree` from `routeTree.gen.ts`.
 * The SSR dispatch code short-circuits on `t.serverRouteTree && …`, so
 * `server.handlers` is permanently a no-op in this version. Intercepting
 * at the renderer level is the correct workaround.
 *
 * HOS-33 note: re-verify whether `server.handlers` routes are still a no-op
 * on 1.168.27 before converting this to a proper server route — that
 * re-evaluation is out of scope for this task (tracked separately).
 */

const HEALTHCHECK_PATH = '/healthz';

/**
 * Returns a 200 JSON `{"status":"ok"}` Response when the request targets
 * `/healthz`, or `null` for every other path so the caller can fall through
 * to the SSR handler.
 *
 * Extracted as a pure named export so unit tests can exercise the healthcheck
 * logic without spinning up the Nitro/H3 server or the TanStack router
 * (SPEC-209 T-005).
 *
 * @param request - The Web API Request to inspect.
 * @returns A Response for `/healthz` probes, or `null` otherwise.
 */
export function healthcheckResponse(request: Request): Response | null {
    const { pathname } = new URL(request.url);

    if (pathname !== HEALTHCHECK_PATH) {
        return null;
    }

    const response = new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
    });
    applySecurityHeaders({ headers: response.headers });
    return response;
}

/**
 * `defaultStreamHandler` already matches the `({ request, router,
 * responseHeaders }) => Response | Promise<Response>` shape
 * `createStartHandler` expects, and TanStack Start's own generated
 * default-entry (`@tanstack/react-start/server-entry`) uses it exactly this
 * way (`createStartHandler(defaultStreamHandler)`) with no manual router
 * construction. `createStartHandler` builds and fully loads the router
 * itself (via the auto-discovered router entry from `router.tsx`) BEFORE
 * invoking the callback, so calling `createRouter()` again here would
 * produce a second, unloaded router instance instead of reusing the
 * framework-managed one — verified by reading `createStartHandler`'s
 * bundled source (`executeRouter` awaits `routerInstance.load()` and
 * `dehydrate()` prior to calling `cb`).
 */
const startHandler = createStartHandler(defaultStreamHandler);

/**
 * HOS-33 T-014 fix: the default export MUST be an object with a `fetch`
 * method, not a bare function. Verified by reading the framework's own
 * generated default entry source
 * (`@tanstack/react-start/dist/default-entry/esm/server.js`):
 *
 *   var fetch = createStartHandler(defaultStreamHandler);
 *   var server_default = createServerEntry({ fetch });
 *
 * A bare-function default export builds and typechecks fine (nothing in the
 * type surface enforces the `.fetch` shape), and even worked under the
 * plain Vite SSR build we had before wiring the Nitro plugin -- but Nitro's
 * runtime dispatcher (`.output/server/_chunks/ssr-renderer.mjs`) calls
 * `entry.fetch(request)` on whatever this module exports, so a bare
 * function throws `TypeError: n.fetch is not a function` on every request.
 * `createServerEntry` itself is a trivial identity wrapper (just re-exposes
 * whatever `.fetch` it's given), used here only for parity with the
 * framework's own convention.
 */
export default createServerEntry({
    async fetch(request: Request): Promise<Response> {
        const hc = healthcheckResponse(request);
        if (hc) return hc;

        return startHandler(request);
    }
});
