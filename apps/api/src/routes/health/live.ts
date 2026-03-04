/**
 * Liveness check route
 * Indicates if the service is alive
 */
import { HealthLivenessSchema } from '@repo/schemas';
import { createSimpleRoute } from '../../utils/route-factory';

export const liveRoutes = createSimpleRoute({
    method: 'get',
    path: '/live',
    summary: 'Liveness check',
    description: 'Indicates if the service is alive',
    tags: ['Health'],
    responseSchema: HealthLivenessSchema,
    handler: () => ({
        alive: true,
        timestamp: new Date().toISOString()
    }),
    options: {
        skipAuth: true,
        skipValidation: true,
        cacheTTL: 5,
        customRateLimit: { requests: 1000, windowMs: 60000 }
    }
});
