/**
 * Authentication middleware using Better Auth.
 *
 * Resolves cookie-based sessions from request headers and sets
 * session/user data on the Hono context. Non-blocking: unauthenticated
 * requests pass through and become guest actors downstream.
 *
 * @module auth-middleware
 */

import { RoleEnum } from '@repo/schemas';
import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getAuth } from '../lib/auth';
import { env } from '../utils/env';

/**
 * Check if mock authentication is allowed.
 * @internal TEST-ONLY .. Never enable in production or staging!
 *
 * Mock authentication is ONLY allowed when ALL conditions are met:
 * - NODE_ENV === 'test'
 * - DISABLE_AUTH === 'true' (explicit opt-in)
 * - CI !== 'true' (never in CI pipelines with real tokens)
 *
 * @returns Whether mock authentication is allowed
 */
const isMockAuthAllowed = (): boolean => {
    return (
        env.NODE_ENV === 'test' && env.HOSPEDA_DISABLE_AUTH === true && process.env.CI !== 'true'
    );
};

/**
 * Mock user ID for test environment.
 * Uses a valid UUID v4 format to match the database schema.
 */
const MOCK_USER_ID = '00000000-0000-4000-8000-000000000099';

/**
 * Token patterns that should be treated as invalid in mock mode.
 * These mirror the patterns that real authentication would reject.
 */
const MOCK_INVALID_TOKENS = new Set([
    'Bearer invalid_token_here',
    'Bearer expired_token_here',
    'Bearer malformed',
    'Bearer ',
    'Bearer invalid_token_but_valid_format',
    'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
]);

/**
 * Creates Better Auth session resolution middleware.
 *
 * Resolves the session from request cookies/headers via Better Auth's
 * `getSession` API and sets `session` and `user` on the Hono context.
 * Non-blocking: unauthenticated requests pass through without error
 * and will be assigned a guest actor by the downstream actor middleware.
 *
 * In test mode with `DISABLE_AUTH=true`, returns mock session data
 * when a valid authorization header is present.
 *
 * @returns Middleware handler for session resolution
 */
export const authMiddleware = () => {
    /**
     * @internal TEST-ONLY: Mock authentication for local testing.
     * This mock is ONLY active when isMockAuthAllowed() returns true.
     *
     * @warning NEVER set DISABLE_AUTH=true in production or staging!
     */
    if (isMockAuthAllowed()) {
        return async (c: Context, next: Next) => {
            const authHeader = c.req.header('authorization');

            const hasValidToken =
                authHeader?.startsWith('Bearer ') && !MOCK_INVALID_TOKENS.has(authHeader);

            if (hasValidToken) {
                const now = new Date();
                c.set('user', {
                    id: MOCK_USER_ID,
                    name: 'Test User',
                    email: 'test@example.com',
                    emailVerified: true,
                    image: null,
                    createdAt: now,
                    updatedAt: now,
                    role: RoleEnum.USER,
                    banned: false,
                    banReason: null,
                    banExpires: null
                });
                c.set('session', {
                    id: 'test-session-id',
                    userId: MOCK_USER_ID,
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    token: 'test-session-token',
                    createdAt: now,
                    updatedAt: now,
                    ipAddress: null,
                    userAgent: null
                });
            }

            await next();
        };
    }

    return async (c: Context, next: Next) => {
        try {
            const auth = getAuth();
            const sessionData = await auth.api.getSession({
                headers: c.req.raw.headers
            });

            if (sessionData) {
                c.set('session', sessionData.session);
                c.set('user', sessionData.user);
            }
        } catch {
            // Non-blocking: session resolution failure results in guest access.
            // The actor middleware will create a guest actor when no user is set.
        }

        await next();
    };
};

/**
 * Middleware to require authentication.
 * Returns 401 if user is not authenticated (no session resolved).
 *
 * @example
 * ```typescript
 * import { requireAuth } from './middlewares/auth';
 *
 * app.use('/protected/*', requireAuth);
 * ```
 */
export const requireAuth = async (c: Context, next: Next) => {
    const user = c.get('user');

    if (!user) {
        throw new HTTPException(401, {
            message: 'Authentication required'
        });
    }

    await next();
};
