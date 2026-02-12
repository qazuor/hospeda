/**
 * Better Auth handler route.
 *
 * Mounts the Better Auth API handler as a catch-all route under /api/auth/*.
 * Better Auth handles all authentication endpoints including:
 * - POST /api/auth/sign-up/email
 * - POST /api/auth/sign-in/email
 * - GET /api/auth/get-session
 * - POST /api/auth/sign-out
 * - POST /api/auth/forget-password
 * - POST /api/auth/reset-password
 * - GET /api/auth/verify-email
 * - Social OAuth callbacks
 *
 * @module auth-handler
 */

import { getAuth } from '../../lib/auth';
import { createRouter } from '../../utils/create-app';

const app = createRouter();

/**
 * Catch-all handler that delegates to Better Auth.
 * Supports both GET and POST methods for all auth endpoints.
 */
app.on(['GET', 'POST'], '/*', (c) => {
    const auth = getAuth();
    return auth.handler(c.req.raw);
});

export { app as betterAuthHandler };
