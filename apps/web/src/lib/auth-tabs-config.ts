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
 * Password-registration is the one path whose BROWSER destination is fixed at
 * `/auth/verify-email-sent/`: there is no session at submit time, since the API
 * requires email verification first. The caller's destination is not lost,
 * though — HOS-838 carries it in `verificationCallbackUrl`, which the API
 * stamps into the verification link. Because `autoSignInAfterVerification` is
 * enabled, following that link creates the session, so the callback can point
 * at a protected page directly.
 *
 * Every absolute URL this helper returns is built on the CONFIGURED site
 * origin (`siteUrl`), never on the request's own origin — see
 * {@link resolveSiteOrigin} for why that distinction is load-bearing rather
 * than cosmetic (HOS-1207).
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

/**
 * Resolves the origin every absolute URL in this module is anchored on.
 *
 * Returns the origin of the configured `siteUrl`.
 *
 * The `astroUrl.origin` branch is UNREACHABLE from the two real call sites and
 * is not a fallback anyone should count on. Both pages pass `getSiteUrl()`,
 * which resolves through `validateWebEnv()` — a `z.url()` `safeParse` that
 * THROWS on a malformed value, so a bad `siteUrl` has already failed the page
 * before this function runs. It is kept only because this function is pure and
 * its `siteUrl` is an ordinary argument a future caller could get wrong;
 * returning something beats throwing from a helper that promises an origin.
 *
 * If a build ever does reach it, that is not a graceful degradation: it is
 * precisely the value HOS-1207 is about, and the sign-up 403 is back.
 *
 * @param params.siteUrl - The configured site base URL.
 * @param params.astroUrl - The request URL, used only as a last resort.
 * @returns An absolute origin (`scheme://host[:port]`).
 */
function resolveSiteOrigin({
    siteUrl,
    astroUrl
}: {
    readonly siteUrl: string;
    readonly astroUrl: URL;
}): string {
    try {
        return new URL(siteUrl).origin;
    } catch {
        return astroUrl.origin;
    }
}

/**
 * Decides whether an already-allowlisted `callbackUrl` may also be SENT TO THE
 * API, as opposed to merely being redirected to by this browser.
 *
 * The two questions have different answers, which is the whole reason this
 * predicate exists next to {@link validateCallbackUrl} instead of inside it
 * (HOS-1207):
 *
 * - **Redirecting the browser** to any Hospeda-owned subdomain is safe, and
 *   `validateCallbackUrl` accepts every one of them on purpose — its rule 2 is
 *   explicitly not gated by environment.
 * - **Handing a URL to Better Auth** is not a redirect but an origin check
 *   against `trustedOrigins`, which the API builds from `HOSPEDA_SITE_URL` +
 *   `HOSPEDA_ADMIN_URL` + `HOSPEDA_EXTRA_TRUSTED_ORIGINS`
 *   (`parseTrustedOriginsFromConfig`). A Hospeda subdomain that is not one of
 *   those is rejected — and Better Auth rejects the ENTIRE sign-up request
 *   with a 403, so the account is never created. Same failure as the scheme
 *   mismatch this file's other fix is about, reached from a crafted link.
 *
 * So the answer is narrowed to the two origins the web app can name with
 * certainty, because they are the same configured values the API reads.
 * `HOSPEDA_EXTRA_TRUSTED_ORIGINS` is deliberately NOT modelled here: the web
 * app never sees it, and being narrower than the API only costs a caller its
 * requested destination (it falls back to `returnPath`) — the person still
 * registers. Being wider would cost them the account.
 *
 * @param params.candidate - A URL that already passed `validateCallbackUrl`.
 * @param params.siteOrigin - The configured site origin.
 * @param params.adminUrl - The configured admin base URL, if any.
 * @returns True when the API's Better Auth will accept this origin.
 */
function isApiTrustedCallbackUrl({
    candidate,
    siteOrigin,
    adminUrl
}: {
    readonly candidate: string;
    readonly siteOrigin: string;
    readonly adminUrl: string | undefined;
}): boolean {
    let candidateOrigin: string;
    try {
        candidateOrigin = new URL(candidate).origin;
    } catch {
        return false;
    }

    if (candidateOrigin === siteOrigin) {
        return true;
    }

    if (!adminUrl) {
        return false;
    }

    try {
        return candidateOrigin === new URL(adminUrl).origin;
    } catch {
        return false;
    }
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

    // Every absolute URL built here is anchored on the CONFIGURED site
    // origin, never on `astroUrl.origin` (HOS-1207).
    //
    // TLS terminates at Cloudflare, so the request Astro actually receives
    // through the internal proxy is plain HTTP, and Astro does not honour
    // `x-forwarded-proto` — `astroUrl.origin` resolves to
    // `http://staging.hospeda.com.ar` on the VPS. That was harmless while
    // these values only drove browser redirects, which resolve either way.
    // It stopped being harmless when HOS-838 started sending one of them to
    // the API: Better Auth checks `callbackURL` against `trustedOrigins`
    // (derived from `HOSPEDA_SITE_URL`, an `https://` origin), and a scheme
    // mismatch rejects the WHOLE sign-up request with a 403 — no account is
    // created. `siteUrl` is that same configured value, so anchoring on it
    // is what makes the check pass by construction rather than by
    // environment coincidence.
    const siteOrigin = resolveSiteOrigin({ siteUrl, astroUrl });

    // The destination for anyone who ends up authenticated in THIS
    // browser session — via sign-in credentials, or via OAuth from either
    // tab. A valid callbackUrl is already absolute+allowlisted and is used
    // verbatim; otherwise the relative returnPath is anchored on the
    // site origin.
    const authenticatedTargetHref = validatedCallbackUrl ?? new URL(returnPath, siteOrigin).href;

    // The one value in this result that leaves the browser and is CHECKED by
    // another service, so it answers a stricter question than the redirects
    // above — see `isApiTrustedCallbackUrl` (HOS-1207). A callbackUrl this app
    // would happily redirect to but Better Auth would refuse degrades to the
    // same-site returnPath: the person loses the destination they asked for,
    // instead of losing the account.
    const verificationCallbackUrl =
        validatedCallbackUrl &&
        isApiTrustedCallbackUrl({ candidate: validatedCallbackUrl, siteOrigin, adminUrl })
            ? validatedCallbackUrl
            : new URL(returnPath, siteOrigin).href;

    const signInConfig: AuthTabsSignInConfig = {
        redirectTo: authenticatedTargetHref,
        externalRedirect: Boolean(validatedCallbackUrl)
    };

    const signUpConfig: AuthTabsSignUpConfig = {
        // Password registration has no session at submit time, so the browser
        // still goes to the "check your inbox" page. The destination is not
        // lost any more, though: it travels in the verification email as
        // `verificationCallbackUrl` (HOS-838).
        redirectTo: new URL(buildUrl({ locale, path: 'auth/verify-email-sent' }), siteOrigin).href,
        // Where the verification link should land the user. Absolute on
        // purpose: Better Auth resolves a relative callback against the API
        // origin, which serves no pages. The API forwards this verbatim after
        // Better Auth has validated it against `trustedOrigins` — which is
        // why it is the one value narrowed to an origin that check accepts,
        // rather than `authenticatedTargetHref` (HOS-1207).
        verificationCallbackUrl,
        // OAuth registration DOES authenticate immediately, so — as of
        // HOS-959 — it shares the exact same destination as sign-in,
        // callbackUrl included.
        oauthRedirectTo: authenticatedTargetHref,
        oauthExternalRedirect: Boolean(validatedCallbackUrl)
    };

    return { returnPath, validatedCallbackUrl, signInConfig, signUpConfig };
}
