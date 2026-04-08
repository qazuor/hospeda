/**
 * Better Auth browser client for the web2 application.
 *
 * Provides authentication methods (signIn, signUp, signOut),
 * session management via React hooks, and password reset / email verification.
 *
 * All fallible operations return a unified `ApiResult<T>` shape so callers
 * never need to handle ad-hoc error formats.
 *
 * NEVER use `import.meta.env` directly here. Access env through `./env`.
 *
 * @module auth-client
 */

import { createAuthClient } from 'better-auth/react';

/**
 * Resolve the API base URL for the browser-side auth client.
 *
 * Uses `import.meta.env.PUBLIC_API_URL` which Vite injects at build time
 * (available in both server and client bundles).
 *
 * NEVER use `getApiUrl()` from `./env.ts` here — that module accesses
 * `process.env` which is NOT available in the browser and would crash
 * the entire island.
 */
function getAuthBaseUrl(): string {
    const url = import.meta.env.PUBLIC_API_URL as string | undefined;
    if (!url) {
        throw new Error('[auth-client] PUBLIC_API_URL is not configured');
    }
    return url.replace(/\/$/, '');
}

/**
 * Better Auth client instance configured for the Hospeda web2 app.
 */
export const authClient = createAuthClient({
    baseURL: getAuthBaseUrl(),
    basePath: '/api/auth'
});

/** Sign in with email/password or social providers */
export const signIn = authClient.signIn;

/** Sign up with email/password */
export const signUp = authClient.signUp;

/** Sign out and invalidate the current session */
export const signOut = authClient.signOut;

/** React hook for accessing current session state */
export const useSession = authClient.useSession;

// ---------------------------------------------------------------------------
// Unified result type (matches ApiResult<T> used elsewhere in web2)
// ---------------------------------------------------------------------------

/**
 * Unified response shape for auth operations that require manual fetch calls.
 * Mirrors the `ApiResult<T>` pattern used in `lib/api/types.ts` so callers
 * have a single consistent error-handling contract.
 */
export interface AuthResult<T = unknown> {
    readonly data?: T;
    readonly error?: { readonly message?: string; readonly code?: string } | null;
}

// ---------------------------------------------------------------------------
// Manual auth helpers (operations not covered by the Better Auth client SDK)
// ---------------------------------------------------------------------------

/**
 * Request a password reset email via the Better Auth API.
 *
 * @param params.email - The email address to send the reset link to
 * @param params.redirectTo - The URL embedded in the reset email (e.g. `/es/auth/reset-password/`)
 * @returns `AuthResult` with empty data on success or an error message on failure
 */
export async function forgetPassword({
    email,
    redirectTo
}: {
    readonly email: string;
    readonly redirectTo: string;
}): Promise<AuthResult> {
    const baseURL = getAuthBaseUrl();
    try {
        const response = await fetch(`${baseURL}/api/auth/forget-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, redirectTo })
        });
        const data = (await response.json()) as Record<string, unknown>;
        if (!response.ok) {
            return {
                error: {
                    message:
                        typeof data?.message === 'string'
                            ? data.message
                            : 'Error al enviar el correo de recuperacion'
                }
            };
        }
        return { data };
    } catch {
        return { error: { message: 'Error de red. Por favor, intenta de nuevo.' } };
    }
}

/**
 * Reset password using a one-time token from the reset email.
 *
 * @param params.newPassword - The new password to set
 * @param params.token - The reset token extracted from the email link
 * @returns `AuthResult` with empty data on success or an error message on failure
 */
export async function resetPassword({
    newPassword,
    token
}: {
    readonly newPassword: string;
    readonly token: string;
}): Promise<AuthResult> {
    const baseURL = getAuthBaseUrl();
    try {
        const response = await fetch(`${baseURL}/api/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ newPassword, token })
        });
        const data = (await response.json()) as Record<string, unknown>;
        if (!response.ok) {
            return {
                error: {
                    message:
                        typeof data?.message === 'string'
                            ? data.message
                            : 'No se pudo restablecer la contrasena'
                }
            };
        }
        return { data };
    } catch {
        return { error: { message: 'Error de red. Por favor, intenta de nuevo.' } };
    }
}

/**
 * Verify an email address using a one-time token from the verification email.
 *
 * @param params.token - The verification token extracted from the email link
 * @returns `AuthResult` with empty data on success or an error message on failure
 */
export async function verifyEmail({
    token
}: {
    readonly token: string;
}): Promise<AuthResult> {
    const baseURL = getAuthBaseUrl();
    try {
        const response = await fetch(`${baseURL}/api/auth/verify-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ token })
        });
        const data = (await response.json()) as Record<string, unknown>;
        if (!response.ok) {
            return {
                error: {
                    message:
                        typeof data?.message === 'string' ? data.message : 'La verificacion fallo'
                }
            };
        }
        return { data };
    } catch {
        return { error: { message: 'Error de red. Por favor, intenta de nuevo.' } };
    }
}

/** Inferred session type from the Better Auth server config */
export type Session = typeof authClient.$Infer.Session;
