/**
 * Liveness check route
 * Indicates if the service is alive
 */
import { HealthLivenessDataSchema } from '@repo/schemas';
import { createSimpleRoute } from '../../utils/route-factory';

export const liveRoutes = createSimpleRoute({
    method: 'get',
    path: '/live',
    summary: 'Liveness check',
    description: 'Indicates if the service is alive',
    tags: ['Health'],
    responseSchema: HealthLivenessDataSchema,
    handler: () => ({
        alive: true,
        timestamp: new Date().toISOString()
    }),
    options: {
        skipAuth: true,
        skipValidation: true,
        customRateLimit: { requests: 1000, windowMs: 60000 }
    }
});
