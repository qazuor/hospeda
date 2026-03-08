/**
 * Better Auth React client for the admin application.
 *
 * Provides authentication methods (signIn, signUp, signOut),
 * session management via React hooks, and admin plugin capabilities.
 *
 * The client connects to the API's Better Auth endpoints at /api/auth/*.
 *
 * @module auth-client
 */

import { adminClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

/**
 * Resolves the API base URL for Better Auth client initialization.
 *
 * This function intentionally reads `import.meta.env` directly rather than
 * going through the centralized `env` module. The reason is that
 * `createAuthClient` is called at module-load time (top-level), which happens
 * before the env singleton is safe to initialize in all environments (e.g.
 * SSR, tests). Reading `import.meta.env` directly avoids triggering the
 * full Zod validation at module-load time.
 *
 * All other files should use `env` from `@/env` instead of reading
 * `import.meta.env` directly.
 */
function getBaseURL(): string {
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
        return import.meta.env.VITE_API_URL as string;
    }
    if (typeof process !== 'undefined' && process.env?.HOSPEDA_API_URL) {
        return process.env.HOSPEDA_API_URL;
    }
    throw new Error('VITE_API_URL or HOSPEDA_API_URL environment variable is required');
}

/**
 * Better Auth client instance configured for the Hospeda admin app.
 *
 * Includes the admin plugin for role/ban management capabilities.
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
 * // Use session hook in a component
 * const { data: session, isPending } = authClient.useSession();
 * ```
 */
export const authClient = createAuthClient({
    baseURL: getBaseURL(),
    basePath: '/api/auth',
    plugins: [adminClient()]
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
