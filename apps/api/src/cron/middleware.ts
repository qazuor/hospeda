/**
 * Cron Authentication Middleware
 * Protects cron endpoints from unauthorized access
 * @module cron/middleware
 */

import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppBindings } from '../types';
import { env } from '../utils/env.js';

/**
 * Middleware to authenticate cron job requests.
 * Validates requests using a shared secret. Always requires CRON_SECRET.
 *
 * Authentication methods:
 * - Authorization: Bearer <secret>
 * - X-Cron-Secret: <secret>
 *
 * Environment Variables:
 * - CRON_SECRET: Shared secret for authenticating cron requests (required in all environments)
 *
 * @example
 * ```typescript
 * import { cronAuthMiddleware } from './middleware';
 *
 * app.use('/cron/*', cronAuthMiddleware);
 * ```
 */
export const cronAuthMiddleware = async (c: Context<AppBindings>, next: Next): Promise<void> => {
    // CRON_SECRET is required in all environments
    const cronSecret = env.HOSPEDA_CRON_SECRET;
    if (!cronSecret) {
        throw new HTTPException(503, {
            message: 'Cron system not configured - CRON_SECRET environment variable is required'
        });
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
