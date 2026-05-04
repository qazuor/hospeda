/**
 * Cron Authentication Middleware
 * Protects cron endpoints from unauthorized access.
 *
 * Two paths are accepted:
 * 1. **Upstash QStash signature** — the production scheduler signs every
 *    request with a rotating key; verification uses
 *    {@link verifyQStashSignature}.
 * 2. **Shared `HOSPEDA_CRON_SECRET`** (Bearer token or `X-Cron-Secret`
 *    header) — used by local dev, the admin panel's manual trigger, and
 *    operators reaching the API directly.
 *
 * @module cron/middleware
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppBindings } from '../types';
import { env } from '../utils/env.js';
import { isQStashConfigured, verifyQStashSignature } from './qstash.js';

/**
 * Compares two strings in constant time to prevent timing attacks.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns True if strings are equal, false otherwise
 */
function timingSafeCompare(a: string, b: string): boolean {
    // Hash both inputs to fixed-length buffers to prevent length-based timing leaks
    const hashA = createHash('sha256').update(a).digest();
    const hashB = createHash('sha256').update(b).digest();
    return timingSafeEqual(hashA, hashB);
}

/**
 * Authenticates incoming cron requests by accepting either an Upstash
 * QStash signature header or a shared secret. Either path is enough — at
 * least one must be configured for cron requests to succeed.
 */
export const cronAuthMiddleware = async (c: Context<AppBindings>, next: Next): Promise<void> => {
    const cronSecret = env.HOSPEDA_CRON_SECRET;
    const qstashAvailable = isQStashConfigured();

    if (!cronSecret && !qstashAvailable) {
        throw new HTTPException(503, {
            message:
                'Cron system not configured. Set HOSPEDA_CRON_SECRET (manual trigger) and/or QSTASH_*_SIGNING_KEY (production scheduler).'
        });
    }

    // Path 1: Upstash QStash signed requests carry `Upstash-Signature`.
    const qstashSignature = c.req.header('upstash-signature');
    if (qstashSignature && qstashAvailable) {
        const rawBody = await c.req.text();
        if (await verifyQStashSignature(qstashSignature, rawBody)) {
            await next();
            return;
        }
        // Signature header was present but invalid: fail closed without
        // letting the caller probe the shared-secret path next.
        throw new HTTPException(401, {
            message: 'Invalid Upstash-Signature on cron request'
        });
    }

    // Path 2: shared secret (Authorization: Bearer <secret> or X-Cron-Secret).
    if (cronSecret) {
        const authHeader = c.req.header('authorization');
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            if (timingSafeCompare(token, cronSecret)) {
                await next();
                return;
            }
        }

        const cronSecretHeader = c.req.header('x-cron-secret');
        if (cronSecretHeader !== undefined && timingSafeCompare(cronSecretHeader, cronSecret)) {
            await next();
            return;
        }
    }

    throw new HTTPException(401, {
        message: 'Invalid or missing cron authentication'
    });
};
