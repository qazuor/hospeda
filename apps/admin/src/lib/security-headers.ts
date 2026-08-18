/**
 * Baseline security response headers applied to EVERY response the admin
 * app's request middleware produces — SSR page loads and server function
 * calls alike (`cspMiddleware`'s `next({ context })` covers both, see
 * `../middleware.ts`).
 *
 * H-170 (August 2026 smoke): `admin.hospeda.com.ar` (this app) and
 * `hospeda.com.ar` (apps/web) were the only two production surfaces missing
 * `strict-transport-security`, `x-content-type-options` and
 * `referrer-policy`. `apps/api` already emits all three via
 * `apps/api/src/middlewares/security.ts`, and Cloudflare passes
 * origin-emitted headers through unmodified — confirmed empirically against
 * `api.hospeda.com.ar` before this fix.
 *
 * The values below are hardcoded to match `apps/api`'s
 * `getSecurityConfig()` DEFAULTS (see
 * `apps/api/src/utils/env-config-helpers.ts`) rather than reading an env
 * var: this app has no `API_SECURITY_*`-equivalent registry entry, and
 * introducing one for three fixed, well-known security-baseline values
 * (never expected to vary per environment) would be over-engineering. If a
 * future change overrides the API's values away from these defaults via its
 * env vars, this file will NOT follow — that drift is an accepted tradeoff
 * of keeping this fix env-var-free.
 */

/** Header name → value applied to every response, mirroring apps/api's security middleware defaults. */
export const SECURITY_HEADER_VALUES = {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
} as const;

/**
 * Sets the baseline security headers on a `Response`'s `Headers` object, in
 * place. Safe to call on any `Response.headers` before it is returned to the
 * caller — the Fetch API keeps a freshly constructed `Response`'s headers
 * mutable until the response is actually sent (verified against TanStack
 * Start's own `result.response.headers.set(...)` usage for the CSP header in
 * `../middleware.ts`, which relies on the same guarantee).
 *
 * @param params - Object carrying the `Headers` instance to mutate.
 * @param params.headers - The response's `Headers` object.
 */
export function applySecurityHeaders({ headers }: { readonly headers: Headers }): void {
    for (const [name, value] of Object.entries(SECURITY_HEADER_VALUES)) {
        headers.set(name, value);
    }
}
