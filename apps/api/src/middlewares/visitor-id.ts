/**
 * Visitor-ID cookie middleware.
 *
 * Assigns every request (authenticated or anonymous) an opaque `hospeda_vid`
 * identifier so operators can group log lines from the same browser session
 * even when there is no authenticated user — the missing piece for tracing
 * an anonymous user's journey through the logs (SPEC-184 follow-up).
 *
 * Design (deliberate, do not change without owner sign-off):
 * - Strictly-necessary / functional cookie, NOT an analytics/tracking cookie:
 *   it carries no personal data, is never sent to a third party, and exists
 *   purely for first-party debugging/log-correlation. This is why it does
 *   NOT require a cookie-consent banner.
 * - Session-scoped: no `maxAge`/`expires` is set, so the cookie dies when the
 *   browser closes. It intentionally does NOT persist visitor identity
 *   across sessions.
 * - Opaque random UUID (`crypto.randomUUID()`) — carries no information
 *   about the visitor, cannot be reversed to an identity.
 * - `HttpOnly` (never readable/writable by client JS) + `Secure` (in
 *   production only, mirroring Better Auth's `useSecureCookies` in
 *   `lib/auth.ts` — local dev runs over plain HTTP, where a `Secure` cookie
 *   would be dropped and the id would regenerate every request) +
 *   `SameSite=Lax`, host-only (no explicit `domain`) — the narrowest safe
 *   cookie shape. Unlike Better Auth's session cookie (see
 *   `crossSubDomainCookies` in `lib/auth.ts`), this cookie deliberately does
 *   NOT need to be shared across `*.hospeda.com.ar` subdomains: it only
 *   groups requests made directly to this API host.
 * - The value read back from an incoming cookie is validated against the
 *   exact `crypto.randomUUID()` shape before use. Any client can send an
 *   arbitrary `Cookie: hospeda_vid=...` header; without validation that raw,
 *   unbounded string would be merged verbatim into every stdout log line for
 *   the request (the top-level context merge is NOT length-capped), a
 *   zero-auth way to inflate log volume or smuggle control characters. A
 *   non-matching value is treated as absent and regenerated.
 *
 * @module middlewares/visitor-id
 */

import type { MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { setRequestContextVisitor } from '../lib/request-context';
import { env } from '../utils/env';

/** Name of the session-scoped visitor-id cookie. */
export const VISITOR_ID_COOKIE_NAME = 'hospeda_vid';

/**
 * Canonical `crypto.randomUUID()` shape (RFC 4122 v4). Used to reject any
 * client-supplied `hospeda_vid` value that this server did not mint.
 */
const VISITOR_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Whether a value read from the incoming cookie is a well-formed visitor id
 * (i.e. one this server minted). Anything else is treated as absent.
 *
 * @param value - Raw cookie value, if any
 * @returns `true` when the value matches the expected UUID v4 shape
 */
function isValidVisitorId(value: string | undefined): value is string {
    return value !== undefined && VISITOR_ID_PATTERN.test(value);
}

/**
 * Hono middleware that ensures every request carries a `hospeda_vid` cookie
 * and pushes its value into the AsyncLocalStorage request-context store.
 *
 * Must be registered AFTER {@link requestContextMiddleware} (so the ALS store
 * already exists when {@link setRequestContextVisitor} is called) and BEFORE
 * auth/actor middleware (visitor grouping is independent of, and available
 * before, authentication resolves).
 *
 * @returns Hono middleware handler
 *
 * @example
 * ```ts
 * // In create-app.ts, right after requestContextMiddleware():
 * app.use(wrapMiddleware(requestContextMiddleware()))
 *    .use(wrapMiddleware(visitorIdMiddleware()));
 * ```
 */
export function visitorIdMiddleware(): MiddlewareHandler {
    return async (c, next) => {
        const incoming = getCookie(c, VISITOR_ID_COOKIE_NAME);
        // Only trust a value we minted; a malformed/attacker-supplied cookie is
        // regenerated rather than propagated into logs.
        let visitorId = isValidVisitorId(incoming) ? incoming : undefined;

        if (visitorId === undefined) {
            visitorId = crypto.randomUUID();
            setCookie(c, VISITOR_ID_COOKIE_NAME, visitorId, {
                // No maxAge/expires: session cookie, dies on browser close.
                httpOnly: true,
                // Secure only in prod: local dev is plain HTTP, where a Secure
                // cookie is dropped (matches `useSecureCookies` in lib/auth.ts).
                secure: env.NODE_ENV === 'production',
                sameSite: 'Lax',
                path: '/'
            });
        }

        setRequestContextVisitor({ visitorId });

        await next();
    };
}
