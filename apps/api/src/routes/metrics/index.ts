/**
 * Metrics routes
 * Endpoints for exposing application metrics
 */
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import {
    getApiMetrics,
    getMetrics,
    getPrometheusMetrics,
    getSystemMetrics,
    resetMetrics
} from '../../middlewares/metrics';
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

// Get all metrics endpoint
const getMetricsRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Metrics'],
    summary: 'Get all application metrics',
    description: 'Returns comprehensive metrics about all API endpoints performance',
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

// Get API metrics endpoint
const getApiMetricsRoute = createRoute({
    method: 'get',
    path: '/api',
    tags: ['Metrics'],
    summary: 'Get API endpoints metrics',
    description:
        'Returns metrics only for public/admin API endpoints (users, accommodations, etc.)',
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
            description: 'API metrics data retrieved successfully'
        }
    }
});

// Get system metrics endpoint
const getSystemMetricsRoute = createRoute({
    method: 'get',
    path: '/system',
    tags: ['Metrics'],
    summary: 'Get system endpoints metrics',
    description: 'Returns metrics only for system endpoints (health, docs, metrics)',
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
            description: 'System metrics data retrieved successfully'
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

router.openapi(getApiMetricsRoute, (c) => {
    const metrics = getApiMetrics();
    return c.json({
        success: true,
        data: metrics
    });
});

router.openapi(getSystemMetricsRoute, (c) => {
    const metrics = getSystemMetrics();
    return c.json({
        success: true,
        data: metrics
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
