/**
 * Better Auth React client for the web3 application.
 *
 * Provides authentication methods (signIn, signUp, signOut),
 * session management via React hooks, and password reset capabilities.
 *
 * @module auth-client
 */

import { createAuthClient } from 'better-auth/react';
import { getApiUrl } from './env.js';

/**
 * Better Auth client instance configured for the Hospeda web3 app.
 */
export const authClient = createAuthClient({
    baseURL: getApiUrl(),
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
 */
export async function forgetPassword({
    email,
    redirectTo
}: {
    email: string;
    redirectTo: string;
}): Promise<AuthApiResult> {
    const baseURL = getApiUrl();
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
 */
export async function resetPassword({
    newPassword,
    token
}: {
    newPassword: string;
    token: string;
}): Promise<AuthApiResult> {
    const baseURL = getApiUrl();
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
 */
export async function verifyEmail({
    token
}: {
    token: string;
}): Promise<AuthApiResult> {
    const baseURL = getApiUrl();
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
