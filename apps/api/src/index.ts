/**
 * API Server Entry Point
 * Starts the Hono.js server with all configured middleware and routes
 */
import { serve } from '@hono/node-server';
import { validateBillingConfigOrThrow } from '@repo/billing';
import { initApp } from './app';
import { startCronScheduler } from './cron';
import { closeSentry, initializeSentry } from './lib/sentry';
import { ensureDefaultPromoCodes } from './services/promo-code-defaults';
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

const port = env.API_PORT;

/**
 * Starts the API server with database initialization
 */
const startServer = async (): Promise<void> => {
    try {
        apiLogger.info('Starting API server...', `Port: ${port}, Environment: ${env.NODE_ENV}`);

        // Initialize database connection before starting the server
        await initializeDatabase();

        // Validate billing configuration
        validateBillingConfigOrThrow();

        // Ensure default promo codes exist (HOSPEDA_FREE, etc.)
        await ensureDefaultPromoCodes();

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
                    startCronScheduler(port).catch((error) => {
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
 * SPEC-020 US-14 originally required process.exit(1) here for the Fly.io VM deployment,
 * where a long-running Node process with corrupted state could silently serve bad responses.
 *
 * After migrating to Vercel serverless (commit 437513a1), process.exit() is intentionally
 * omitted because:
 *   - Each request runs in an isolated function invocation.
 *   - Calling process.exit() kills the function mid-request, causing 502 errors.
 *   - The serverless runtime automatically manages process lifecycle and cold starts.
 *
 * WARNING: If the API is re-deployed on a long-running VM (Docker, EC2, etc.),
 * process.exit(1) MUST be re-enabled to prevent corrupted state from persisting.
 */
process.on('uncaughtException', (error) => {
    apiLogger.error(
        `🚨 UNCAUGHT EXCEPTION - Process state may be corrupted: ${error.message}`,
        error.stack || ''
    );

    // Capture in Sentry if enabled
    import('./lib/sentry').then(({ Sentry }) => {
        if (Sentry.isEnabled()) {
            Sentry.captureException(error);
        }
    });

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
    import('./lib/sentry').then(({ Sentry }) => {
        if (Sentry.isEnabled()) {
            Sentry.captureException(reason instanceof Error ? reason : new Error(reasonStr));
        }
    });

    // Log but do NOT terminate - allow the server to continue
    // In production, monitor these via observability tools
});
