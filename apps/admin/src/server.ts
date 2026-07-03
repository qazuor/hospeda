import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';
import { createServerEntry } from '@tanstack/react-start/server-entry';

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
 * constructed.
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

    return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
    });
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
