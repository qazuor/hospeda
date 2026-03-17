/**
 * TanStack Start server function middleware for Content-Security-Policy header injection.
 * Generates a cryptographically random nonce per request and sets it in
 * the CSP Report-Only header.
 *
 * NOTE: In v1.131.26, `createMiddleware({ type: 'function' })` creates a server function
 * middleware, not an HTTP request middleware. This means CSP headers are set on responses
 * to server function calls, but NOT on initial page loads (SSR HTML).
 *
 * Full HTTP-level coverage requires either:
 * - TanStack Start >= 1.132.0 with `createStart({ requestMiddleware })` (Vite 7)
 * - Modifying server.ts to wrap the handler with h3 middleware
 *
 * Phase 1 (Report-Only): Scripts without nonce are reported but not blocked.
 * Phase 2 (enforcement): Blocked until Vite 7 migration provides both
 * `createStart` for HTTP middleware and `ssr.nonce` for script tag injection.
 *
 * @see https://tanstack.com/start/latest/docs/framework/react/middleware
 */

import { randomBytes } from 'node:crypto';
import { createMiddleware } from '@tanstack/react-start';
import { setResponseHeader } from '@tanstack/react-start/server';
import { buildCspDirectives } from './lib/csp-helpers';

/** Header name for CSP Report-Only mode (does not block, only reports violations). */
const CSP_HEADER_NAME = 'Content-Security-Policy-Report-Only' as const;

/**
 * CSP middleware that generates a per-request nonce and sets the CSP header.
 *
 * Registered globally via `registerGlobalMiddleware` in `start.ts`, this middleware
 * runs on every server function invocation and injects CSP Report-Only headers
 * into the response.
 *
 * The nonce is also exposed in the server context as `cspNonce` for downstream
 * server functions that may need it (e.g., rendering inline scripts).
 */
export const cspMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
    const nonce = randomBytes(16).toString('base64url');
    // Server-side only: process.env is sufficient in middleware context
    const sentryDsn = process.env.VITE_SENTRY_DSN || '';
    const cspValue = buildCspDirectives({ nonce, sentryDsn });

    /**
     * Sets the CSP header on the current HTTP response.
     *
     * Uses `setResponseHeader()` from `@tanstack/react-start/server`, which is an
     * H3 API that accesses the underlying event from async local storage. This means
     * it works in server function context (where this middleware runs) but does NOT
     * apply to initial SSR page renders -- only to server function call responses.
     *
     * This deviates from the spec's `getResponseHeaders().set()` pattern because
     * TanStack Start's `createMiddleware({ type: 'function' })` does not expose
     * response headers directly. The H3 approach works correctly for server functions
     * and will be replaced with `createStart({ requestMiddleware })` once Vite 7
     * migration enables full HTTP-level middleware support.
     */
    setResponseHeader(CSP_HEADER_NAME, cspValue);

    return next({ context: { cspNonce: nonce } });
});
