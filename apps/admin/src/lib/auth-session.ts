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
}

/**
 * Server function to validate the current session via Better Auth API.
 *
 * Forwards the request cookies to the Better Auth get-session endpoint.
 * Returns the authentication state including the user ID.
 *
 * @returns Auth state with userId and isAuthenticated flag
 */
export const fetchAuthSession = createServerFn({ method: 'GET' }).handler(
    async (): Promise<AuthState> => {
        const request = getWebRequest();
        if (!request) {
            return { userId: null, isAuthenticated: false };
        }

        const apiUrl =
            process.env.HOSPEDA_API_URL || process.env.VITE_API_URL || 'http://localhost:3001';

        try {
            const response = await fetch(`${apiUrl}/api/auth/get-session`, {
                headers: {
                    cookie: request.headers.get('cookie') || ''
                }
            });

            if (!response.ok) {
                return { userId: null, isAuthenticated: false };
            }

            const data = (await response.json()) as {
                user?: { id?: string };
            };

            return {
                userId: data?.user?.id || null,
                isAuthenticated: !!data?.user?.id
            };
        } catch {
            return { userId: null, isAuthenticated: false };
        }
    }
);
