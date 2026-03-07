/**
 * Main health check route
 * Returns the health status of the API
 */
import { HealthResponseSchema } from '@repo/schemas';
import { createSimpleRoute } from '../../utils/route-factory';

export const healthRoutes = createSimpleRoute({
    method: 'get',
    path: '/',
    summary: 'Health check',
    description: 'Returns the health status of the API',
    tags: ['Health'],
    responseSchema: HealthResponseSchema,
    handler: () => ({
        status: 'healthy' as const,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0'
    }),
    options: {
        skipAuth: true,
        skipValidation: true,
        cacheTTL: 10,
        customRateLimit: { requests: 1000, windowMs: 60000 }
    }
});
