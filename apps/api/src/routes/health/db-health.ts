/**
 * Database health check route
 * Returns the health status of the database connection
 */
import { createRoute, z } from '@hono/zod-openapi';
import { getDb, sql } from '@repo/db';
import createApp from '../../utils/create-app';

const app = createApp();

// Database health check schema
const DatabaseHealthResponseSchema = z.object({
    status: z.enum(['up', 'down']),
    database: z.object({
        status: z.enum(['connected', 'disconnected']),
        responseTime: z.number().optional(),
        error: z.string().optional()
    }),
    timestamp: z.string(),
    uptime: z.number(),
    version: z.string(),
    environment: z.string()
});

// Database health check route
const dbHealthRoute = createRoute({
    method: 'get',
    path: '/db',
    summary: 'Database health check',
    description: 'Returns the health status of the database connection',
    tags: ['Health'],
    responses: {
        200: {
            description: 'Database health status',
            content: {
                'application/json': {
                    schema: DatabaseHealthResponseSchema
                }
            }
        },
        503: {
            description: 'Database is down',
            content: {
                'application/json': {
                    schema: DatabaseHealthResponseSchema
                }
            }
        }
    }
});

app.openapi(dbHealthRoute, async (c) => {
    const startTime = Date.now();
    const uptime = process.uptime();

    try {
        // Test database connection by getting the client
        const db = getDb();
        await db.execute(sql`SELECT 1`);
        const responseTime = Date.now() - startTime;

        return c.json({
            status: 'up' as const,
            database: {
                status: 'connected' as const,
                responseTime
            },
            timestamp: new Date().toISOString(),
            uptime,
            version: '1.0.0',
            environment: process.env.NODE_ENV || 'development'
        });
    } catch (error) {
        const responseTime = Date.now() - startTime;

        return c.json(
            {
                status: 'down' as const,
                database: {
                    status: 'disconnected' as const,
                    responseTime,
                    error: error instanceof Error ? error.message : 'Unknown database error'
                },
                timestamp: new Date().toISOString(),
                uptime,
                version: '1.0.0',
                environment: process.env.NODE_ENV || 'development'
            },
            503
        );
    }
});

export { app as dbHealthRoutes };
