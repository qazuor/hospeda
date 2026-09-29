/**
 * @file auth-session-cookie.ts
 * @description Single source of truth for the Better Auth session-cookie NAME
 * of each deployment (HOS-955).
 *
 * Staging and production both scope their session cookie to the apex
 * `hospeda.com.ar` (see `apps/api/src/lib/auth-cookie-domain.ts`), because
 * each environment's web, admin and api hosts share no narrower parent
 * domain (`staging.` and `staging-admin.` are siblings). With the same name
 * AND the same domain, the two environments wrote to ONE cookie slot in the
 * browser: signing in on staging overwrote the production session and
 * vice versa.
 *
 * The fix is to give staging its own cookie name. Both cookies still reach
 * every `*.hospeda.com.ar` host, but each API only reads the name its own
 * deployment writes, so neither environment can see nor clobber the other.
 *
 * The web app's cheap presence check (`requestHasSessionCookie`) must agree
 * with the API on the name, which is why both resolve it from here.
 *
 * Production and local runs keep Better Auth's default prefix, so shipping
 * this does not sign out any production user.
 */

/** Better Auth's default cookie prefix. Kept for production and local runs. */
export const DEFAULT_AUTH_COOKIE_PREFIX = 'better-auth';

/** Cookie prefix used by the staging deployment (`HOSPEDA_DEPLOY_ENV=preview`). */
export const STAGING_AUTH_COOKIE_PREFIX = 'hospeda-staging';

/**
 * Input for {@link resolveAuthCookiePrefix}. RO-RO.
 */
export interface ResolveAuthCookiePrefixInput {
    /** Raw `HOSPEDA_DEPLOY_ENV` value (`dev | test | preview | prod`, or unset). */
    readonly deployEnv: string | undefined;
}

/**
 * Resolve the Better Auth `advanced.cookiePrefix` for this deployment.
 *
 * Only the staging deployment (`preview`) diverges. Every other value, and an
 * unset variable, keeps the default prefix: a misconfigured production can at
 * worst fall back to the name it has always used, never to staging's.
 *
 * @param input - {@link ResolveAuthCookiePrefixInput}
 * @returns The cookie prefix for this deployment.
 *
 * @example
 * ```ts
 * resolveAuthCookiePrefix({ deployEnv: 'preview' }); // 'hospeda-staging'
 * resolveAuthCookiePrefix({ deployEnv: 'prod' });    // 'better-auth'
 * ```
 */
export function resolveAuthCookiePrefix({ deployEnv }: ResolveAuthCookiePrefixInput): string {
    return deployEnv?.trim() === 'preview'
        ? STAGING_AUTH_COOKIE_PREFIX
        : DEFAULT_AUTH_COOKIE_PREFIX;
}

/**
 * Input for {@link getAuthSessionCookieNames}. RO-RO.
 */
export interface GetAuthSessionCookieNamesInput {
    /** Raw `HOSPEDA_DEPLOY_ENV` value (`dev | test | preview | prod`, or unset). */
    readonly deployEnv: string | undefined;
}

/**
 * The session-token cookie names this deployment writes.
 *
 * Better Auth names the cookie `<prefix>.session_token`, and adds the
 * `__Secure-` prefix when `useSecureCookies` is on (every deployment running
 * `NODE_ENV=production`). Both forms are returned so callers work in dev too.
 *
 * @param input - {@link GetAuthSessionCookieNamesInput}
 * @returns The plain and `__Secure-` session-token cookie names.
 *
 * @example
 * ```ts
 * getAuthSessionCookieNames({ deployEnv: 'preview' });
 * // ['hospeda-staging.session_token', '__Secure-hospeda-staging.session_token']
 * ```
 */
export function getAuthSessionCookieNames({
    deployEnv
}: GetAuthSessionCookieNamesInput): readonly [string, string] {
    const prefix = resolveAuthCookiePrefix({ deployEnv });
    return [`${prefix}.session_token`, `__Secure-${prefix}.session_token`] as const;
}
