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
import { AUTH_ME_CACHE_KEY } from './auth-cache';

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
        // Better Auth exposes this endpoint as `/request-password-reset`
        // (not `/forget-password`, which the codebase used historically).
        // Discovered 2026-05-14 during SPEC-103 T-017 smoke when POSTs
        // to the old path returned 404 from Better Auth's internal
        // router. See `node_modules/better-auth/dist/api/routes/password.mjs`.
        const response = await fetch(`${baseURL}/api/auth/request-password-reset`, {
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

/**
 * Force Better Auth to bypass its cookie cache and re-fetch the user record
 * from the database, then update the session cookie with the fresh snapshot.
 *
 * Also clears the UserMenu's 60-second sessionStorage cache of `/auth/me` so
 * the navbar doesn't paint from the stale snapshot during the brief window
 * between hydration and the background `/auth/me` re-fetch.
 *
 * Call this from the client after a mutation that changes a field surfaced in
 * the session (notably `display_name`, mapped to Better Auth's virtual `name`)
 * BEFORE doing a hard navigation. Without this, the next page renders with
 * the stale cached snapshot — the navbar appears correct from SSR for ~one
 * frame, then UserMenu's `useEffect` reads the cached empty snapshot and the
 * name flickers away.
 *
 * Best-effort: any network or auth error is swallowed — the caller proceeds
 * with the redirect either way (the cache will refresh organically within
 * the cookie cache TTL).
 */
export async function refreshBetterAuthSession(): Promise<void> {
    // Clear the navbar's session-cache snapshot synchronously first so even if
    // the fetch below fails / is slow, the UserMenu doesn't render the stale
    // cached state.
    if (typeof sessionStorage !== 'undefined') {
        try {
            sessionStorage.removeItem(AUTH_ME_CACHE_KEY);
        } catch {
            // sessionStorage may throw in private mode — ignore.
        }
    }

    const baseURL = getAuthBaseUrl();
    try {
        await fetch(`${baseURL}/api/auth/get-session?disableCookieCache=true`, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store'
        });
    } catch {
        // Best-effort: swallow.
    }
}

/** Inferred session type from the Better Auth server config */
export type Session = typeof authClient.$Infer.Session;
