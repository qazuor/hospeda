/**
 * Baseline security response headers applied to EVERY response the web
 * app's middleware pipeline returns, regardless of which exit path produced
 * it (SSR HTML page, a static-asset early return, a redirect, a 404/410
 * rewrite).
 *
 * H-170 (August 2026 smoke): `hospeda.com.ar` (this app) and
 * `admin.hospeda.com.ar` were the only two production surfaces missing
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
 *
 * HOS-2572 adds `Cross-Origin-Opener-Policy` (flagged by PageSpeed "Best
 * practices": no origin isolation against XSS-opened windows). The value is
 * `same-origin`, chosen after auditing every cross-window flow in the web app:
 * there is NO `window.open` and no `window.opener` / `postMessage` use anywhere
 * in `apps/web/src` or `@repo/auth-ui`; social sign-in (`signIn.social`) and the
 * MercadoPago checkout are full-page redirects, not popups; the video embeds
 * are `<iframe>`s, which COOP does not affect (it governs top-level browsing
 * contexts only); share uses `navigator.share`. With no popup that needs its
 * opener, the stricter `same-origin` is safe. If a popup-based flow is ever
 * added (an OAuth popup, a payment SDK modal in a window), relax this to
 * `same-origin-allow-popups` instead of removing it.
 *
 * Exception: the `/{lang}/auth/*` pages get NO COOP. This app is the MCP OAuth
 * authorization server (`/{lang}/auth/consent`, reached through `signin`), and
 * an MCP client on another origin may open that flow in a popup and watch it
 * through `window.opener` / `popup.closed`. `same-origin` on the popup would
 * sever that link the moment it lands here, and `same-origin-allow-popups` does
 * not help in that direction (it only governs popups THIS page opens).
 */

/** Header name → value applied to every response, mirroring apps/api's security middleware defaults. */
export const SECURITY_HEADER_VALUES = {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Opener-Policy': 'same-origin'
} as const;

/** Matches the localized auth pages (`/es/auth/signin`, `/en/auth/consent`, …). */
const AUTH_PAGE_PATTERN = /^\/[a-z]{2}\/auth(\/|$)/;

/**
 * Whether a request path must be served without `Cross-Origin-Opener-Policy`.
 *
 * @param params.pathname - The request URL's pathname.
 * @returns `true` for the localized auth pages (cross-origin OAuth popups).
 */
export function isCoopExemptPath({ pathname }: { readonly pathname: string }): boolean {
    return AUTH_PAGE_PATTERN.test(pathname);
}

/**
 * Sets the baseline security headers on a `Response`'s `Headers` object, in
 * place. Safe to call on any `Response.headers` before it is returned to the
 * caller — the Fetch API keeps a freshly constructed `Response`'s headers
 * mutable until the response is actually sent.
 *
 * @param params - Object carrying the `Headers` instance to mutate.
 * @param params.headers - The response's `Headers` object.
 * @param params.pathname - The request path; auth pages skip COOP (see module doc).
 */
export function applySecurityHeaders({
    headers,
    pathname
}: {
    readonly headers: Headers;
    readonly pathname: string;
}): void {
    const skipCoop = isCoopExemptPath({ pathname });
    for (const [name, value] of Object.entries(SECURITY_HEADER_VALUES)) {
        if (skipCoop && name === 'Cross-Origin-Opener-Policy') {
            headers.delete(name);
            continue;
        }
        headers.set(name, value);
    }
}
