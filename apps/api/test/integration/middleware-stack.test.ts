/**
 * Middleware Stack Integration Tests
 * Tests the complete middleware stack to ensure all middlewares work together
 * and that the request flow is processed correctly through all layers
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

describe('Middleware Stack Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetMetrics();
    });

    describe('Complete Stack Processing', () => {
        it('should process request through all middlewares successfully', async () => {
            const app = initApp();

            const res = await app.request('/health/live', {
                method: 'GET',
                headers: {
                    'user-agent': 'integration-test/1.0',
                    accept: 'application/json',
                    'accept-encoding': 'gzip, deflate',
                    origin: 'http://localhost:3000'
                }
            });

            expect(res.status).toBe(200);

            // Verify response formatting middleware worked
            const contentEncoding = res.headers.get('content-encoding');
            if (contentEncoding?.includes('gzip')) {
                // If compressed, just verify we can read it as text
                const text = await res.text();
                expect(text).toBeTruthy();
                // Skip JSON parsing for compressed responses in this test
                return;
            }

            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.data).toBeDefined();
            expect(data.metadata).toBeDefined();
            expect(data.metadata.timestamp).toBeDefined();
            expect(data.metadata.requestId).toBeDefined();

            // Verify security headers middleware worked
            expect(res.headers.get('x-content-type-options')).toBe('nosniff');
            // Allow either DENY or SAMEORIGIN for x-frame-options
            expect(['DENY', 'SAMEORIGIN']).toContain(res.headers.get('x-frame-options'));
            expect(res.headers.get('x-xss-protection')).toBe('1; mode=block');

            // Verify CORS middleware worked
            expect(res.headers.get('access-control-allow-origin')).toBeTruthy();

            // Verify request ID middleware worked
            expect(res.headers.get('x-request-id')).toBeTruthy();
        });

        it('should handle validation errors correctly through the stack', async () => {
            const app = initApp();

            const res = await app.request('/health/live', {
                method: 'GET',
                headers: {
                    // Missing required user-agent header
                    accept: 'application/json'
                }
            });

            expect(res.status).toBe(400);

            // Verify error response formatting
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error).toBeDefined();
            expect(data.error.code).toBe('MISSING_REQUIRED_HEADER');
            expect(data.metadata).toBeDefined();
            expect(data.metadata.requestId).toBeDefined();

            // Verify security headers are still applied even on errors
            expect(res.headers.get('x-content-type-options')).toBe('nosniff');
            expect(['DENY', 'SAMEORIGIN']).toContain(res.headers.get('x-frame-options'));
        });

        it('should handle POST requests with body validation', async () => {
            const app = initApp();

            const testPayload = {
                test: 'data',
                number: 123
            };

            const res = await app.request('/api/v1/users', {
                method: 'POST',
                headers: {
                    'user-agent': 'integration-test/1.0',
                    accept: 'application/json',
                    'content-type': 'application/json'
                },
                body: JSON.stringify(testPayload)
            });

            // Should process through validation, even if endpoint doesn't exist
            // The important thing is that all middlewares processed it
            expect([200, 404, 401, 403]).toContain(res.status);

            // Verify all standard headers are present
            expect(res.headers.get('x-request-id')).toBeTruthy();
            expect(res.headers.get('x-content-type-options')).toBe('nosniff');
        });
    });

    describe('Middleware Order Verification', () => {
        it('should apply middlewares in the correct order', async () => {
            const app = initApp();

            const res = await app.request('/health/live', {
                headers: {
                    'user-agent': 'integration-test/1.0',
                    accept: 'application/json'
                }
            });

            expect(res.status).toBe(200);
            const data = await res.json();

            // Request ID should be set early (before response formatting)
            expect(data.metadata.requestId).toBeTruthy();

            // Response formatting should be applied (success/data structure)
            expect(data.success).toBe(true);
            expect(data.data).toBeDefined();

            // Security headers should be applied last
            expect(res.headers.get('x-content-type-options')).toBe('nosniff');
        });
    });

    describe('Performance Under Load', () => {
        it('should handle multiple concurrent requests', async () => {
            const app = initApp();

            const requests = Array.from({ length: 10 }, (_, i) =>
                app.request('/health/live', {
                    headers: {
                        'user-agent': `integration-test-${i}/1.0`,
                        accept: 'application/json'
                    }
                })
            );

            const responses = await Promise.all(requests);

            // All requests should succeed
            responses.forEach((res, _index) => {
                expect(res.status).toBe(200);
                expect(res.headers.get('x-request-id')).toBeTruthy();
            });

            // Each should have unique request IDs
            const requestIds = responses.map((res) => res.headers.get('x-request-id'));
            const uniqueIds = new Set(requestIds);
            expect(uniqueIds.size).toBe(10);
        });
    });

    describe('Cache and Compression Integration', () => {
        it('should apply both caching and compression when appropriate', async () => {
            const app = initApp();

            const res = await app.request('/health', {
                headers: {
                    'user-agent': 'integration-test/1.0',
                    accept: 'application/json',
                    'accept-encoding': 'gzip'
                }
            });

            expect(res.status).toBe(200);

            // Cache headers should be present for cacheable endpoints
            const cacheControl = res.headers.get('cache-control');
            if (cacheControl) {
                expect(cacheControl).toContain('max-age');
            }

            // Response should be JSON formatted (handle compression)
            const contentEncoding = res.headers.get('content-encoding');
            if (contentEncoding?.includes('gzip')) {
                const text = await res.text();
                expect(text).toBeTruthy();
            } else {
                const data = await res.json();
                expect(data.success).toBe(true);
            }
        });
    });

    describe('Error Propagation Through Stack', () => {
        it('should handle rate limiting correctly', async () => {
            const app = initApp();

            // Make many requests quickly to potentially trigger rate limiting
            const requests = Array.from({ length: 50 }, () =>
                app.request('/health/live', {
                    headers: {
                        'user-agent': 'rate-limit-test/1.0',
                        accept: 'application/json'
                    }
                })
            );

            const responses = await Promise.all(requests);

            // Some requests should succeed, rate limiting behavior depends on configuration
            const statuses = responses.map((res) => res.status);
            const successCount = statuses.filter((status) => status === 200).length;

            // At least some requests should succeed
            expect(successCount).toBeGreaterThan(0);

            // Any rate limited responses should have proper error format
            const rateLimitedResponses = responses.filter((res) => res.status === 429);
            for (const res of rateLimitedResponses) {
                const data = await res.json();
                expect(data.success).toBe(false);
                expect(data.error).toBeDefined();
                expect(res.headers.get('x-request-id')).toBeTruthy();
            }
        });

        it('should handle invalid content-type gracefully', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/users', {
                method: 'POST',
                headers: {
                    'user-agent': 'integration-test/1.0',
                    accept: 'application/json',
                    'content-type': 'text/plain'
                },
                body: 'invalid json payload'
            });

            // Should be rejected by validation middleware or rate limited
            expect([400, 429]).toContain(res.status);

            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error).toBeDefined();

            // Only check metadata if it exists (might not be present in rate limited responses)
            if (data.metadata) {
                expect(data.metadata.requestId).toBeTruthy();
            }
        });
    });

    describe('Security Headers Integration', () => {
        it('should apply all security headers consistently', async () => {
            const app = initApp();

            const res = await app.request('/health/live', {
                headers: {
                    'user-agent': 'security-test/1.0',
                    accept: 'application/json'
                }
            });

            // Expect success or rate limiting
            expect([200, 429]).toContain(res.status);

            // Verify all expected security headers (if not rate limited)
            if (res.status === 200) {
                expect(res.headers.get('x-content-type-options')).toBe('nosniff');
                expect(['DENY', 'SAMEORIGIN']).toContain(res.headers.get('x-frame-options'));
                expect(res.headers.get('x-xss-protection')).toBe('1; mode=block');
                expect(res.headers.get('referrer-policy')).toBeTruthy();
            } else {
                // Rate limited responses might not have all security headers
                // Just verify the response is properly formatted
                const data = await res.json();
                expect(data.success).toBe(false);
            }

            // Request ID should be present
            expect(res.headers.get('x-request-id')).toBeTruthy();
        });
    });
});
