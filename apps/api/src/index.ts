/**
 * API Server Entry Point
 * Starts the Hono.js server with all configured middleware and routes
 */
import { serve } from '@hono/node-server';
import { validateBillingConfigOrThrow } from '@repo/billing';
import { getDb, rolePermission } from '@repo/db';
import { locales } from '@repo/i18n';
import { ensureDefaultPromoCodes, initializeRevalidationService } from '@repo/service-core';
import { count } from 'drizzle-orm';
import { initApp } from './app';
import { startCronScheduler } from './cron';
import { createEntityResolver } from './lib/entity-resolver';
import { closeSentry, initializeSentry } from './lib/sentry';
import { initializeMediaProvider } from './services/media';
import { closeDatabase, initializeDatabase } from './utils/database';
import { env, validateApiEnv } from './utils/env';
import { listRoutes } from './utils/list-routes';
import { apiLogger } from './utils/logger';
import { disconnectRedis } from './utils/redis';
import { destroyUserPermissionsCache } from './utils/user-permissions-cache';

// Validate environment variables before starting the server
validateApiEnv();

// Initialize Sentry for error tracking (if DSN is configured)
initializeSentry();

// SPEC-078-GAPS T-056 / GAP-078-014:
// Eagerly initialize the Cloudinary media provider so its init warning is
// emitted exactly once at boot (not lazily on the first upload request).
initializeMediaProvider();

const port = env.API_PORT;

/**
 * Starts the API server with database initialization
 */
const startServer = async (): Promise<void> => {
    try {
        apiLogger.info('Starting API server...', `Port: ${port}, Environment: ${env.NODE_ENV}`);

        // Initialize database connection before starting the server
        await initializeDatabase();

        // SPEC-103 T-073: fail-fast healthcheck against an essential table.
        // The /health endpoint does NOT touch the DB by design, so an
        // empty DB previously booted "healthy" and only surfaced as 500s
        // when the first auth-requiring request hit the actor middleware.
        // role_permission is the cleanest tripwire: it must be populated
        // by the seed (~600+ rows) for any actor resolution to succeed.
        // If the count is 0 the deploy is broken — crash-loop so the
        // supervisor surfaces the misconfiguration immediately.
        const [{ value: rolePermissionCount }] = await getDb()
            .select({ value: count() })
            .from(rolePermission);
        if (rolePermissionCount === 0) {
            apiLogger.error(
                'STARTUP HEALTHCHECK FAILED: role_permission table is empty. ' +
                    'The DB is unseeded or pointed at the wrong host. ' +
                    'Run `pnpm db:seed` against the target DB before redeploying. ' +
                    'Refusing to start the server.'
            );
            process.exit(1);
        }
        apiLogger.info(`Startup healthcheck OK: role_permission has ${rolePermissionCount} rows`);

        // Validate billing configuration
        validateBillingConfigOrThrow();

        // Ensure default promo codes exist (HOSPEDA_FREE, etc.)
        await ensureDefaultPromoCodes();

        // Initialize ISR revalidation service (optional — only if secret is configured)
        if (env.HOSPEDA_REVALIDATION_SECRET) {
            initializeRevalidationService({
                nodeEnv: env.NODE_ENV,
                revalidationSecret: env.HOSPEDA_REVALIDATION_SECRET,
                siteUrl: env.HOSPEDA_SITE_URL ?? 'https://hospeda.com.ar',
                locales,
                entityResolver: createEntityResolver()
            });
            apiLogger.info('ISR revalidation service initialized');
        }

        const app = initApp();

        // Start the server
        const server = serve(
            {
                fetch: app.fetch,
                port
            },
            (info) => {
                apiLogger.info(`🚀 Server running on port ${info.port}`);

                // List all registered routes after a small delay to ensure all routes are registered
                setTimeout(() => {
                    listRoutes(app);
                }, 100);

                // Start cron scheduler (only in non-test environments)
                if (env.NODE_ENV !== 'test') {
                    startCronScheduler().catch((error) => {
                        apiLogger.error(
                            'Failed to start cron scheduler:',
                            error instanceof Error ? error.message : String(error)
                        );
                    });
                }
            }
        );

        // Graceful shutdown
        const gracefulShutdown = async (signal: string) => {
            apiLogger.info(`Received ${signal}, shutting down gracefully...`);

            try {
                // Flush Sentry events
                await closeSentry(2000);

                // Clear in-memory caches
                destroyUserPermissionsCache();

                // Close Redis connection
                await disconnectRedis();

                // Close database connection
                await closeDatabase();

                // Close server
                server.close(() => {
                    apiLogger.info('Server closed');
                    process.exit(0);
                });
            } catch (error) {
                apiLogger.error(
                    'Error during shutdown:',
                    error instanceof Error ? error.message : String(error)
                );
                process.exit(1);
            }

            // Force close after 10 seconds
            setTimeout(() => {
                apiLogger.error('Force closing server after timeout');
                process.exit(1);
            }, 10000);
        };

        // Handle shutdown signals
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    } catch (error) {
        apiLogger.error(
            'Failed to start server:',
            error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
    }
};

// Start the server
startServer();

/**
 * Global error handlers
 *
 * These handlers log errors but DO NOT terminate the process.
 * This allows the server to continue serving requests after non-fatal errors.
 *
 * Note: In production, these errors should be monitored via observability tools
 * (e.g., Sentry, DataDog) to track and fix issues.
 */

/**
 * Handle uncaught exceptions.
 *
 * SPEC-020 US-14 required process.exit(1) here so a long-running Node process
 * with corrupted state could not silently serve bad responses; the original
 * deployment target was Fly.io VMs.
 *
 * The handler currently logs without exiting. That was acceptable on Vercel
 * serverless (each request was isolated, process.exit mid-request would cause
 * 502s), but is NOT correct for the current VPS Coolify Docker target where
 * the process is long-running. TODO: re-enable process.exit(1) once the
 * supervisor's restart policy has been validated end-to-end on the VPS so a
 * corrupted process is killed and replaced rather than left to serve traffic.
 */
process.on('uncaughtException', (error) => {
    apiLogger.error(
        `🚨 UNCAUGHT EXCEPTION - Process state may be corrupted: ${error.message}`,
        error.stack || ''
    );

    // Capture in Sentry if enabled
    void (async () => {
        try {
            const { Sentry } = await import('./lib/sentry');
            if (Sentry.isEnabled()) {
                Sentry.captureException(error);
            }
        } catch {
            // Sentry not available, error already logged
        }
    })();

    // Log but do NOT terminate - allow the server to continue
    // In production, monitor these closely via observability tools
});

// Handle unhandled promise rejections
// These are less severe than uncaught exceptions and can usually be recovered from
process.on('unhandledRejection', (reason, promise) => {
    const reasonStr = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : '';
    apiLogger.error({
        message: `⚠️ UNHANDLED REJECTION: ${reasonStr}`,
        promise: String(promise),
        stack: stack || undefined
    });

    // Capture in Sentry if enabled
    void (async () => {
        try {
            const { Sentry } = await import('./lib/sentry');
            if (Sentry.isEnabled()) {
                Sentry.captureException(reason instanceof Error ? reason : new Error(reasonStr));
            }
        } catch {
            // Sentry not available, error already logged
        }
    })();

    // Log but do NOT terminate - allow the server to continue
    // In production, monitor these via observability tools
});
