/**
 * Cron Authentication Middleware
 * Protects cron endpoints from unauthorized access
 * @module cron/middleware
 */

import { timingSafeEqual } from 'node:crypto';
import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppBindings } from '../types';
import { env } from '../utils/env.js';

/**
 * Compares two strings in constant time to prevent timing attacks.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns True if strings are equal, false otherwise
 */
function timingSafeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

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
        if (timingSafeCompare(token, cronSecret)) {
            await next();
            return;
        }
    }

    // Check X-Cron-Secret header
    const cronSecretHeader = c.req.header('x-cron-secret');
    if (cronSecretHeader !== undefined && timingSafeCompare(cronSecretHeader, cronSecret)) {
        await next();
        return;
    }

    // No valid authentication found
    throw new HTTPException(401, {
        message: 'Invalid or missing cron authentication'
    });
};
