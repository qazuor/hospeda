import { serve } from '@hono/node-server';
import { logger } from '@repo/logger';
import { app } from './app';

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;

console.info(`Starting API server on port ${PORT}`);

serve({
    fetch: app.fetch,
    port: PORT
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', 'API:UnhandledRejection', { reason, promise });
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', 'API:UncaughtException', error);
    process.exit(1);
});
