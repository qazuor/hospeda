/**
 * Better Auth React client for the web application.
 *
 * Provides authentication methods (signIn, signUp, signOut),
 * session management via React hooks, and password reset capabilities.
 *
 * The client connects to the API's Better Auth endpoints at /api/auth/*.
 * Used by React island components in auth pages.
 *
 * @module auth-client
 */

import { createAuthClient } from 'better-auth/react';

/**
 * Resolves the API base URL from environment variables.
 * Supports both Astro's public env vars (client-side) and server-side fallback.
 */
function getBaseURL(): string {
    if (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_API_URL) {
        return import.meta.env.PUBLIC_API_URL;
    }
    if (typeof process !== 'undefined' && process.env?.HOSPEDA_API_URL) {
        return process.env.HOSPEDA_API_URL;
    }
    return 'http://localhost:3001';
}

/**
 * Better Auth client instance configured for the Hospeda web app.
 *
 * Session is cookie-based (credentials: 'include' is automatic).
 * No admin plugin needed for the public-facing web app.
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

/**
 * Standard API response shape for auth operations.
 */
interface AuthApiResult {
    data?: unknown;
    error?: { message?: string; code?: string } | null;
}

/**
 * Request a password reset email via the Better Auth API.
 *
 * @param params.email - The user's email address.
 * @param params.redirectTo - The URL to redirect to from the reset email link.
 * @returns Result with data on success or error on failure.
 */
export async function forgetPassword({
    email,
    redirectTo
}: {
    email: string;
    redirectTo: string;
}): Promise<AuthApiResult> {
    const baseURL = getBaseURL();
    try {
        const response = await fetch(`${baseURL}/api/auth/forget-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, redirectTo })
        });
        const data = await response.json();
        if (!response.ok) {
            return { error: { message: data?.message || 'Failed to send reset email' } };
        }
        return { data };
    } catch {
        return { error: { message: 'Network error. Please try again.' } };
    }
}

/**
 * Reset password using a token from the reset email.
 *
 * @param params.newPassword - The new password.
 * @param params.token - The reset token from the email link.
 * @returns Result with data on success or error on failure.
 */
export async function resetPassword({
    newPassword,
    token
}: {
    newPassword: string;
    token: string;
}): Promise<AuthApiResult> {
    const baseURL = getBaseURL();
    try {
        const response = await fetch(`${baseURL}/api/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ newPassword, token })
        });
        const data = await response.json();
        if (!response.ok) {
            return { error: { message: data?.message || 'Failed to reset password' } };
        }
        return { data };
    } catch {
        return { error: { message: 'Network error. Please try again.' } };
    }
}

/**
 * Verify email address using a token from the verification email.
 *
 * @param params.token - The verification token from the email link.
 * @returns Result with data on success or error on failure.
 */
export async function verifyEmail({
    token
}: {
    token: string;
}): Promise<AuthApiResult> {
    const baseURL = getBaseURL();
    try {
        const response = await fetch(`${baseURL}/api/auth/verify-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ token })
        });
        const data = await response.json();
        if (!response.ok) {
            return { error: { message: data?.message || 'Verification failed' } };
        }
        return { data };
    } catch {
        return { error: { message: 'Network error. Please try again.' } };
    }
}

/** Inferred session type from the Better Auth server config */
export type Session = typeof authClient.$Infer.Session;
