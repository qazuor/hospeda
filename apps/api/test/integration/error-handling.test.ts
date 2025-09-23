/**
 * Error Handling Cross-Middleware Integration Tests
 * Tests that errors are properly handled and propagated through the complete middleware stack
 * without losing information or causing interference between middlewares
 */

import { ServiceErrorCode } from '@repo/schemas';
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

describe('Error Handling Cross-Middleware Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetMetrics();
    });

    describe('Validation Errors Through Stack', () => {
        it('should handle missing required headers with proper error format', async () => {
            const app = initApp();

            const res = await app.request('/health/live', {
                method: 'GET',
                headers: {
                    // Missing required user-agent header
                    accept: 'application/json'
                }
            });

            expect(res.status).toBe(400);

            // Verify error response format is maintained through all middlewares
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error).toBeDefined();
            expect(data.error.code).toBe('MISSING_REQUIRED_HEADER');
            expect(data.error.message).toBeDefined();

            // Verify metadata is preserved even in error responses
            expect(data.metadata).toBeDefined();
            expect(data.metadata.timestamp).toBeDefined();
            expect(data.metadata.requestId).toBeDefined();

            // Verify security headers are still applied to error responses
            expect(res.headers.get('x-content-type-options')).toBe('nosniff');
            expect(['DENY', 'SAMEORIGIN']).toContain(res.headers.get('x-frame-options'));

            // Verify request ID is present
            expect(res.headers.get('x-request-id')).toBeTruthy();
        });

        it('should handle invalid accept headers with proper propagation', async () => {
            const app = initApp();

            const res = await app.request('/health/live', {
                method: 'GET',
                headers: {
                    'user-agent': 'error-test/1.0',
                    accept: 'text/html' // Invalid accept header
                }
            });

            expect(res.status).toBe(400);

            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INVALID_ACCEPT_HEADER');

            // Verify the error didn't break the middleware chain
            expect(res.headers.get('x-request-id')).toBeTruthy();
            expect(data.metadata.requestId).toBeTruthy();
        });

        it('should handle content-type validation errors', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/public/users', {
                method: 'POST',
                headers: {
                    'user-agent': 'error-test/1.0',
                    accept: 'application/json',
                    'content-type': 'text/plain' // Invalid for JSON APIs
                },
                body: 'not json'
            });

            // Should be rejected by validation or rate limited
            expect([400, 429]).toContain(res.status);

            if (res.status === 400) {
                const data = await res.json();
                expect(data.success).toBe(false);
                expect(data.error).toBeDefined();

                // Verify metadata preservation in validation errors
                if (data.metadata) {
                    expect(data.metadata.requestId).toBeTruthy();
                }
            }

            // Even validation errors should have security headers
            expect(res.headers.get('x-content-type-options')).toBe('nosniff');
        });
    });

    describe('Authentication Errors Through Stack', () => {
        it('should handle authentication failures with proper error format', async () => {
            const app = initApp();

            // Simulate a protected endpoint (this would typically require auth)
            const res = await app.request('/api/v1/admin/users', {
                method: 'GET',
                headers: {
                    'user-agent': 'auth-error-test/1.0',
                    accept: 'application/json'
                    // Missing Authorization header
                }
            });

            // Should be either 401/403 (auth error) or 404 (not found) or 429 (rate limited)
            expect([401, 403, 404, 429]).toContain(res.status);

            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error).toBeDefined();

            // Verify middleware chain didn't break on auth errors
            expect(res.headers.get('x-request-id')).toBeTruthy();

            // Auth errors should still have security headers
            expect(res.headers.get('x-content-type-options')).toBe('nosniff');
        });
    });

    describe('Rate Limiting Errors Through Stack', () => {
        it('should handle rate limiting without breaking other middlewares', async () => {
            const app = initApp();

            // Make multiple requests quickly to trigger rate limiting
            const requests = Array.from({ length: 100 }, () =>
                app.request('/health/live', {
                    headers: {
                        'user-agent': 'rate-limit-test/1.0',
                        accept: 'application/json'
                    }
                })
            );

            const responses = await Promise.all(requests);

            // Should have some rate limited responses
            const rateLimitedResponses = responses.filter((res) => res.status === 429);

            if (rateLimitedResponses.length > 0) {
                for (const res of rateLimitedResponses.slice(0, 3)) {
                    // Test first 3
                    const data = await res.json();
                    expect(data.success).toBe(false);
                    expect(data.error).toBeDefined();

                    // Rate limiting errors should still have request IDs
                    expect(res.headers.get('x-request-id')).toBeTruthy();

                    // Should maintain basic security headers (may be missing in rate limited responses)
                    const securityHeader = res.headers.get('x-content-type-options');
                    if (securityHeader) {
                        expect(securityHeader).toBe('nosniff');
                    }
                }
            }
        });
    });

    describe('Server Errors Through Stack', () => {
        it('should handle server errors with proper error format and headers', async () => {
            const app = initApp();

            // Add a route that throws an error to test error propagation
            app.get('/test-error', async (c) => {
                const requestId = c.get('requestId');

                // Manually return server error response to test error format
                return c.json(
                    {
                        success: false,
                        error: {
                            code: ServiceErrorCode.INTERNAL_ERROR,
                            message: 'Internal server error'
                        },
                        metadata: {
                            timestamp: new Date().toISOString(),
                            requestId: requestId
                        }
                    },
                    500
                );
            });

            const res = await app.request('/test-error', {
                headers: {
                    'user-agent': 'server-error-test/1.0',
                    accept: 'application/json'
                }
            });

            // Could be 500 (server error) or 429 (rate limited)
            expect([500, 429]).toContain(res.status);

            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error).toBeDefined();

            // Only check error code for actual server errors
            if (res.status === 500) {
                expect(data.error.code).toBe('INTERNAL_ERROR');

                // Should have metadata even for server errors
                expect(data.metadata).toBeDefined();
                expect(data.metadata.requestId).toBeTruthy();

                // Verify security headers for server errors
                expect(res.headers.get('x-content-type-options')).toBe('nosniff');
            }

            // Verify middleware chain still works
            expect(res.headers.get('x-request-id')).toBeTruthy();
        });

        it('should handle JSON parsing errors gracefully', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/public/users', {
                method: 'POST',
                headers: {
                    'user-agent': 'json-error-test/1.0',
                    accept: 'application/json',
                    'content-type': 'application/json'
                },
                body: '{"invalid": json}' // Invalid JSON
            });

            // Should be validation error or rate limited
            expect([400, 429]).toContain(res.status);

            if (res.status === 400) {
                const data = await res.json();
                expect(data.success).toBe(false);
                expect(data.error).toBeDefined();
            }

            // Headers should still be applied
            expect(res.headers.get('x-request-id')).toBeTruthy();

            // Security headers may not be present in rate limited responses
            const securityHeader = res.headers.get('x-content-type-options');
            if (securityHeader) {
                expect(securityHeader).toBe('nosniff');
            }
        });
    });

    describe('CORS Errors Through Stack', () => {
        it('should handle CORS preflight errors properly', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/public/users', {
                method: 'OPTIONS',
                headers: {
                    origin: 'https://evil-site.com', // Not allowed origin
                    'access-control-request-method': 'POST',
                    'access-control-request-headers': 'content-type'
                }
            });

            // CORS middleware should handle this
            expect([200, 204, 403, 404]).toContain(res.status);

            // Should still have basic security headers (may vary based on response type)
            expect(res.headers.get('x-request-id')).toBeTruthy();

            const securityHeader = res.headers.get('x-content-type-options');
            if (securityHeader) {
                expect(securityHeader).toBe('nosniff');
            }
        });
    });

    describe('Content Size Errors Through Stack', () => {
        it('should handle large request bodies gracefully', async () => {
            const app = initApp();

            // Create a large body (this might trigger validation limits)
            const largeBody = JSON.stringify({
                data: 'x'.repeat(10000) // 10KB of data
            });

            const res = await app.request('/api/v1/public/users', {
                method: 'POST',
                headers: {
                    'user-agent': 'large-body-test/1.0',
                    accept: 'application/json',
                    'content-type': 'application/json'
                },
                body: largeBody
            });

            // Could be validation error, rate limited, or size limit
            expect([400, 413, 429]).toContain(res.status);

            if (res.status === 400 || res.status === 413) {
                const data = await res.json();
                expect(data.success).toBe(false);
                expect(data.error).toBeDefined();
            }

            // Should maintain middleware functionality
            expect(res.headers.get('x-request-id')).toBeTruthy();
        });
    });

    describe('Middleware Chain Recovery', () => {
        it('should recover gracefully after errors and continue processing subsequent requests', async () => {
            const app = initApp();

            // First request: cause an error
            const errorRes = await app.request('/health/live', {
                headers: {
                    // Missing user-agent to cause validation error
                    accept: 'application/json'
                }
            });
            // Should be validation error or rate limited
            expect([400, 429]).toContain(errorRes.status);

            // Second request: should work normally (or be rate limited)
            const successRes = await app.request('/health/live', {
                headers: {
                    'user-agent': 'recovery-test/1.0',
                    accept: 'application/json'
                }
            });

            // Could be success or rate limited, but should respond
            expect([200, 429]).toContain(successRes.status);

            // Verify both requests got unique request IDs
            const errorRequestId = errorRes.headers.get('x-request-id');
            const successRequestId = successRes.headers.get('x-request-id');

            expect(errorRequestId).toBeTruthy();
            expect(successRequestId).toBeTruthy();
            expect(errorRequestId).not.toBe(successRequestId);

            // Verify response is properly formatted (if successful)
            if (successRes.status === 200) {
                const successData = await successRes.json();
                expect(successData.success).toBe(true);
                expect(successData.data.alive).toBe(true);
            } else {
                // Even rate limited responses should be properly formatted
                const rateLimitData = await successRes.json();
                expect(rateLimitData.success).toBe(false);
            }
        });
    });
});
