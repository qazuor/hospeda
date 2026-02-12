/**
 * Better Auth React client for the Astro web application.
 *
 * Provides authentication methods (signIn, signUp, signOut)
 * and session management via React hooks for use in React islands.
 *
 * The client connects to the API's Better Auth endpoints at /api/auth/*.
 *
 * @module auth-client
 */

import { createAuthClient } from 'better-auth/react';

/**
 * Resolves the API base URL from environment variables.
 * Astro uses PUBLIC_ prefix for client-exposed variables.
 */
function getBaseURL(): string {
    if (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_API_URL) {
        return import.meta.env.PUBLIC_API_URL;
    }
    return 'http://localhost:3001';
}

/**
 * Better Auth client instance configured for the Hospeda web app.
 *
 * Does not include the admin plugin since the public web app
 * does not need admin capabilities (role management, banning, etc.).
 * Session is cookie-based (credentials: 'include' is automatic).
 *
 * @example
 * ```tsx
 * import { authClient } from '@/lib/auth-client';
 *
 * // Sign in
 * const { data, error } = await authClient.signIn.email({
 *   email: 'user@example.com',
 *   password: 'password123'
 * });
 *
 * // Use session hook in a React island
 * const { data: session, isPending } = authClient.useSession();
 * ```
 */
export const authClient = createAuthClient({
    baseURL: getBaseURL(),
    basePath: '/api/auth'
});

/** Sign in with email/password or social providers */
export const signIn = authClient.signIn;

/** Sign up with email/password */
export const signUp = authClient.signUp;

/** Sign out and invalidate session */
export const signOut = authClient.signOut;

/** React hook for accessing current session state */
export const useSession = authClient.useSession;

/** Inferred session type from the Better Auth server config */
export type Session = typeof authClient.$Infer.Session;
