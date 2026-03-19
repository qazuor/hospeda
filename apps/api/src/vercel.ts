import { ensureDefaultPromoCodes } from '@repo/service-core';
/**
 * Vercel Serverless Entry Point
 *
 * Exports a stateless fetch handler for Vercel serverless functions.
 * Lazy-initializes DB, billing, and promo codes on first request.
 * No cron scheduler, no graceful shutdown, no process signal handlers.
 *
 * @module vercel
 */
import { handle } from 'hono/vercel';
import { initApp } from './app';
import { initializeSentry } from './lib/sentry';
import { initializeDatabase } from './utils/database';
import { validateApiEnv } from './utils/env';
import { apiLogger } from './utils/logger';

/** Whether initialization has completed */
let initialized = false;

/** Promise for in-flight initialization (prevents concurrent init) */
let initPromise: Promise<void> | null = null;

/**
 * Lazily initialize all server dependencies on first request.
 * Subsequent requests skip initialization.
 * Concurrent requests during init share the same promise.
 */
async function ensureInitialized(): Promise<void> {
    if (initialized) return;

    if (initPromise) {
        await initPromise;
        return;
    }

    initPromise = (async () => {
        try {
            validateApiEnv();
            initializeSentry();
            await initializeDatabase();

            // Import billing validation dynamically to avoid top-level side effects
            const { validateBillingConfigOrThrow } = await import('@repo/billing');
            validateBillingConfigOrThrow();

            await ensureDefaultPromoCodes();

            initialized = true;
            apiLogger.info('Vercel serverless: initialization complete');
        } catch (error) {
            // Reset so next request retries
            initPromise = null;
            throw error;
        }
    })();

    await initPromise;
}

const app = initApp();

/**
 * Vercel serverless handler.
 * Runs lazy initialization before delegating to the Hono app.
 */
const handler = handle(app);

export default async function vercelHandler(request: Request): Promise<Response> {
    await ensureInitialized();
    return handler(request);
}
