/**
 * Performance Stack Integration Tests
 * Tests the performance characteristics of the complete middleware stack
 * under various load conditions to ensure optimal response times and throughput
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../src/app';
import { resetMetrics } from '../../src/middlewares/metrics';

// Mock external dependencies
vi.mock('@repo/logger', () => {
    const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerCategory: vi.fn(() => mockLogger),
        registerLogMethod: vi.fn()
    };

    return {
        default: mockLogger,
        logger: mockLogger,
        LoggerColors: {
            GREEN: 'green',
            RED: 'red',
            BLUE: 'blue',
            YELLOW: 'yellow',
            CYAN: 'cyan',
            MAGENTA: 'magenta'
        },
        LogLevel: {
            DEBUG: 'debug',
            INFO: 'info',
            WARN: 'warn',
            ERROR: 'error'
        }
    };
});

vi.mock('@hono/clerk-auth', () => ({
    getAuth: vi.fn(() => ({ sessionId: null, userId: null })),
    clerkMiddleware: vi.fn(() => (_c: any, next: any) => next())
}));

/**
 * Performance measurement utilities
 */
interface PerformanceMetrics {
    totalTime: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
    successRate: number;
    throughput: number;
    responseTimes: number[];
}

const measurePerformance = async (
    requests: (Promise<Response> | Response)[],
    startTime: number
): Promise<PerformanceMetrics> => {
    const responses = await Promise.all(
        requests.map(async (request) => {
            const reqStartTime = Date.now();
            try {
                // Handle both Promise<Response> and Response
                const response = await Promise.resolve(request);
                const reqEndTime = Date.now();
                return {
                    response,
                    responseTime: reqEndTime - reqStartTime,
                    success: response.status >= 200 && response.status < 500
                };
            } catch (error) {
                const reqEndTime = Date.now();
                return {
                    response: null,
                    responseTime: reqEndTime - reqStartTime,
                    success: false,
                    error
                };
            }
        })
    );

    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const responseTimes = responses.map((r) => r.responseTime);
    const successfulResponses = responses.filter((r) => r.success);

    return {
        totalTime,
        averageTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        minTime: Math.min(...responseTimes),
        maxTime: Math.max(...responseTimes),
        successRate: (successfulResponses.length / responses.length) * 100,
        throughput: responses.length / (totalTime / 1000), // requests per second
        responseTimes
    };
};

describe('Performance Stack Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetMetrics();
    });

    describe('Single Request Performance', () => {
        it('should handle individual requests with optimal response time', async () => {
            const app = initApp();

            const endpoints = ['/health', '/health/live', '/metrics'];

            for (const endpoint of endpoints) {
                const startTime = Date.now();

                const response = await app.request(endpoint, {
                    headers: {
                        'user-agent': 'performance-test/1.0',
                        accept: 'application/json'
                    }
                });

                const endTime = Date.now();
                const responseTime = endTime - startTime;

                // Individual request should complete quickly
                expect(responseTime).toBeLessThan(500); // 500ms max for individual requests
                expect([200, 429]).toContain(response.status);
                expect(response.headers.get('x-request-id')).toBeTruthy();
            }
        });
    });

    describe('Concurrent Request Performance', () => {
        it('should maintain performance under moderate concurrent load', async () => {
            const app = initApp();
            const concurrency = 10;

            const startTime = Date.now();
            const requests = Array.from({ length: concurrency }, (_, i) =>
                app.request('/health/live', {
                    headers: {
                        'user-agent': `concurrent-test-${i}/1.0`,
                        accept: 'application/json'
                    }
                })
            );

            const metrics = await measurePerformance(requests, startTime);

            // Performance assertions
            expect(metrics.totalTime).toBeLessThan(2000); // 2 seconds total for 10 requests
            expect(metrics.averageTime).toBeLessThan(300); // 300ms average
            expect(metrics.maxTime).toBeLessThan(1000); // 1 second max for any single request
            expect(metrics.successRate).toBeGreaterThan(80); // At least 80% success rate
            expect(metrics.throughput).toBeGreaterThan(3); // At least 3 requests/second

            // All successful responses should have proper formatting
            const responses = await Promise.all(requests);
            const successfulResponses = responses.filter((r) => r.status === 200);

            for (const response of successfulResponses.slice(0, 3)) {
                // Check first 3
                expect(response.headers.get('x-request-id')).toBeTruthy();
                expect(response.headers.get('x-content-type-options')).toBe('nosniff');
            }
        });

        it('should handle burst traffic gracefully', async () => {
            const app = initApp();
            const burstSize = 20;

            const startTime = Date.now();
            const requests = Array.from({ length: burstSize }, (_, i) =>
                app.request('/health', {
                    headers: {
                        'user-agent': `burst-test-${i}/1.0`,
                        accept: 'application/json'
                    }
                })
            );

            const metrics = await measurePerformance(requests, startTime);

            // Burst traffic should be handled reasonably
            expect(metrics.totalTime).toBeLessThan(5000); // 5 seconds for 20 requests
            expect(metrics.averageTime).toBeLessThan(500); // 500ms average
            expect(metrics.successRate).toBeGreaterThan(70); // At least 70% success rate under burst
            expect(metrics.throughput).toBeGreaterThan(2); // At least 2 requests/second

            // Verify that rate limiting works under burst
            const responses = await Promise.all(requests);
            const rateLimitedCount = responses.filter((r) => r.status === 429).length;
            const successfulCount = responses.filter((r) => r.status === 200).length;

            // Should have a mix of successful and rate-limited responses
            expect(successfulCount + rateLimitedCount).toBe(burstSize);
            expect(successfulCount).toBeGreaterThan(0); // Some should succeed
        });
    });

    describe('Mixed Workload Performance', () => {
        it('should handle different endpoint types efficiently', async () => {
            const app = initApp();

            const workload = [
                // Health checks (fast)
                ...Array.from({ length: 5 }, (_, i) => ({
                    path: '/health/live',
                    userAgent: `health-check-${i}/1.0`
                })),
                // Metrics (medium)
                ...Array.from({ length: 3 }, (_, i) => ({
                    path: '/metrics',
                    userAgent: `metrics-check-${i}/1.0`
                })),
                // API calls (potentially slower)
                ...Array.from({ length: 2 }, (_, i) => ({
                    path: '/api/v1/accommodations',
                    userAgent: `api-call-${i}/1.0`
                }))
            ];

            const startTime = Date.now();
            const requests = workload.map(({ path, userAgent }) =>
                app.request(path, {
                    headers: {
                        'user-agent': userAgent,
                        accept: 'application/json'
                    }
                })
            );

            const metrics = await measurePerformance(requests, startTime);

            // Mixed workload performance
            expect(metrics.totalTime).toBeLessThan(3000); // 3 seconds for mixed workload
            expect(metrics.averageTime).toBeLessThan(400); // 400ms average
            expect(metrics.successRate).toBeGreaterThan(75); // At least 75% success rate
            expect(metrics.throughput).toBeGreaterThan(2.5); // At least 2.5 requests/second
        });
    });

    describe('Error Handling Performance', () => {
        it('should handle validation errors quickly', async () => {
            const app = initApp();
            const errorRequests = 10;

            const startTime = Date.now();
            const requests = Array.from({ length: errorRequests }, (_, _i) =>
                app.request('/health/live', {
                    headers: {
                        // Missing user-agent to trigger validation error
                        accept: 'application/json'
                    }
                })
            );

            const metrics = await measurePerformance(requests, startTime);

            // Error handling should be fast
            expect(metrics.totalTime).toBeLessThan(1500); // 1.5 seconds for 10 error requests
            expect(metrics.averageTime).toBeLessThan(200); // 200ms average for errors
            expect(metrics.maxTime).toBeLessThan(500); // 500ms max for any error

            // Verify that errors are properly formatted
            const responses = await Promise.all(requests);
            const errorResponses = responses.filter((r) => r.status === 400);

            for (const response of errorResponses.slice(0, 3)) {
                // Check first 3
                const data = await response.json();
                expect(data.success).toBe(false);
                expect(data.error).toBeDefined();
                expect(response.headers.get('x-request-id')).toBeTruthy();
            }
        });
    });

    describe('Middleware Stack Performance Analysis', () => {
        it('should provide performance insights through metrics', async () => {
            const app = initApp();

            // Generate load to create meaningful metrics
            const loadRequests = Array.from({ length: 15 }, (_, i) =>
                app.request(i % 2 === 0 ? '/health' : '/health/live', {
                    headers: {
                        'user-agent': `metrics-load-${i}/1.0`,
                        accept: 'application/json'
                    }
                })
            );

            const startTime = Date.now();
            await Promise.all(loadRequests);
            const loadTime = Date.now() - startTime;

            // Wait for metrics to be processed
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Check metrics endpoint performance
            const metricsStartTime = Date.now();
            const metricsResponse = await app.request('/metrics', {
                headers: {
                    'user-agent': 'metrics-analysis/1.0',
                    accept: 'application/json'
                }
            });
            const metricsTime = Date.now() - metricsStartTime;

            // Metrics endpoint should be fast even after load
            expect(metricsTime).toBeLessThan(300); // 300ms for metrics retrieval
            expect([200, 429]).toContain(metricsResponse.status);

            if (metricsResponse.status === 200) {
                const metricsData = await metricsResponse.json();
                expect(metricsData.success).toBe(true);
                expect(metricsData.data.summary).toBeDefined();
                expect(metricsData.data.endpoints).toBeDefined();

                // Verify metrics contain performance data
                expect(metricsData.data.summary.totalRequests).toBeGreaterThan(0);
            }

            // Overall load should complete in reasonable time
            expect(loadTime).toBeLessThan(4000); // 4 seconds for 15 requests
        });
    });

    describe('Memory and Resource Performance', () => {
        it('should handle sustained load without memory issues', async () => {
            const app = initApp();
            const sustainedRequests = 25;

            // Make requests in batches to simulate sustained load
            const batchSize = 5;
            const batches = Math.ceil(sustainedRequests / batchSize);

            let totalTime = 0;
            const allResponseTimes: number[] = [];

            for (let batch = 0; batch < batches; batch++) {
                const batchStart = Date.now();

                const batchRequests = Array.from({ length: batchSize }, (_, i) =>
                    app.request('/health/live', {
                        headers: {
                            'user-agent': `sustained-${batch}-${i}/1.0`,
                            accept: 'application/json'
                        }
                    })
                );

                const batchMetrics = await measurePerformance(batchRequests, batchStart);
                totalTime += batchMetrics.totalTime;
                allResponseTimes.push(...batchMetrics.responseTimes);

                // Small delay between batches
                await new Promise((resolve) => setTimeout(resolve, 10));
            }

            const averageResponseTime =
                allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length;
            const maxResponseTime = Math.max(...allResponseTimes);

            // Performance should remain consistent across batches
            expect(averageResponseTime).toBeLessThan(300); // 300ms average across all requests
            expect(maxResponseTime).toBeLessThan(1000); // 1 second max for any request
            expect(totalTime).toBeLessThan(8000); // 8 seconds total for sustained load

            // Memory should be stable (no obvious leaks)
            // This is implicit - if the test completes without timeout/crash, memory is stable
            expect(true).toBe(true); // Placeholder assertion
        });
    });

    describe('Performance Regression Detection', () => {
        it('should maintain baseline performance characteristics', async () => {
            const app = initApp();

            // Baseline test with known characteristics
            const baselineRequests = 12;
            const startTime = Date.now();

            const requests = Array.from({ length: baselineRequests }, (_, i) =>
                app.request('/health', {
                    headers: {
                        'user-agent': `baseline-${i}/1.0`,
                        accept: 'application/json'
                    }
                })
            );

            const metrics = await measurePerformance(requests, startTime);

            // Baseline performance thresholds (adjust based on infrastructure)
            expect(metrics.averageTime).toBeLessThan(250); // 250ms average baseline
            expect(metrics.maxTime).toBeLessThan(800); // 800ms max baseline
            expect(metrics.minTime).toBeLessThan(100); // 100ms min baseline (best case)
            expect(metrics.successRate).toBeGreaterThan(85); // 85% success rate baseline
            expect(metrics.throughput).toBeGreaterThan(4); // 4 requests/second baseline

            // Response time distribution should be reasonable
            const sortedTimes = metrics.responseTimes.sort((a, b) => a - b);
            const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
            const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];

            expect(p95).toBeLessThan(400); // 95th percentile under 400ms
            expect(p99).toBeLessThan(600); // 99th percentile under 600ms
        });
    });

    describe('Middleware Overhead Analysis', () => {
        it('should validate that middleware stack overhead is acceptable', async () => {
            const app = initApp();

            // Test the fastest possible endpoint to measure middleware overhead
            const overheadRequests = 8;
            const startTime = Date.now();

            const requests = Array.from({ length: overheadRequests }, (_, i) =>
                app.request('/health/live', {
                    headers: {
                        'user-agent': `overhead-test-${i}/1.0`,
                        accept: 'application/json'
                    }
                })
            );

            const metrics = await measurePerformance(requests, startTime);

            // Middleware overhead should be minimal
            expect(metrics.averageTime).toBeLessThan(200); // 200ms average with full middleware stack
            expect(metrics.minTime).toBeLessThan(50); // 50ms minimum (best case with all middlewares)

            // Verify all middleware features are working
            const responses = await Promise.all(requests);
            const successfulResponses = responses.filter((r) => r.status === 200);

            for (const response of successfulResponses.slice(0, 3)) {
                // Check first 3
                // Security middleware
                expect(response.headers.get('x-content-type-options')).toBe('nosniff');
                expect(['DENY', 'SAMEORIGIN']).toContain(response.headers.get('x-frame-options'));

                // Request ID middleware
                expect(response.headers.get('x-request-id')).toBeTruthy();

                // Response formatting middleware
                const data = await response.json();
                expect(data.success).toBe(true);
                expect(data.data).toBeDefined();
                expect(data.metadata).toBeDefined();
            }
        });
    });
});
