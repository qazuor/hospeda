/**
 * Shared types for auth-ui components.
 *
 * These types define the interface between auth-ui components and
 * the consuming app's auth client (Better Auth).
 *
 * @module types
 */

/**
 * Result from a sign-in or sign-up operation
 */
export interface AuthResult {
    data?: {
        session?: { id: string };
        user?: { id: string; name?: string; email: string };
    } | null;
    error?: {
        message?: string;
        code?: string;
        status?: number;
    } | null;
}

/**
 * Sign-in methods provided by the auth client
 */
export interface SignInMethods {
    email: (params: { email: string; password: string }) => Promise<AuthResult>;
    social: (params: { provider: string; callbackURL: string }) => Promise<unknown>;
}

/**
 * Sign-up methods provided by the auth client
 */
export interface SignUpMethods {
    email: (params: {
        email: string;
        password: string;
        name: string;
    }) => Promise<AuthResult>;
}

/**
 * User data from a Better Auth session
 */
export interface SessionUser {
    id: string;
    name?: string | null;
    email: string;
    image?: string | null;
}

/**
 * Session data from Better Auth
 */
export interface AuthSession {
    user: SessionUser;
}
