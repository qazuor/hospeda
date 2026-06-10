/**
 * @file auth-cookie-domain.ts
 * @description Resolves the Better Auth cross-subdomain cookie domain (SPEC-182 T-018).
 *
 * Production is PINNED to the real apex (`hospeda.com.ar`) and deliberately
 * ignores the dev override: letting an env var rewrite the production cookie
 * domain would be a session-breaking footgun if it ever leaked into a prod
 * deployment. Staging (`staging.hospeda.com.ar`) is a subdomain of the apex,
 * so the same pinned value covers it.
 *
 * In non-production, `HOSPEDA_DEV_COOKIE_DOMAIN` (e.g. `.hospeda.local`)
 * enables the dev-local cross-subdomain recipe documented in
 * `docs/guides/auth-local-dev.md`: with `/etc/hosts` mapping
 * `web/admin/api.hospeda.local` to 127.0.0.1, a session minted on
 * `web.hospeda.local` is also sent to `admin.hospeda.local`, mirroring the
 * production web→admin hand-off. When unset, cookies stay per-host
 * (`localhost:4321` vs `localhost:3000`), the pre-SPEC-182 behavior.
 */

/**
 * Arguments for {@link resolveCookieDomain}. RO-RO.
 */
export interface ResolveCookieDomainArgs {
    /** The runtime NODE_ENV value. */
    readonly nodeEnv: string | undefined;
    /** Raw HOSPEDA_DEV_COOKIE_DOMAIN value (may be unset/blank). */
    readonly devCookieDomain: string | undefined;
}

/** Production apex domain shared by web, admin, and api subdomains. */
const PROD_COOKIE_DOMAIN = 'hospeda.com.ar';

/**
 * Resolve the `crossSubDomainCookies.domain` for Better Auth.
 *
 * @param args - {@link ResolveCookieDomainArgs}
 * @returns `hospeda.com.ar` in production; the trimmed dev domain in
 *   non-production when configured; otherwise `undefined` (per-host cookies)
 */
export function resolveCookieDomain({
    nodeEnv,
    devCookieDomain
}: ResolveCookieDomainArgs): string | undefined {
    if (nodeEnv === 'production') {
        return PROD_COOKIE_DOMAIN;
    }
    const trimmed = devCookieDomain?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
}
