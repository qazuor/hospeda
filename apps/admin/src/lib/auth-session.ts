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

        try {
            // Validate session via Better Auth
            const sessionResponse = await fetch(`${apiUrl}/api/auth/get-session`, {
                headers: { cookie: cookieHeader }
            });

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

            // Fetch permissions and password change flag from /auth/me endpoint
            let permissions: string[] = [];
            let passwordChangeRequired = false;
            try {
                const meResponse = await fetch(`${apiUrl}/api/v1/public/auth/me`, {
                    headers: { cookie: cookieHeader }
                });

                if (meResponse.ok) {
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
                }
            } catch {
                // Permissions fetch failure is non-fatal.. role check still applies
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
);
