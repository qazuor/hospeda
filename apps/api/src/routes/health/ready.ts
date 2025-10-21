/**
 * Readiness check route
 * Indicates if the service is ready to serve requests
 */
import { HealthReadinessSchema } from '@repo/schemas';
import { createSimpleRoute } from '../../utils/route-factory';

export const readyRoutes = createSimpleRoute({
    method: 'get',
    path: '/ready',
    summary: 'Readiness check',
    description: 'Indicates if the service is ready to serve requests',
    tags: ['Health'],
    responseSchema: HealthReadinessSchema,
    handler: async () => ({
        ready: true,
        timestamp: new Date().toISOString()
    }),
    options: {
        skipAuth: true, // Public endpoint
        skipValidation: true, // No input validation needed
        cacheTTL: 10, // Cache for 10 seconds
        customRateLimit: { requests: 1000, windowMs: 60000 } // Higher limit for health checks
    }
});
