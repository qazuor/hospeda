/**
 * API Server Entry Point
 * Starts the Hono.js server with all configured middleware and routes
 */
import { serve } from '@hono/node-server';
import { initApp } from './app';
import { closeDatabase, initializeDatabase } from './utils/database';
import { env, validateApiEnv } from './utils/env';
import { listRoutes } from './utils/list-routes';
import { apiLogger } from './utils/logger';

// Validate environment variables before starting the server
validateApiEnv();

const port = env.API_PORT;

/**
 * Starts the API server with database initialization
 */
const startServer = async (): Promise<void> => {
    try {
        apiLogger.info('Starting API server...', `Port: ${port}, Environment: ${env.NODE_ENV}`);

        // Initialize database connection before starting the server
        await initializeDatabase();

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
            }
        );

        // Graceful shutdown
        const gracefulShutdown = async (signal: string) => {
            apiLogger.info(`Received ${signal}, shutting down gracefully...`);

            try {
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

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    apiLogger.error(`Uncaught exception: ${error.message}`, error.stack || '');
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    apiLogger.error(`Unhandled rejection at: ${promise}`, `Reason: ${reason}`);
    process.exit(1);
});
