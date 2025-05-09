import { apiV1Router } from '@/routes/v1';
import type { Env } from '@/types';
import { serve } from '@hono/node-server';
import { getLoggerConfigs, getMainConfigs } from '@repo/config/server';
import { configureLogger, logger } from '@repo/logger';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
configureLogger(getLoggerConfigs());

const app = new Hono<Env>();

app.use(
    '*',
    honoLogger((str: string) => {
        const [method, path, status] = str.split(' ');
        logger.info(`${method} ${path} - ${status}`);
    })
);

app.use(
    '*',
    cors({
        origin: ['http://localhost:4321', 'http://localhost:5173'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowHeaders: ['Content-Type', 'Authorization'],
        exposeHeaders: ['Content-Length', 'X-Request-Id'],
        maxAge: 86400,
        credentials: true
    })
);

// Error handling
// app.onError(errorHandler);

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// API routes (versioned)
app.route('/api/v1', apiV1Router);

serve(
    {
        fetch: app.fetch,
        port: getMainConfigs().API_PORT
    },
    (info) => {
        logger.info(`Server is running on ${getMainConfigs().API_HOST}:${info.port}`);
    }
);
