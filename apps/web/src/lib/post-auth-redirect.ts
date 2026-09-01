/**
 * @file post-auth-redirect.ts
 * @description Shared post-auth redirect-target resolution used by the
 * `SignIn` and `SignUp` client islands after a successful credential or
 * OAuth authentication (HOS-959 step 1 — this file de-duplicates four
 * near-identical inline copies of the same logic).
 *
 * ## Why the host-strip+reattach dance exists
 *
 * The server-built `redirectTo` (and, for OAuth, `oauthRedirectTo`) can carry
 * `https://localhost` when Astro Node runs behind a reverse proxy that does
 * not forward the original Host header. A browser cannot navigate to that
 * URL. This was observed in production on 2026-05-14 during the SPEC-103
 * T-012 smoke: `POST /sign-up` returned 200 but the subsequent navigation
 * went to `https://localhost/es/auth/verify-email-sent` and failed.
 *
 * The fix is NOT `new URL(target, currentOrigin)` — that would silently
 * accept the bad host on an absolute `target` instead of discarding it.
 * Instead: strip the host (if the target is absolute) down to
 * `path + search + hash`, then reattach the browser's real
 * `window.location.origin`. Do not "simplify" this away or the bug comes
 * back.
 */

/** Arguments for {@link resolvePostAuthRedirectUrl}. */
export interface ResolvePostAuthRedirectUrlArgs {
    /**
     * The already-selected candidate redirect target (e.g. `redirectTo || '/'`,
     * or an OAuth precedence chain like
     * `oauthRedirectTo ?? redirectTo ?? window.location.pathname ?? '/'`).
     * Callers resolve their own candidate chain BEFORE calling this function —
     * the chains differ subtly between call sites (`||` vs `??`, different
     * fallbacks) and are intentionally kept at the call site so this shared
     * helper does not change that per-site behavior.
     */
    readonly target: string;
    /** `window.location.origin` at call time. */
    readonly currentOrigin: string;
    /**
     * Marks `target` as a server-validated EXTERNAL URL (SPEC-182): a
     * cross-app URL (e.g. the admin panel) that already passed the
     * server-side allowlist. When true, `target` is returned verbatim — the
     * host-strip+reattach below would otherwise rewrite the external origin
     * onto `currentOrigin` and break the cross-app hand-off. Defaults to
     * false (same-app redirects). Only `SignIn` exposes this; `SignUp` never
     * passes it.
     */
    readonly externalRedirect?: boolean;
}

/**
 * Resolves a post-auth `target` into an absolute, browser-navigable URL
 * anchored on the current origin — unless `externalRedirect` is set, in
 * which case `target` is trusted and returned as-is.
 *
 * See the file-level doc for why the host-strip+reattach step exists. A
 * malformed absolute `target` (one that fails `new URL()`) falls back to the
 * site root (`/`) rather than throwing, since this runs on the client after
 * a successful auth call and a thrown error would leave the user stranded on
 * a form that already submitted.
 *
 * @param params - {@link ResolvePostAuthRedirectUrlArgs}
 * @returns Absolute URL (`${currentOrigin}${path}`) for a same-app redirect,
 *   or `target` verbatim when `externalRedirect` is true.
 *
 * @example
 * ```ts
 * resolvePostAuthRedirectUrl({ target: '/es/mi-cuenta/', currentOrigin: 'https://hospeda.com.ar' });
 * // => 'https://hospeda.com.ar/es/mi-cuenta/'
 *
 * // Reverse-proxy bug case: the bad host is discarded, not trusted.
 * resolvePostAuthRedirectUrl({ target: 'https://localhost/es/mi-cuenta/', currentOrigin: 'https://staging.hospeda.com.ar' });
 * // => 'https://staging.hospeda.com.ar/es/mi-cuenta/'
 *
 * // SPEC-182 external (admin) redirect: used verbatim.
 * resolvePostAuthRedirectUrl({
 *   target: 'https://admin.hospeda.com.ar/dashboard',
 *   currentOrigin: 'https://hospeda.com.ar',
 *   externalRedirect: true
 * });
 * // => 'https://admin.hospeda.com.ar/dashboard'
 * ```
 */
export function resolvePostAuthRedirectUrl({
    target,
    currentOrigin,
    externalRedirect = false
}: ResolvePostAuthRedirectUrlArgs): string {
    if (externalRedirect) {
        return target;
    }

    let path = target || '/';
    if (path.startsWith('http')) {
        try {
            const parsed = new URL(path);
            path = `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
        } catch {
            path = '/';
        }
    }
    if (!path.startsWith('/')) {
        path = `/${path}`;
    }
    return `${currentOrigin}${path}`;
}

/** Arguments for {@link buildOAuthErrorCallbackUrl}. */
export interface BuildOAuthErrorCallbackUrlArgs {
    /** `window.location.origin` at call time. */
    readonly currentOrigin: string;
    /**
     * `window.location.pathname` at call time. May be an empty string in
     * some test/edge environments — falls back to `/` in that case.
     */
    readonly currentPathname: string;
}

/**
 * Builds the `errorCallbackURL` passed to `signIn.social()` — the page
 * Better Auth sends the browser back to when the OAuth round-trip fails.
 * Always the current page, so a failed OAuth attempt returns the user to the
 * sign-in/sign-up form they started from (with the `?error=...` query string
 * `signin.astro`/`signup.astro` read back into `initialOAuthError`).
 *
 * @param params - {@link BuildOAuthErrorCallbackUrlArgs}
 * @returns Absolute URL `${currentOrigin}${currentPathname || '/'}`.
 *
 * @example
 * ```ts
 * buildOAuthErrorCallbackUrl({ currentOrigin: 'https://hospeda.com.ar', currentPathname: '/es/auth/signin/' });
 * // => 'https://hospeda.com.ar/es/auth/signin/'
 * ```
 */
export function buildOAuthErrorCallbackUrl({
    currentOrigin,
    currentPathname
}: BuildOAuthErrorCallbackUrlArgs): string {
    return `${currentOrigin}${currentPathname || '/'}`;
}
