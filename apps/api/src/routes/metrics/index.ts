/**
 * Metrics routes
 * Endpoints for exposing application metrics
 */
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { getMetrics, getPrometheusMetrics, resetMetrics } from '../../middlewares/metrics';
import { createRouter } from '../../utils/create-app';

// Metrics response schema
const MetricsResponseSchema = z.object({
    summary: z.object({
        totalRequests: z.number(),
        totalErrors: z.number(),
        globalErrorRate: z.number(),
        activeConnections: z.number(),
        timestamp: z.string()
    }),
    endpoints: z.array(
        z.object({
            endpoint: z.string(),
            requests: z.number(),
            errors: z.number(),
            errorRate: z.number(),
            avgResponseTime: z.number(),
            maxResponseTime: z.number(),
            minResponseTime: z.number()
        })
    )
});

// Get metrics endpoint
const getMetricsRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Metrics'],
    summary: 'Get application metrics',
    description: 'Returns comprehensive metrics about API performance',
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        data: MetricsResponseSchema
                    })
                }
            },
            description: 'Metrics data retrieved successfully'
        }
    }
});

// Get Prometheus metrics endpoint
const getPrometheusMetricsRoute = createRoute({
    method: 'get',
    path: '/prometheus',
    tags: ['Metrics'],
    summary: 'Get metrics in Prometheus format',
    description: 'Returns metrics in Prometheus exposition format',
    responses: {
        200: {
            content: {
                'text/plain': {
                    schema: z.string()
                }
            },
            description: 'Prometheus metrics data'
        }
    }
});

// Reset metrics endpoint (for development/testing)
const resetMetricsRoute = createRoute({
    method: 'post',
    path: '/reset',
    tags: ['Metrics'],
    summary: 'Reset all metrics',
    description: 'Resets all collected metrics data (development only)',
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        message: z.string()
                    })
                }
            },
            description: 'Metrics reset successfully'
        }
    }
});

// Create router
const router = createRouter();

// Implement routes
router.openapi(getMetricsRoute, (c) => {
    const metrics = getMetrics();
    return c.json({
        success: true,
        data: metrics
    });
});

router.openapi(getPrometheusMetricsRoute, (c) => {
    const prometheusMetrics = getPrometheusMetrics();
    return c.text(prometheusMetrics, 200, {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8'
    });
});

router.openapi(resetMetricsRoute, (c) => {
    resetMetrics();
    return c.json({
        success: true,
        message: 'Metrics reset successfully'
    });
});

export { router as metricsRoutes };
