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
import { getWebRequest } from '@tanstack/react-start/server';

/**
 * Auth state returned by the session validation
 */
export interface AuthState {
    readonly userId: string | null;
    readonly isAuthenticated: boolean;
    readonly role: string | null;
    readonly permissions: readonly string[];
    readonly passwordChangeRequired: boolean;
    readonly displayName: string | null;
    readonly email: string | null;
    readonly avatar: string | null;
    readonly emailVerified: boolean;
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
    role: null,
    permissions: [],
    passwordChangeRequired: false,
    displayName: null,
    email: null,
    avatar: null,
    emailVerified: false
} as const;

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
 * yields permissions. A failing `/auth/me` is non-fatal (empty permissions).
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
                role?: string;
                name?: string;
                email?: string;
                image?: string;
                emailVerified?: boolean;
            };
        };

        if (!sessionData?.user?.id) {
            return UNAUTHENTICATED_STATE;
        }

        // Read permissions + password-change flag from the already in-flight
        // /auth/me response. Consumed only here, after the session validated.
        let permissions: string[] = [];
        let passwordChangeRequired = false;
        if (meResponse?.ok) {
            try {
                const meData = (await meResponse.json()) as {
                    success?: boolean;
                    data?: {
                        actor?: { permissions?: string[] };
                        passwordChangeRequired?: boolean;
                    };
                };

                if (meData?.success && meData?.data?.actor?.permissions) {
                    permissions = meData.data.actor.permissions;
                }
                passwordChangeRequired = meData?.data?.passwordChangeRequired ?? false;
            } catch {
                // Permissions parse failure is non-fatal.. role check still applies
            }
        }

        return {
            userId: sessionData.user.id,
            isAuthenticated: true,
            role: sessionData.user.role || null,
            permissions,
            passwordChangeRequired,
            displayName: sessionData.user.name || null,
            email: sessionData.user.email || null,
            avatar: sessionData.user.image || null,
            emailVerified: sessionData.user.emailVerified ?? false
        };
    } catch {
        return UNAUTHENTICATED_STATE;
    }
}

export const fetchAuthSession = createServerFn({ method: 'GET' }).handler(
    async (): Promise<AuthState> => {
        const request = getWebRequest();
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
