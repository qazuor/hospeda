/**
 * Cron Authentication Middleware
 * Protects cron endpoints from unauthorized access
 * @module cron/middleware
 */

import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppBindings } from '../types';

/**
 * Middleware to authenticate cron job requests
 * Validates requests using a shared secret
 *
 * Authentication methods:
 * - Authorization: Bearer <secret>
 * - X-Cron-Secret: <secret>
 *
 * Environment Variables:
 * - NODE_ENV: Current environment (development, production, test)
 * - CRON_AUTH_DISABLED: Set to 'true' to disable auth in development (default: false)
 * - CRON_SECRET: Shared secret for authenticating cron requests
 *
 * @example
 * ```typescript
 * import { cronAuthMiddleware } from './middleware';
 *
 * app.use('/cron/*', cronAuthMiddleware);
 * ```
 */
export const cronAuthMiddleware = async (c: Context<AppBindings>, next: Next): Promise<void> => {
    // In development, allow bypassing auth if explicitly disabled
    if (process.env.NODE_ENV !== 'production' && process.env.CRON_AUTH_DISABLED === 'true') {
        await next();
        return;
    }

    // Check if CRON_SECRET is configured
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        // In production, missing secret is a configuration error
        if (process.env.NODE_ENV === 'production') {
            throw new HTTPException(503, {
                message: 'Cron system not configured - missing CRON_SECRET'
            });
        }

        // In development/test, log warning but allow
        c.get('logger')?.warn('CRON_SECRET not configured - cron endpoints are unprotected');
        await next();
        return;
    }

    // Check Authorization header (Bearer token)
    const authHeader = c.req.header('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7); // Remove "Bearer " prefix
        if (token === cronSecret) {
            await next();
            return;
        }
    }

    // Check X-Cron-Secret header
    const cronSecretHeader = c.req.header('x-cron-secret');
    if (cronSecretHeader === cronSecret) {
        await next();
        return;
    }

    // No valid authentication found
    throw new HTTPException(401, {
        message: 'Invalid or missing cron authentication'
    });
};
