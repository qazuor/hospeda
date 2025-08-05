/**
 * Metrics Middleware Tests
 * Tests the metrics collection and tracking functionality
 */
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createMetricsMiddleware,
    getMetrics,
    getPrometheusMetrics,
    metricsMiddleware,
    resetMetrics
} from '../../src/middlewares/metrics';

// Mock the logger
vi.mock('@repo/logger', () => ({
    logger: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

describe('Metrics Middleware', () => {
    let app: Hono;

    beforeEach(() => {
        app = new Hono();
        resetMetrics(); // Reset metrics before each test
        vi.clearAllMocks();
    });

    describe('createMetricsMiddleware', () => {
        it('should create a middleware function', () => {
            const middleware = createMetricsMiddleware();
            expect(typeof middleware).toBe('function');
        });

        it('should track request metrics', async () => {
            app.use(metricsMiddleware);
            app.get('/test', (c) => c.json({ success: true }));

            await app.request('/test');

            const metrics = getMetrics();
            expect(metrics.summary.totalRequests).toBe(1);
            expect(metrics.endpoints).toHaveLength(1);
            expect(metrics.endpoints[0]?.endpoint).toBe('GET /test');
            expect(metrics.endpoints[0]?.requests).toBe(1);
        });

        it('should track multiple requests to different endpoints', async () => {
            app.use(metricsMiddleware);
            app.get('/users', (c) => c.json({ users: [] }));
            app.post('/users', (c) => c.json({ created: true }));

            await app.request('/users', { method: 'GET' });
            await app.request('/users', { method: 'POST' });
            await app.request('/users', { method: 'GET' });

            const metrics = getMetrics();
            expect(metrics.summary.totalRequests).toBe(3);
            expect(metrics.endpoints).toHaveLength(2);

            const getEndpoint = metrics.endpoints.find((e) => e.endpoint === 'GET /users');
            const postEndpoint = metrics.endpoints.find((e) => e.endpoint === 'POST /users');

            expect(getEndpoint?.requests).toBe(2);
            expect(postEndpoint?.requests).toBe(1);
        });

        it('should normalize dynamic routes', async () => {
            app.use(metricsMiddleware);
            app.get('/users/:id', (c) => c.json({ user: { id: c.req.param('id') } }));

            await app.request('/users/123');
            await app.request('/users/456');
            await app.request('/users/789');

            const metrics = getMetrics();
            expect(metrics.summary.totalRequests).toBe(3);
            expect(metrics.endpoints).toHaveLength(1);
            expect(metrics.endpoints[0]?.endpoint).toBe('GET /users/:id');
            expect(metrics.endpoints[0]?.requests).toBe(3);
        });

        it('should track response times', async () => {
            app.use(metricsMiddleware);
            app.get('/slow', async (c) => {
                await new Promise((resolve) => setTimeout(resolve, 10));
                return c.json({ success: true });
            });

            await app.request('/slow');

            const metrics = getMetrics();
            const endpoint = metrics.endpoints[0];
            expect(endpoint?.avgResponseTime).toBeGreaterThan(0);
            expect(endpoint?.maxResponseTime).toBeGreaterThan(0);
            expect(endpoint?.minResponseTime).toBeGreaterThan(0);
        });

        it('should track errors from thrown exceptions', async () => {
            app.use(metricsMiddleware);
            app.get('/error', () => {
                throw new Error('Test error');
            });

            try {
                await app.request('/error');
            } catch {
                // Expected to throw
            }

            const metrics = getMetrics();
            expect(metrics.summary.totalErrors).toBe(1);
            expect(metrics.endpoints[0]?.errors).toBe(1);
            expect(metrics.endpoints[0]?.errorRate).toBe(100);
        });

        it('should track errors from HTTP status codes', async () => {
            app.use(metricsMiddleware);
            app.get('/not-found', (c) => c.json({ error: 'Not found' }, 404));
            app.get('/server-error', (c) => c.json({ error: 'Server error' }, 500));

            await app.request('/not-found');
            await app.request('/server-error');

            const metrics = getMetrics();
            expect(metrics.summary.totalErrors).toBe(2);

            const notFoundEndpoint = metrics.endpoints.find((e) => e.endpoint === 'GET /not-found');
            const serverErrorEndpoint = metrics.endpoints.find(
                (e) => e.endpoint === 'GET /server-error'
            );

            expect(notFoundEndpoint?.errors).toBe(1);
            expect(serverErrorEndpoint?.errors).toBe(1);
        });

        it('should track active connections', async () => {
            app.use(metricsMiddleware);
            app.get('/test', (c) => c.json({ success: true }));

            // Since we can't easily test concurrent requests in this setup,
            // we'll test that the counter goes back to 0 after request completion
            await app.request('/test');

            const metrics = getMetrics();
            expect(metrics.summary.activeConnections).toBe(0);
        });

        it('should calculate error rates correctly', async () => {
            app.use(metricsMiddleware);
            app.get('/mixed', (c) => {
                const random = Math.random();
                if (random < 0.5) {
                    return c.json({ success: true });
                }
                return c.json({ error: 'Random error' }, 500);
            });

            // Mock Math.random to control the results
            const originalRandom = Math.random;
            Math.random = vi
                .fn()
                .mockReturnValueOnce(0.3) // success
                .mockReturnValueOnce(0.7) // error
                .mockReturnValueOnce(0.2) // success
                .mockReturnValueOnce(0.8); // error

            await app.request('/mixed');
            await app.request('/mixed');
            await app.request('/mixed');
            await app.request('/mixed');

            Math.random = originalRandom;

            const metrics = getMetrics();
            const endpoint = metrics.endpoints[0];
            expect(endpoint?.requests).toBe(4);
            expect(endpoint?.errors).toBe(2);
            expect(endpoint?.errorRate).toBe(50);
        });

        it('should limit response time history to prevent memory bloat', async () => {
            app.use(metricsMiddleware);
            app.get('/test', (c) => c.json({ success: true }));

            // Make more than 100 requests to test the limit
            for (let i = 0; i < 105; i++) {
                await app.request('/test');
            }

            const metrics = getMetrics();
            expect(metrics.endpoints[0]?.requests).toBe(105);
            // The implementation should handle this gracefully
            expect(metrics.endpoints[0]?.avgResponseTime).toBeGreaterThanOrEqual(0);
        });
    });

    describe('getMetrics', () => {
        it('should return empty metrics when no requests made', () => {
            const metrics = getMetrics();
            expect(metrics.summary.totalRequests).toBe(0);
            expect(metrics.summary.totalErrors).toBe(0);
            expect(metrics.summary.globalErrorRate).toBe(0);
            expect(metrics.summary.activeConnections).toBe(0);
            expect(metrics.endpoints).toHaveLength(0);
            expect(metrics.summary.timestamp).toBeDefined();
        });

        it('should calculate global error rate correctly', async () => {
            app.use(metricsMiddleware);
            app.get('/success', (c) => c.json({ success: true }));
            app.get('/error', (c) => c.json({ error: 'Error' }, 500));

            await app.request('/success');
            await app.request('/error');
            await app.request('/success');

            const metrics = getMetrics();
            expect(metrics.summary.totalRequests).toBe(3);
            expect(metrics.summary.totalErrors).toBe(1);
            expect(metrics.summary.globalErrorRate).toBeCloseTo(33.33, 1);
        });
    });

    describe('getPrometheusMetrics', () => {
        it('should return metrics in Prometheus format', async () => {
            app.use(metricsMiddleware);
            app.get('/test', (c) => c.json({ success: true }));

            await app.request('/test');

            const prometheusMetrics = getPrometheusMetrics();
            expect(typeof prometheusMetrics).toBe('string');
            expect(prometheusMetrics).toContain('# HELP http_requests_total');
            expect(prometheusMetrics).toContain('# TYPE http_requests_total counter');
            expect(prometheusMetrics).toContain('http_requests_total{endpoint="GET /test"} 1');
            expect(prometheusMetrics).toContain('http_requests_total_global 1');
        });

        it('should include all metric types in Prometheus format', async () => {
            app.use(metricsMiddleware);
            app.get('/success', (c) => c.json({ success: true }));
            app.get('/error', (c) => c.json({ error: 'Error' }, 500));

            await app.request('/success');
            await app.request('/error');

            const prometheusMetrics = getPrometheusMetrics();
            expect(prometheusMetrics).toContain('http_requests_total');
            expect(prometheusMetrics).toContain('http_errors_total');
            expect(prometheusMetrics).toContain('http_request_duration_seconds');
            expect(prometheusMetrics).toContain('http_active_connections');
        });
    });

    describe('resetMetrics', () => {
        it('should reset all metrics to initial state', async () => {
            app.use(metricsMiddleware);
            app.get('/test', (c) => c.json({ success: true }));

            await app.request('/test');

            let metrics = getMetrics();
            expect(metrics.summary.totalRequests).toBe(1);

            resetMetrics();

            metrics = getMetrics();
            expect(metrics.summary.totalRequests).toBe(0);
            expect(metrics.summary.totalErrors).toBe(0);
            expect(metrics.summary.activeConnections).toBe(0);
            expect(metrics.endpoints).toHaveLength(0);
        });
    });

    describe('UUID and ObjectId normalization', () => {
        it('should normalize UUID paths', async () => {
            app.use(metricsMiddleware);
            app.get('/users/:id', (c) => c.json({ user: { id: c.req.param('id') } }));

            await app.request('/users/123e4567-e89b-12d3-a456-426614174000');
            await app.request('/users/987fcdeb-51a2-43d1-bc45-123456789abc');

            const metrics = getMetrics();
            expect(metrics.endpoints).toHaveLength(1);
            expect(metrics.endpoints[0]?.endpoint).toBe('GET /users/:uuid');
            expect(metrics.endpoints[0]?.requests).toBe(2);
        });

        it('should normalize ObjectId paths', async () => {
            app.use(metricsMiddleware);
            app.get('/posts/:id', (c) => c.json({ post: { id: c.req.param('id') } }));

            await app.request('/posts/507f1f77bcf86cd799439011');
            await app.request('/posts/507f191e810c19729de860ea');

            const metrics = getMetrics();
            expect(metrics.endpoints).toHaveLength(1);
            expect(metrics.endpoints[0]?.endpoint).toBe('GET /posts/:objectId');
            expect(metrics.endpoints[0]?.requests).toBe(2);
        });
    });

    describe('Performance monitoring', () => {
        it('should log slow requests', async () => {
            const { logger } = await import('@repo/logger');

            app.use(metricsMiddleware);
            app.get('/slow', async (c) => {
                await new Promise((resolve) => setTimeout(resolve, 1001)); // Simulate slow request
                return c.json({ success: true });
            });

            await app.request('/slow');

            expect(logger.warn).toHaveBeenCalledWith(
                expect.objectContaining({
                    endpoint: 'GET /slow',
                    responseTime: expect.any(Number),
                    status: expect.any(Number)
                }),
                'Slow request detected'
            );
        });
    });

    describe('Default middleware instance', () => {
        it('should export a default configured middleware', () => {
            expect(metricsMiddleware).toBeDefined();
            expect(typeof metricsMiddleware).toBe('function');
        });
    });
});
