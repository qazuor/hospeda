/**
 * Server-side session validation for Better Auth.
 *
 * Provides a TanStack Start server function that validates the current
 * user session by forwarding cookies to the Better Auth API endpoint.
 * Used by route beforeLoad guards to protect authenticated routes.
 *
 * @module auth-session
 */

import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';

/**
 * Auth state returned by the session validation
 */
export interface AuthState {
    readonly userId: string | null;
    readonly isAuthenticated: boolean;
    /**
     * Every role the authenticated user holds (HOS-296). Sourced from
     * `/api/v1/public/auth/me`'s `data.actor.roles` — NOT from Better Auth's
     * `get-session`, which no longer carries any role at all (the
     * `additionalFields` column mapping is gone with the dropped `users.role`
     * column). Empty on an unauthenticated session or a failed/unparseable
     * `/auth/me` response — the lowest-privilege default.
     */
    readonly roles: readonly string[];
    readonly permissions: readonly string[];
    readonly passwordChangeRequired: boolean;
    readonly displayName: string | null;
    readonly email: string | null;
    readonly avatar: string | null;
    readonly emailVerified: boolean;
    /**
     * The account's saved web-locale preference (`user.settings.languageWeb`),
     * read off the Better Auth session's `settings` additionalField (HOS-609).
     * `null` for a guest, an account with no stored preference, or an
     * unparseable `settings` value — callers treat `null` as "no signal" and
     * fall through to the next precedence step.
     */
    readonly languageWeb: string | null;
}

/**
 * Server function to validate the current session via Better Auth API.
 *
 * Forwards the request cookies to the Better Auth get-session endpoint.
 * Returns the authentication state including the user ID.
 *
 * @returns Auth state with userId and isAuthenticated flag
 */
/**
 * Default unauthenticated state
 */
const UNAUTHENTICATED_STATE: AuthState = {
    userId: null,
    isAuthenticated: false,
    roles: [],
    permissions: [],
    passwordChangeRequired: false,
    displayName: null,
    email: null,
    avatar: null,
    emailVerified: false,
    languageWeb: null
} as const;

/**
 * Extracts `languageWeb` out of the Better Auth session's `settings`
 * additionalField (HOS-609). The field is mapped as a plain column on the
 * `users` table, but nothing here assumes a fixed wire shape: it may arrive
 * already parsed (a plain object, over an in-process call) or as a JSON
 * string (a stringified column value serialized across the HTTP hop this
 * function makes to `/api/auth/get-session`). Either is handled; anything
 * else — absent, malformed JSON, non-string `languageWeb` — resolves to
 * `null`, treated by every caller as "no account preference".
 *
 * @param rawSettings - The session user's raw `settings` value, of unknown shape.
 * @returns The saved web-locale preference, or `null`.
 */
function extractLanguageWeb(rawSettings: unknown): string | null {
    let settings: unknown = rawSettings;

    if (typeof settings === 'string') {
        try {
            settings = JSON.parse(settings);
        } catch {
            return null;
        }
    }

    if (!settings || typeof settings !== 'object') {
        return null;
    }

    const languageWeb = (settings as Record<string, unknown>).languageWeb;
    return typeof languageWeb === 'string' ? languageWeb : null;
}

/**
 * Resolve the admin auth state by talking to the API, given an already-known
 * API base URL and the forwarded request cookie.
 *
 * Extracted from {@link fetchAuthSession} so the network/parse logic can be
 * unit-tested without a TanStack Start request context.
 *
 * Both upstream calls (`get-session` and `/auth/me`) depend only on the cookie,
 * not on each other, so they run in parallel (BETA-71 — removes one sequential
 * round-trip per protected navigation). The `/auth/me` result is consumed ONLY
 * after the session is confirmed valid, so an unauthenticated cookie never
 * yields roles/permissions. A failing `/auth/me` is non-fatal (empty roles,
 * empty permissions).
 *
 * **HOS-1153 — why the internal-request secret belongs here.** This function
 * runs SERVER-side (it is the body of a `createServerFn`), so every admin user
 * reaches the API from the same container. The API sees the container's private
 * address on the socket and no `cf-connecting-ip`/`x-forwarded-for`, so it keys
 * the rate-limit bucket as `proxy:<admin-container-ip>` — ONE bucket for the
 * whole panel rather than one per operator. Sending the shared
 * `X-Internal-Request` secret is exactly the fix HOS-103 shipped for `apps/web`:
 * the API recognises the traffic as trusted server-to-server and exempts it.
 *
 * **The secret must only ever travel over the INTERNAL URL.** This function
 * honours whatever its caller hands it; {@link fetchAuthSession} is where that
 * gate is applied. The gate is not hygiene — a leaked secret does not merely
 * cost the admin its exemption: `isTrustedInternalRequest` runs at step (0) of
 * `rateLimitMiddleware`, before the endpoint is even classified, and calls
 * `next()` without emitting a single limit header. A leaked secret disables
 * rate limiting for the WHOLE API. `hospeda-admin-prod` holds
 * `HOSPEDA_API_URL=https://api.hospeda.com.ar` (read 2026-09-21), which is
 * fronted by Cloudflare — and Cloudflare terminates TLS, so on that hop the
 * header would be readable in edge logs, WAF rules and any capture. HOS-103
 * confined this secret to the internal network by design; the admin keeps that
 * confinement instead of quietly widening it.
 *
 * Fails safe at both ends: no internal URL means no header, and no secret means
 * no header — never an open bypass.
 *
 * @param params - RO: `{ apiUrl, cookieHeader, internalRequestSecret? }`. The
 *   secret is optional: when absent (local dev, an environment with no internal
 *   URL, or one that has not configured it) the calls go out unchanged and are
 *   rate-limited normally.
 * @returns The resolved {@link AuthState}; `UNAUTHENTICATED_STATE` on any failure.
 */
export async function resolveAuthSession({
    apiUrl,
    cookieHeader,
    internalRequestSecret
}: {
    readonly apiUrl: string;
    readonly cookieHeader: string;
    readonly internalRequestSecret?: string | undefined;
}): Promise<AuthState> {
    try {
        const headers: Record<string, string> = { cookie: cookieHeader };
        if (internalRequestSecret) {
            headers['X-Internal-Request'] = internalRequestSecret;
        }

        const [sessionResponse, meResponse] = await Promise.all([
            fetch(`${apiUrl}/api/auth/get-session`, {
                headers
            }),
            // Non-fatal: a failing /auth/me must neither reject the pair nor
            // fail auth — fall back to `null` and empty permissions.
            fetch(`${apiUrl}/api/v1/public/auth/me`, {
                headers
            }).catch(() => null)
        ]);

        if (!sessionResponse.ok) {
            return UNAUTHENTICATED_STATE;
        }

        const sessionData = (await sessionResponse.json()) as {
            user?: {
                id?: string;
                name?: string;
                email?: string;
                image?: string;
                emailVerified?: boolean;
                settings?: unknown;
            };
        };

        if (!sessionData?.user?.id) {
            return UNAUTHENTICATED_STATE;
        }

        // Read roles + permissions + password-change flag from the already
        // in-flight /auth/me response. Consumed only here, after the session
        // validated. Non-fatal on parse failure — an authenticated user with
        // no resolvable roles/permissions is still a valid (low-privilege) state.
        let roles: string[] = [];
        let permissions: string[] = [];
        let passwordChangeRequired = false;
        if (meResponse?.ok) {
            try {
                const meData = (await meResponse.json()) as {
                    success?: boolean;
                    data?: {
                        actor?: { roles?: unknown; permissions?: string[] };
                        passwordChangeRequired?: boolean;
                    };
                };

                if (meData?.success && meData?.data?.actor?.permissions) {
                    permissions = meData.data.actor.permissions;
                }
                const rawRoles = meData?.data?.actor?.roles;
                if (Array.isArray(rawRoles)) {
                    roles = rawRoles.filter((r): r is string => typeof r === 'string');
                }
                passwordChangeRequired = meData?.data?.passwordChangeRequired ?? false;
            } catch {
                // Roles/permissions parse failure is non-fatal.. panel-access check still applies
            }
        }

        return {
            userId: sessionData.user.id,
            isAuthenticated: true,
            roles,
            permissions,
            passwordChangeRequired,
            displayName: sessionData.user.name || null,
            email: sessionData.user.email || null,
            avatar: sessionData.user.image || null,
            emailVerified: sessionData.user.emailVerified ?? false,
            languageWeb: extractLanguageWeb(sessionData.user.settings)
        };
    } catch {
        return UNAUTHENTICATED_STATE;
    }
}

/**
 * Decides which base URL the two session reads go to, and whether the shared
 * `X-Internal-Request` secret may ride along (HOS-1153).
 *
 * This is the whole gate, mirroring `apps/web/src/lib/api/client.ts`: the
 * secret is attached ONLY when an internal API URL is configured, and the
 * request then goes to that internal URL. Without it, the calls go to the
 * public URL exactly as they did before HOS-1153 and carry no secret — so the
 * shared credential never crosses Cloudflare, which terminates TLS and would
 * otherwise see it in the clear (see {@link resolveAuthSession}'s docblock for
 * why a leak is an API-wide problem, not an admin-only one).
 *
 * Kept as a pure exported function so the gate itself is unit-testable without
 * a TanStack Start request context or a live `process.env`.
 *
 * @param params - RO: the raw env values, exactly as read from `process.env`.
 * @returns The base URL to call, and the secret to send (or `undefined`).
 */
export function resolveInternalRequestTarget({
    publicApiUrl,
    internalApiUrl,
    internalRequestSecret
}: {
    readonly publicApiUrl: string;
    readonly internalApiUrl?: string | undefined;
    readonly internalRequestSecret?: string | undefined;
}): { readonly apiUrl: string; readonly internalRequestSecret: string | undefined } {
    if (!internalApiUrl) {
        return { apiUrl: publicApiUrl, internalRequestSecret: undefined };
    }

    return { apiUrl: internalApiUrl, internalRequestSecret: internalRequestSecret || undefined };
}

export const fetchAuthSession = createServerFn({ method: 'GET' }).handler(
    async (): Promise<AuthState> => {
        const request = getRequest();
        if (!request) {
            return UNAUTHENTICATED_STATE;
        }

        const publicApiUrl = process.env.HOSPEDA_API_URL;
        if (!publicApiUrl) {
            throw new Error('HOSPEDA_API_URL environment variable is required');
        }
        const cookieHeader = request.headers.get('cookie') || '';

        // HOS-1153: read straight off `process.env`, like `HOSPEDA_API_URL`
        // above. This handler only ever runs on the server and neither var
        // carries a `VITE_` prefix, so no value reaches the browser bundle.
        const { apiUrl, internalRequestSecret } = resolveInternalRequestTarget({
            publicApiUrl,
            internalApiUrl: process.env.HOSPEDA_INTERNAL_API_URL,
            internalRequestSecret: process.env.HOSPEDA_INTERNAL_REQUEST_SECRET
        });

        return resolveAuthSession({ apiUrl, cookieHeader, internalRequestSecret });
    }
);
