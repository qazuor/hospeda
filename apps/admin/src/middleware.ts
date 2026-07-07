/**
 * TanStack Start HTTP request middleware for Content-Security-Policy header
 * injection. Generates a cryptographically random nonce per request and sets
 * it in the CSP Report-Only header.
 *
 * HOS-33 T-006: converted from `createMiddleware({ type: 'function' })` to
 * `createMiddleware({ type: 'request' })`. Verified against the installed
 * `@tanstack/start-client-core` 1.170.13 source
 * (`dist/esm/createMiddleware.d.ts` / `createStartHandler.js`):
 *
 * - A `type: 'request'` middleware's `.server()` handler is invoked for
 *   EVERY request the framework handles, with `handlerType: 'router'` for
 *   page loads (including the initial SSR HTML document) and
 *   `handlerType: 'serverFn'` for server function calls. One middleware now
 *   gives full HTTP-level coverage (GAP-042-13) — there is no need for a
 *   second, parallel `type: 'function'` middleware, and this one is no
 *   longer registered in `functionMiddleware` (see `start.ts`).
 * - `next({ context })` recursively runs the ENTIRE downstream chain
 *   (including the SSR render / server-fn handler) before resolving, so
 *   `await next(...)` returns only once `result.response` is a fully
 *   populated `Response`. The context passed to `next()` is also threaded
 *   through `runWithStartContext()` before the downstream handler runs,
 *   which is what makes it readable via `getGlobalStartContext()` *during*
 *   the SSR render itself (consumed by `getCspNonceOnServer` in
 *   `src/lib/csp-nonce.ts`, wired into `router.tsx`'s `ssr.nonce`).
 * - `result.response` is always a genuine Web API `Response` instance here
 *   (verified via `renderRouterToStream.tsx`'s `new Response(stream, {
 *   status, headers })` and `redirect()`'s `new Response(null, { status,
 *   headers })` — TanStack redirects ARE `Response` subclasses, not a
 *   distinct shape). Freshly-constructed `Response` objects have mutable
 *   headers by default (the Fetch spec's immutable-headers guard only
 *   applies to responses obtained via `Response.error()`/`Response.redirect()`
 *   or intercepted via a Service Worker), so `response.headers.set(...)` is
 *   safe to call directly — no need to reconstruct/clone the response.
 *
 * Phase 1 (Report-Only): Scripts without nonce are reported but not blocked.
 * Phase 2 (enforcement) is a separate follow-up (SPEC-042 Phase 2 / SPEC-046),
 * out of scope here.
 *
 * @see https://tanstack.com/start/latest/docs/framework/react/middleware
 */

import { createMiddleware } from '@tanstack/react-start';
import { buildCspDirectives } from './lib/csp-helpers';

/** Header name for CSP Report-Only mode (does not block, only reports violations). */
const CSP_HEADER_NAME = 'Content-Security-Policy-Report-Only' as const;

// Web Crypto is used instead of `node:crypto` so this module stays free of
// Node built-in imports. TanStack Start evaluates start.ts in both server and
// client bundles; a `node:crypto` import here was being pulled into the
// client bundle and breaking SPA hydration with a CORS error.
function generateCspNonce(byteLength: number): string {
    const bytes = new Uint8Array(byteLength);
    crypto.getRandomValues(bytes);
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * CSP middleware that generates a per-request nonce and sets the CSP header
 * on every response the framework produces (SSR page loads AND server
 * function calls — see the module doc above).
 *
 * Registered as `requestMiddleware` in `start.ts`. The nonce is exposed to
 * the rest of the request lifecycle as `context.cspNonce`: downstream, the
 * SSR render (triggered by the `next()` call below) reads it back out via
 * `getGlobalStartContext()` (see `src/lib/csp-nonce.ts`'s
 * `getCspNonceOnServer`, wired into `router.tsx`'s `ssr.nonce`), so the same
 * nonce that ends up in this response's CSP header is also the one applied
 * to `ssr.nonce` — and therefore to every nonce'd `<script>`/`<style>` tag
 * TanStack Router renders for this request.
 */
export const cspMiddleware = createMiddleware({ type: 'request' }).server(async ({ next }) => {
    const nonce = generateCspNonce(16);
    const sentryDsn = import.meta.env.VITE_SENTRY_DSN ?? '';
    // Dedicated `hospeda-csp` Sentry project for CSP violation reports, kept
    // separate from the admin's own error-tracking project (VITE_SENTRY_DSN).
    // Falls back to the DSN-derived report-uri when unset (see buildCspDirectives).
    const cspReportUri = import.meta.env.VITE_SENTRY_CSP_REPORT_URI ?? '';
    const cspValue = buildCspDirectives({ nonce, sentryDsn, cspReportUri });

    const result = await next({ context: { cspNonce: nonce } });

    result.response.headers.set(CSP_HEADER_NAME, cspValue);

    return result;
});
