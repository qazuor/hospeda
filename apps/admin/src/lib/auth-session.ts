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
 * @param params - RO: `{ apiUrl, cookieHeader }`.
 * @returns The resolved {@link AuthState}; `UNAUTHENTICATED_STATE` on any failure.
 */
export async function resolveAuthSession({
    apiUrl,
    cookieHeader
}: {
    readonly apiUrl: string;
    readonly cookieHeader: string;
}): Promise<AuthState> {
    try {
        const [sessionResponse, meResponse] = await Promise.all([
            fetch(`${apiUrl}/api/auth/get-session`, {
                headers: { cookie: cookieHeader }
            }),
            // Non-fatal: a failing /auth/me must neither reject the pair nor
            // fail auth — fall back to `null` and empty permissions.
            fetch(`${apiUrl}/api/v1/public/auth/me`, {
                headers: { cookie: cookieHeader }
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

export const fetchAuthSession = createServerFn({ method: 'GET' }).handler(
    async (): Promise<AuthState> => {
        const request = getRequest();
        if (!request) {
            return UNAUTHENTICATED_STATE;
        }

        const apiUrl = process.env.HOSPEDA_API_URL;
        if (!apiUrl) {
            throw new Error('HOSPEDA_API_URL environment variable is required');
        }
        const cookieHeader = request.headers.get('cookie') || '';

        return resolveAuthSession({ apiUrl, cookieHeader });
    }
);
