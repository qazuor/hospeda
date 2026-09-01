/**
 * @file auth-tabs-config.ts
 * @description Shared post-auth redirect-target computation for BOTH
 * `signin.astro` and `signup.astro` (HOS-959).
 *
 * Both pages render the same `AuthTabs` island and the tab switch inside it
 * is CLIENT-SIDE only (`history.replaceState`, no navigation) — so whichever
 * URL the visitor actually landed on, the island must be able to fully
 * drive EITHER tab, including its own OAuth submission. That means every
 * `.astro` entry point needs to compute both a sign-in AND a sign-up
 * redirect config, not just the one matching its own route. This helper is
 * the single source of that computation so the two pages don't hand-copy it
 * (and drift, the way the whole HOS-959 rewrite exists to prevent).
 *
 * `returnUrl`/`redirect` (a same-app relative path) and `callbackUrl` (a
 * server-validated ABSOLUTE cross-app URL, SPEC-182 — e.g. the admin panel)
 * both feed into the SAME post-OAuth destination, because OAuth
 * authenticates the browser immediately regardless of which tab was active.
 * The one path that does NOT honor either param is password-registration —
 * it always lands on `/auth/verify-email-sent/`, since the API issues no
 * session until the verification email is opened (HOS-838 tracks that as a
 * known, separate gap; do not "fix" it here).
 */

import type { AuthTabsSignInConfig, AuthTabsSignUpConfig } from '@/components/auth/AuthTabs.client';
import { validateCallbackUrl } from '@/lib/auth-callback';
import { resolveSafeReturnPath } from '@/lib/auth-redirect';
import type { SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';

/** Arguments for {@link resolveAuthTabsRedirectConfig}. */
export interface ResolveAuthTabsRedirectConfigArgs {
    /** The request URL (`Astro.url`) — read for `returnUrl`/`redirect`/`callbackUrl`. */
    readonly astroUrl: URL;
    /** Active locale, for building the `/auth/verify-email-sent/` URL and the returnPath fallback. */
    readonly locale: SupportedLocale;
    /** The web site origin, passed to `validateCallbackUrl`'s allowlist. */
    readonly siteUrl: string;
    /** The admin app origin, or `undefined` when not configured. */
    readonly adminUrl: string | undefined;
    /** Whether the app is running in production (gates dev-only hosts in the allowlist). */
    readonly isProduction: boolean;
}

/** Result of {@link resolveAuthTabsRedirectConfig}. */
export interface AuthTabsRedirectConfigResult {
    /** Safe same-app relative path (already through the open-redirect guard). */
    readonly returnPath: string;
    /** The validated cross-app `callbackUrl`, or `null` if absent/rejected. */
    readonly validatedCallbackUrl: string | null;
    /** Config for the `AuthTabs` island's sign-in tab. */
    readonly signInConfig: AuthTabsSignInConfig;
    /** Config for the `AuthTabs` island's sign-up tab. */
    readonly signUpConfig: AuthTabsSignUpConfig;
}

/**
 * Resolves the full redirect configuration `AuthTabs` needs for both tabs
 * from one request URL.
 *
 * @param params - {@link ResolveAuthTabsRedirectConfigArgs}
 * @returns {@link AuthTabsRedirectConfigResult}
 */
export function resolveAuthTabsRedirectConfig({
    astroUrl,
    locale,
    siteUrl,
    adminUrl,
    isProduction
}: ResolveAuthTabsRedirectConfigArgs): AuthTabsRedirectConfigResult {
    // `returnUrl` (canonical) / `redirect` (legacy alias) — a same-app
    // RELATIVE path. `returnUrl` wins when both are present.
    const rawReturn =
        astroUrl.searchParams.get('returnUrl') ?? astroUrl.searchParams.get('redirect') ?? '';
    const returnPath = resolveSafeReturnPath({ rawReturn, locale });

    // SPEC-182: `callbackUrl` — an ABSOLUTE cross-origin URL (e.g. the admin
    // panel), validated against a strict server-side allowlist before being
    // honored. Takes precedence over `returnPath` as the authenticated
    // destination.
    const rawCallbackUrl = astroUrl.searchParams.get('callbackUrl') ?? '';
    const validatedCallbackUrl = rawCallbackUrl
        ? validateCallbackUrl({ url: rawCallbackUrl, siteUrl, adminUrl, isProduction })
        : null;

    const origin = astroUrl.origin;

    // The destination for anyone who ends up authenticated in THIS
    // browser session — via sign-in credentials, or via OAuth from either
    // tab. A valid callbackUrl is already absolute+allowlisted and is used
    // verbatim; otherwise the relative returnPath is anchored on the
    // request origin.
    const authenticatedTargetHref = validatedCallbackUrl ?? new URL(returnPath, origin).href;

    const signInConfig: AuthTabsSignInConfig = {
        redirectTo: authenticatedTargetHref,
        externalRedirect: Boolean(validatedCallbackUrl)
    };

    const signUpConfig: AuthTabsSignUpConfig = {
        // Password registration never has a session at submit time, so it
        // always goes to the "check your inbox" page — returnUrl/callbackUrl
        // are lost on this one path only (HOS-838).
        redirectTo: new URL(buildUrl({ locale, path: 'auth/verify-email-sent' }), origin).href,
        // OAuth registration DOES authenticate immediately, so — as of
        // HOS-959 — it shares the exact same destination as sign-in,
        // callbackUrl included.
        oauthRedirectTo: authenticatedTargetHref,
        oauthExternalRedirect: Boolean(validatedCallbackUrl)
    };

    return { returnPath, validatedCallbackUrl, signInConfig, signUpConfig };
}
