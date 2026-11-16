/**
 * @file oauth-consent.ts
 * @description Pure helpers for the OAuth consent page (HOS-2184 T-027).
 *
 * The API (Better Auth `oauthProvider`) sends the browser to the consent page
 * with the original authorization request plus a signature in the query
 * string (`client_id`, `scope`, `redirect_uri`, `state`, `exp`, `sig`,
 * `ba_param`, ...). The consent island has to give the signed part back to the
 * API when the user decides. These helpers parse that query, rebuild the part
 * the API verifies, and keep untrusted values (client metadata, redirect URLs)
 * from reaching the DOM or the address bar unchecked.
 *
 * Browser-safe: no `process.env`, no server-only imports.
 *
 * @module oauth-consent
 */

import type { SupportedLocale } from './i18n';
import { buildUrl } from './urls';

/** Path segment of the consent page under `/{locale}/`. */
export const OAUTH_CONSENT_PATH = 'auth/consent';

/** Path segment of the sign-in page under `/{locale}/`. */
const SIGNIN_PATH = 'auth/signin';

/** Parameter listing which query parameters the signature covers. */
const SIGNED_PARAMETER_NAMES_KEY = 'ba_param';

/**
 * Scopes the consent screen has a dedicated sentence for. Anything else is
 * listed with the generic "additional permission" copy.
 */
export const KNOWN_OAUTH_SCOPES = ['openid', 'profile', 'email', 'offline_access'] as const;

/** One of {@link KNOWN_OAUTH_SCOPES}. */
export type KnownOAuthScope = (typeof KNOWN_OAUTH_SCOPES)[number];

/**
 * Narrows a scope string to a scope the consent screen has copy for.
 *
 * @param params.scope - A scope string from the authorization request
 * @returns The scope as a {@link KnownOAuthScope}, or `null` for any other value
 */
export function toKnownOAuthScope({ scope }: { readonly scope: string }): KnownOAuthScope | null {
    return (KNOWN_OAUTH_SCOPES as readonly string[]).includes(scope)
        ? (scope as KnownOAuthScope)
        : null;
}

/**
 * Rebuilds the `oauth_query` value the API verifies.
 *
 * Mirrors what Better Auth's own `oauthProviderClient` plugin sends: the
 * signature, the list of signed parameter names and exactly those parameters.
 * Any other query parameter (analytics, `returnUrl`, ...) is left out because
 * it is not covered by the signature and would make verification fail.
 *
 * @param params.search - `window.location.search` (with or without the `?`)
 * @returns The signed query string, or `null` when the request is not signed
 */
export function buildSignedOAuthQuery({ search }: { readonly search: string }): string | null {
    const params = new URLSearchParams(search);
    if (!params.has('sig')) {
        return null;
    }
    const signedNames = new Set(params.getAll(SIGNED_PARAMETER_NAMES_KEY));
    if (signedNames.size === 0) {
        return null;
    }

    const signed = new URLSearchParams();
    for (const [key, value] of params.entries()) {
        if (key === 'sig' || key === SIGNED_PARAMETER_NAMES_KEY || signedNames.has(key)) {
            signed.append(key, value);
        }
    }
    return signed.toString();
}

/** A consent request recovered from the page query string. */
export interface ConsentRequest {
    /** The OAuth client asking for access (`client_id`). */
    readonly clientId: string;
    /** Requested scopes, de-duplicated, in request order. */
    readonly scopes: readonly string[];
    /** Signed query to send back with the decision. */
    readonly oauthQuery: string;
}

/**
 * Parses the consent page query string.
 *
 * Does not verify the signature (that is the API's job); it only checks that
 * the request has the shape the API will accept, so the page can fail early
 * with a clear message instead of a generic API error.
 *
 * @param params.search - `window.location.search`
 * @returns The request, or `null` when `client_id` or the signed part is missing
 */
export function parseConsentRequest({
    search
}: {
    readonly search: string;
}): ConsentRequest | null {
    const params = new URLSearchParams(search);
    const clientId = params.get('client_id');
    const oauthQuery = buildSignedOAuthQuery({ search });
    if (!clientId || !oauthQuery) {
        return null;
    }

    const scopes = [...new Set((params.get('scope') ?? '').split(/\s+/).filter(Boolean))];
    return { clientId, scopes, oauthQuery };
}

/**
 * Whether a query string looks like a signed OAuth authorization request
 * (the shape `oauthProvider` appends when it redirects to a login or consent
 * page).
 *
 * @param params.search - A query string (with or without the `?`)
 * @returns `true` when `client_id`, `sig` and `ba_param` are all present
 */
export function isSignedOAuthRequest({ search }: { readonly search: string }): boolean {
    const params = new URLSearchParams(search);
    return params.has('client_id') && params.has('sig') && params.has(SIGNED_PARAMETER_NAMES_KEY);
}

/**
 * Builds the same-app path that resumes an OAuth request on the consent page.
 * Used as the post-sign-in destination so a user the API sent to the sign-in
 * page lands on the consent screen with the signed request intact.
 *
 * @param params.locale - Locale of the consent page
 * @param params.search - Query string of the signed request
 * @returns A relative path, e.g. `/es/auth/consent/?client_id=...&sig=...`
 */
export function buildConsentResumePath({
    locale,
    search
}: {
    readonly locale: SupportedLocale;
    readonly search: string;
}): string {
    const query = search.startsWith('?') ? search.slice(1) : search;
    return `${buildUrl({ locale, path: OAUTH_CONSENT_PATH })}?${query}`;
}

/**
 * Builds the sign-in URL for a visitor who reached the consent page without a
 * session. After signing in they come back to the consent page with the same
 * signed request.
 *
 * @param params.locale - Locale for both pages
 * @param params.search - Query string of the signed request
 * @returns A relative sign-in URL carrying `returnUrl`
 */
export function buildConsentSigninUrl({
    locale,
    search
}: {
    readonly locale: SupportedLocale;
    readonly search: string;
}): string {
    const returnUrl = buildConsentResumePath({ locale, search });
    return `${buildUrl({ locale, path: SIGNIN_PATH })}?returnUrl=${encodeURIComponent(returnUrl)}`;
}

/**
 * Validates an untrusted URL from client metadata (website, logo) before it is
 * linked or used as an image source. Only `https:` URLs without embedded
 * credentials pass.
 *
 * @param params.raw - A value from client metadata (any type)
 * @returns The normalized URL, or `null` when it is missing or not safe
 */
export function toSafeHttpsUrl({ raw }: { readonly raw: unknown }): string | null {
    if (typeof raw !== 'string' || raw.length === 0) {
        return null;
    }
    try {
        const url = new URL(raw);
        if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') {
            return null;
        }
        return url.href;
    } catch {
        return null;
    }
}

/**
 * Whether the browser may be sent to a redirect URL returned by the API after
 * the decision. The API only returns URIs it already validated against the
 * client's registration and the MCP allowlist (`https:` hosted clients and
 * `http:` loopback for CLI clients); this is a second, scheme-level check so a
 * `javascript:` or `data:` URL can never be navigated to.
 *
 * @param params.raw - The `url` field of the API response
 * @returns `true` for absolute or relative `http(s)` URLs
 */
export function isFollowableRedirectUrl({ raw }: { readonly raw: unknown }): boolean {
    if (typeof raw !== 'string' || raw.length === 0) {
        return false;
    }
    try {
        const url = new URL(raw, 'https://placeholder.invalid');
        return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
        return false;
    }
}
