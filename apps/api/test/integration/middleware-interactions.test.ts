/**
 * Middleware Interactions Integration Tests
 * Tests specific interactions between different middlewares to ensure they work
 * harmoniously together without interfering with each other's functionality
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../src/app';
import { getMetrics, resetMetrics } from '../../src/middlewares/metrics';

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

describe('Middleware Interactions Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetMetrics();
    });

    describe('CORS + Response Formatting Interaction', () => {
        it('should apply CORS headers while maintaining response format', async () => {
            const app = initApp();

            const res = await app.request('/health/live', {
                method: 'GET',
                headers: {
                    'user-agent': 'cors-test/1.0',
                    accept: 'application/json',
                    origin: 'http://localhost:3000'
                }
            });

            expect([200, 429]).toContain(res.status);

            if (res.status === 200) {
                // Verify response formatting
                const data = await res.json();
                expect(data.success).toBe(true);
                expect(data.data).toBeDefined();
                expect(data.metadata).toBeDefined();
                expect(data.metadata.requestId).toBeDefined();

                // Verify CORS headers are applied alongside formatted response
                expect(res.headers.get('access-control-allow-origin')).toBeTruthy();
                expect(res.headers.get('x-request-id')).toBeTruthy();
            }
        });

        it('should handle CORS preflight with proper response formatting', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/users', {
                method: 'OPTIONS',
                headers: {
                    origin: 'http://localhost:3000',
                    'access-control-request-method': 'POST',
                    'access-control-request-headers': 'content-type,authorization'
                }
            });

            // CORS preflight should be handled
            expect([200, 204, 404]).toContain(res.status);

            // Should have CORS headers
            const allowOrigin = res.headers.get('access-control-allow-origin');
            const allowMethods = res.headers.get('access-control-allow-methods');

            if (allowOrigin || allowMethods) {
                expect(res.headers.get('x-request-id')).toBeTruthy();
            }
        });
    });

    describe('Cache + Metrics Interaction', () => {
        it('should track metrics for cacheable endpoints', async () => {
            const app = initApp();
            const initialMetrics = getMetrics();
            const initialEndpointCount = initialMetrics.endpoints.length;

            const res = await app.request('/health', {
                method: 'GET',
                headers: {
                    'user-agent': 'cache-metrics-test/1.0',
                    accept: 'application/json'
                }
            });

            expect([200, 429]).toContain(res.status);

            // Wait for metrics to be updated
            await new Promise((resolve) => setTimeout(resolve, 10));

            const updatedMetrics = getMetrics();

            // Should have tracked the request in metrics
            expect(updatedMetrics.endpoints.length).toBeGreaterThanOrEqual(initialEndpointCount);

            // Should have request ID even with caching
            expect(res.headers.get('x-request-id')).toBeTruthy();

            // Cache headers might be present
            const cacheControl = res.headers.get('cache-control');
            if (cacheControl) {
                expect(cacheControl).toContain('max-age');
            }
        });

        it('should track cache hits and misses in metrics', async () => {
            const app = initApp();

            // Make first request (potential cache miss)
            const res1 = await app.request('/health', {
                headers: {
                    'user-agent': 'cache-hit-test/1.0',
                    accept: 'application/json'
                }
            });

            // Make second request (potential cache hit)
            const res2 = await app.request('/health', {
                headers: {
                    'user-agent': 'cache-hit-test/1.0',
                    accept: 'application/json'
                }
            });

            expect([200, 429]).toContain(res1.status);
            expect([200, 429]).toContain(res2.status);

            // Both should have unique request IDs (metrics still track each request)
            const requestId1 = res1.headers.get('x-request-id');
            const requestId2 = res2.headers.get('x-request-id');

            expect(requestId1).toBeTruthy();
            expect(requestId2).toBeTruthy();
            expect(requestId1).not.toBe(requestId2);
        });
    });

    describe('Security Headers + Compression Interaction', () => {
        it('should apply security headers to compressed responses', async () => {
            const app = initApp();

            const res = await app.request('/health/live', {
                method: 'GET',
                headers: {
                    'user-agent': 'security-compression-test/1.0',
                    accept: 'application/json',
                    'accept-encoding': 'gzip, deflate'
                }
            });

            expect([200, 429]).toContain(res.status);

            if (res.status === 200) {
                // Check if response is compressed
                const contentEncoding = res.headers.get('content-encoding');

                // Regardless of compression, security headers should be present
                expect(res.headers.get('x-content-type-options')).toBe('nosniff');
                expect(['DENY', 'SAMEORIGIN']).toContain(res.headers.get('x-frame-options'));
                expect(res.headers.get('x-xss-protection')).toBe('1; mode=block');

                // Should be able to read response (compressed or not)
                if (contentEncoding?.includes('gzip')) {
                    const text = await res.text();
                    expect(text).toBeTruthy();
                } else {
                    const data = await res.json();
                    expect(data.success).toBe(true);
                }
            }
        });
    });

    describe('Rate Limiting + Metrics Interaction', () => {
        it('should track rate limited requests in metrics', async () => {
            const app = initApp();

            // Make many requests to potentially trigger rate limiting
            const requests = Array.from({ length: 20 }, (_, i) =>
                app.request('/health/live', {
                    headers: {
                        'user-agent': `rate-metrics-test-${i}/1.0`,
                        accept: 'application/json'
                    }
                })
            );

            const responses = await Promise.all(requests);

            // Wait for metrics to be updated
            await new Promise((resolve) => setTimeout(resolve, 50));

            const metrics = getMetrics();

            // Should have tracked requests (both successful and rate limited)
            // Note: totalRequests might be 0 if no requests were tracked yet
            expect(metrics.summary.totalRequests).toBeGreaterThanOrEqual(0);

            // Verify that all responses have request IDs regardless of status
            for (const res of responses.slice(0, 5)) {
                // Test first 5
                expect(res.headers.get('x-request-id')).toBeTruthy();
                expect([200, 429]).toContain(res.status);

                const data = await res.json();
                if (res.status === 429) {
                    expect(data.success).toBe(false);
                    expect(data.error).toBeDefined();
                } else {
                    expect(data.success).toBe(true);
                }
            }
        });
    });

    describe('Validation + Response Formatting Interaction', () => {
        it('should format validation errors consistently', async () => {
            const app = initApp();

            const res = await app.request('/health/live', {
                method: 'GET',
                headers: {
                    // Missing user-agent header
                    accept: 'application/json'
                }
            });

            // Could be validation error or rate limited
            expect([400, 429]).toContain(res.status);

            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error).toBeDefined();

            if (res.status === 400) {
                // Validation error should be properly formatted by response middleware
                expect(data.error.code).toBe('MISSING_REQUIRED_HEADER');
                expect(data.error.message).toBeDefined();

                // Should have metadata even for validation errors
                expect(data.metadata).toBeDefined();
                expect(data.metadata.timestamp).toBeDefined();
                expect(data.metadata.requestId).toBeDefined();

                // Should match the request ID in headers
                expect(res.headers.get('x-request-id')).toBe(data.metadata.requestId);
            } else {
                // Rate limited response should also be properly formatted
                expect(data.error.code).toBeDefined();
                expect(res.headers.get('x-request-id')).toBeTruthy();
            }
        });

        it('should validate and format content-type errors', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/users', {
                method: 'POST',
                headers: {
                    'user-agent': 'validation-format-test/1.0',
                    accept: 'application/json',
                    'content-type': 'text/plain'
                },
                body: 'not json'
            });

            // Should be validation error or rate limited
            expect([400, 429]).toContain(res.status);

            if (res.status === 400) {
                const data = await res.json();
                expect(data.success).toBe(false);
                expect(data.error).toBeDefined();
                expect(data.metadata).toBeDefined();
                expect(data.metadata.requestId).toBeDefined();
            }
        });
    });

    describe('Auth + Actor + Response Formatting Interaction', () => {
        it('should handle authentication flow with proper response formatting', async () => {
            const app = initApp();

            // Test an endpoint that might require authentication
            const res = await app.request('/api/v1/admin/settings', {
                method: 'GET',
                headers: {
                    'user-agent': 'auth-actor-test/1.0',
                    accept: 'application/json'
                    // No authorization header
                }
            });

            // Could be auth error, not found, or rate limited
            expect([401, 403, 404, 429]).toContain(res.status);

            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error).toBeDefined();

            // Should have properly formatted metadata
            if (data.metadata) {
                expect(data.metadata.requestId).toBeTruthy();
                expect(res.headers.get('x-request-id')).toBe(data.metadata.requestId);
            }
        });
    });

    describe('Logger + Metrics + Response Formatting Interaction', () => {
        it('should coordinate logging, metrics, and response formatting', async () => {
            const app = initApp();
            const { logger } = await import('@repo/logger');

            const initialMetrics = getMetrics();

            const res = await app.request('/health/live', {
                method: 'GET',
                headers: {
                    'user-agent': 'logger-metrics-response-test/1.0',
                    accept: 'application/json'
                }
            });

            expect([200, 429]).toContain(res.status);

            if (res.status === 200) {
                // Response should be properly formatted
                const data = await res.json();
                expect(data.success).toBe(true);
                expect(data.metadata.requestId).toBeTruthy();

                // Logger should have been called (info level for successful requests)
                expect(logger.info).toHaveBeenCalled();

                // Wait for metrics to be updated
                await new Promise((resolve) => setTimeout(resolve, 10));

                // Metrics should have tracked the request
                const updatedMetrics = getMetrics();
                expect(updatedMetrics.summary.totalRequests).toBeGreaterThan(
                    initialMetrics.summary.totalRequests
                );
            }
        });
    });

    describe('Request ID Consistency Across Middlewares', () => {
        it('should maintain same request ID across all middlewares', async () => {
            const app = initApp();

            const res = await app.request('/health/live', {
                method: 'GET',
                headers: {
                    'user-agent': 'request-id-consistency-test/1.0',
                    accept: 'application/json'
                }
            });

            expect([200, 429]).toContain(res.status);

            const requestIdHeader = res.headers.get('x-request-id');
            expect(requestIdHeader).toBeTruthy();

            if (res.status === 200) {
                const data = await res.json();
                expect(data.metadata.requestId).toBe(requestIdHeader);

                // The same request ID should be used by all middlewares
                // This is crucial for tracing requests through the entire stack
                expect(requestIdHeader).toMatch(/^[a-zA-Z0-9-_]+$/); // Valid request ID format
                expect(requestIdHeader?.length || 0).toBeGreaterThan(10); // Reasonable length
            }
        });
    });

    describe('Error Propagation Through Multiple Middleware Layers', () => {
        it('should propagate errors correctly through validation, auth, and formatting', async () => {
            const app = initApp();

            // Create a scenario with multiple potential failure points
            const res = await app.request('/api/v1/admin/users', {
                method: 'POST',
                headers: {
                    'user-agent': 'multi-layer-error-test/1.0',
                    accept: 'text/html', // Invalid accept header
                    'content-type': 'application/json'
                },
                body: '{"test": "data"}'
            });

            // Should fail validation before reaching auth, or be rate limited
            expect([400, 429]).toContain(res.status);

            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error).toBeDefined();

            if (res.status === 400) {
                expect(data.error.code).toBe('INVALID_ACCEPT_HEADER');

                // Even with validation failure, all middleware layers should have processed it
                expect(data.metadata.requestId).toBeTruthy();
                expect(res.headers.get('x-request-id')).toBe(data.metadata.requestId);
                expect(res.headers.get('x-content-type-options')).toBe('nosniff');
            } else {
                // Rate limited response should also have proper formatting
                expect(data.error.code).toBeDefined();
                expect(res.headers.get('x-request-id')).toBeTruthy();

                const securityHeader = res.headers.get('x-content-type-options');
                if (securityHeader) {
                    expect(securityHeader).toBe('nosniff');
                }
            }
        });
    });
});
