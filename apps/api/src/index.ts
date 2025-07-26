/**
 * API Server Entry Point
 * Starts the Hono.js server with all configured middleware and routes
 */
import { serve } from '@hono/node-server';
import { logger } from '@repo/logger';
import { app } from './app';
import { env } from './utils/env';
import { listRoutes } from './utils/list-routes';

const port = env.API_PORT;

logger.info('Starting API server...', `Port: ${port}, Environment: ${env.NODE_ENV}`);

// Start the server
const server = serve(
    {
        fetch: app.fetch,
        port
    },
    (info) => {
        logger.info(`🚀 Server running on port ${info.port}`, `Environment: ${env.NODE_ENV}`);

        // List all registered routes after a small delay to ensure all routes are registered
        setTimeout(() => {
            listRoutes(app);
        }, 100);
    }
);

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
        logger.error('Force closing server after timeout');
        process.exit(1);
    }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error(`Uncaught exception: ${error.message}`, error.stack || '');
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled rejection at: ${promise}`, `Reason: ${reason}`);
    process.exit(1);
});

export { app };
