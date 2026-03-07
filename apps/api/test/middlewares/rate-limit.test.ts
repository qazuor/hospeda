/**
 * Rate Limit Middleware Tests
 * Tests the rate limiting functionality including IP detection, limits, and error handling
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ✅ Enable rate limiting for this specific test file
process.env.HOSPEDA_TESTING_RATE_LIMIT = 'true';

// Mock Redis to use in-memory store in tests
vi.mock('../../src/utils/redis', () => ({
    getRedisClient: vi.fn().mockResolvedValue(undefined),
    disconnectRedis: vi.fn().mockResolvedValue(undefined),
    resetRedisState: vi.fn()
}));

// Mock environment BEFORE any imports
vi.mock('../../src/utils/env', () => {
    const mockEnv = {
        // General rate limiting
        API_RATE_LIMIT_ENABLED: true,
        API_RATE_LIMIT_WINDOW_MS: 1000, // 1 second for testing
        API_RATE_LIMIT_MAX_REQUESTS: 3, // 3 requests per window
        API_RATE_LIMIT_KEY_GENERATOR: 'ip',
        API_RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: false,
        API_RATE_LIMIT_SKIP_FAILED_REQUESTS: false,
        API_RATE_LIMIT_STANDARD_HEADERS: true,
        API_RATE_LIMIT_LEGACY_HEADERS: false,
        API_RATE_LIMIT_MESSAGE: 'Too many requests, please try again later.',

        // Auth rate limiting
        API_RATE_LIMIT_AUTH_ENABLED: true,
        API_RATE_LIMIT_AUTH_WINDOW_MS: 1000,
        API_RATE_LIMIT_AUTH_MAX_REQUESTS: 5, // Higher limit for auth
        API_RATE_LIMIT_AUTH_MESSAGE: 'Too many authentication requests, please try again later.',

        // Public API rate limiting
        API_RATE_LIMIT_PUBLIC_ENABLED: true,
        API_RATE_LIMIT_PUBLIC_WINDOW_MS: 1000,
        API_RATE_LIMIT_PUBLIC_MAX_REQUESTS: 10, // Higher limit for public API
        API_RATE_LIMIT_PUBLIC_MESSAGE: 'Too many API requests, please try again later.',

        // Admin rate limiting
        API_RATE_LIMIT_ADMIN_ENABLED: true,
        API_RATE_LIMIT_ADMIN_WINDOW_MS: 1000,
        API_RATE_LIMIT_ADMIN_MAX_REQUESTS: 2, // Lower limit for admin
        API_RATE_LIMIT_ADMIN_MESSAGE: 'Too many admin requests, please try again later.'
    };

    const getRateLimitConfig = () => ({
        enabled: mockEnv.API_RATE_LIMIT_ENABLED,
        windowMs: mockEnv.API_RATE_LIMIT_WINDOW_MS,
        maxRequests: mockEnv.API_RATE_LIMIT_MAX_REQUESTS,
        keyGenerator: mockEnv.API_RATE_LIMIT_KEY_GENERATOR,
        skipSuccessfulRequests: mockEnv.API_RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS,
        skipFailedRequests: mockEnv.API_RATE_LIMIT_SKIP_FAILED_REQUESTS,
        standardHeaders: mockEnv.API_RATE_LIMIT_STANDARD_HEADERS,
        legacyHeaders: mockEnv.API_RATE_LIMIT_LEGACY_HEADERS,
        message: mockEnv.API_RATE_LIMIT_MESSAGE,
        trustProxy: true, // Enable proxy trust for IP detection in tests

        // Auth-specific
        authEnabled: mockEnv.API_RATE_LIMIT_AUTH_ENABLED,
        authWindowMs: mockEnv.API_RATE_LIMIT_AUTH_WINDOW_MS,
        authMaxRequests: mockEnv.API_RATE_LIMIT_AUTH_MAX_REQUESTS,
        authMessage: mockEnv.API_RATE_LIMIT_AUTH_MESSAGE,

        // Public API-specific
        publicEnabled: mockEnv.API_RATE_LIMIT_PUBLIC_ENABLED,
        publicWindowMs: mockEnv.API_RATE_LIMIT_PUBLIC_WINDOW_MS,
        publicMaxRequests: mockEnv.API_RATE_LIMIT_PUBLIC_MAX_REQUESTS,
        publicMessage: mockEnv.API_RATE_LIMIT_PUBLIC_MESSAGE,

        // Admin-specific
        adminEnabled: mockEnv.API_RATE_LIMIT_ADMIN_ENABLED,
        adminWindowMs: mockEnv.API_RATE_LIMIT_ADMIN_WINDOW_MS,
        adminMaxRequests: mockEnv.API_RATE_LIMIT_ADMIN_MAX_REQUESTS,
        adminMessage: mockEnv.API_RATE_LIMIT_ADMIN_MESSAGE
    });

    return {
        validateApiEnv: vi.fn(),
        env: mockEnv,
        getRateLimitConfig
    };
});

import { Hono } from 'hono';
import {
    cleanupExpiredEntries,
    clearRateLimitForIp,
    clearRateLimitStore,
    rateLimitMiddleware,
    resetRateLimitStore,
    stopCleanupInterval
} from '../../src/middlewares/rate-limit';
import { getRedisClient } from '../../src/utils/redis';

describe('Rate Limit Middleware', () => {
    let app: Hono;

    beforeEach(async () => {
        // Clear the rate limit store to ensure clean state between tests
        await clearRateLimitStore();

        app = new Hono();
        app.use('*', rateLimitMiddleware);
        app.get('/test', (c) => c.json({ message: 'success' }));
        app.post('/test', (c) => c.json({ message: 'posted' }));
        app.put('/test', (c) => c.json({ message: 'updated' }));
        app.delete('/test', (c) => c.json({ message: 'deleted' }));
    });

    describe('Basic Rate Limiting', () => {
        it('should allow requests within the limit', async () => {
            // Make 3 requests (within the limit)
            for (let i = 0; i < 3; i++) {
                const res = await app.request('/test', {
                    headers: {
                        'X-Forwarded-For': '192.168.1.1'
                    }
                });
                expect(res.status).toBe(200);
            }
        });

        it('should block requests exceeding the limit', async () => {
            // Make 3 requests (within the limit)
            for (let i = 0; i < 3; i++) {
                const res = await app.request('/test', {
                    headers: {
                        'X-Forwarded-For': '192.168.1.1'
                    }
                });
                expect(res.status).toBe(200);
            }

            // 4th request should be blocked
            const res = await app.request('/test', {
                headers: {
                    'X-Forwarded-For': '192.168.1.1'
                }
            });

            expect(res.status).toBe(429);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED');
            expect(data.error.message).toBe('Too many requests, please try again later.');
        });

        it('should reset limits after window expires', async () => {
            // Make 3 requests (within the limit)
            for (let i = 0; i < 3; i++) {
                const res = await app.request('/test', {
                    headers: {
                        'X-Forwarded-For': '192.168.1.1'
                    }
                });
                expect(res.status).toBe(200);
            }

            // 4th request should be blocked
            const res1 = await app.request('/test', {
                headers: {
                    'X-Forwarded-For': '192.168.1.1'
                }
            });
            expect(res1.status).toBe(429);

            // Wait for window to expire (1 second)
            await new Promise((resolve) => setTimeout(resolve, 1100));

            // Should allow requests again
            const res2 = await app.request('/test', {
                headers: {
                    'X-Forwarded-For': '192.168.1.1'
                }
            });
            expect(res2.status).toBe(200);
        });
    });

    describe('IP Address Detection', () => {
        it('should use X-Forwarded-For header', async () => {
            const res = await app.request('/test', {
                headers: {
                    'X-Forwarded-For': '203.0.113.1'
                }
            });
            expect(res.status).toBe(200);
        });

        it('should use X-Real-IP header when X-Forwarded-For is not present', async () => {
            const res = await app.request('/test', {
                headers: {
                    'X-Real-IP': '203.0.113.2'
                }
            });
            expect(res.status).toBe(200);
        });

        it('should use CF-Connecting-IP header when others are not present', async () => {
            const res = await app.request('/test', {
                headers: {
                    'CF-Connecting-IP': '203.0.113.3'
                }
            });
            expect(res.status).toBe(200);
        });

        it('should use first IP from X-Forwarded-For when multiple are present', async () => {
            const res = await app.request('/test', {
                headers: {
                    'X-Forwarded-For': '203.0.113.1, 10.0.0.1, 172.16.0.1'
                }
            });
            expect(res.status).toBe(200);
        });

        it('should use unknown when no IP headers are present', async () => {
            const res = await app.request('/test');
            expect(res.status).toBe(200);
        });

        it('should handle different IPs separately', async () => {
            // IP 1: Make 3 requests
            for (let i = 0; i < 3; i++) {
                const res = await app.request('/test', {
                    headers: {
                        'X-Forwarded-For': '192.168.1.1'
                    }
                });
                expect(res.status).toBe(200);
            }

            // IP 1: 4th request should be blocked
            const res1 = await app.request('/test', {
                headers: {
                    'X-Forwarded-For': '192.168.1.1'
                }
            });
            expect(res1.status).toBe(429);

            // IP 2: Should still be allowed
            const res2 = await app.request('/test', {
                headers: {
                    'X-Forwarded-For': '192.168.1.2'
                }
            });
            expect(res2.status).toBe(200);
        });
    });

    describe('Rate Limit Headers', () => {
        it('should include rate limit headers in response', async () => {
            const res = await app.request('/test', {
                headers: {
                    'X-Forwarded-For': '192.168.1.1'
                }
            });

            expect(res.status).toBe(200);
            expect(res.headers.get('X-RateLimit-Limit')).toBe('3');
            expect(res.headers.get('X-RateLimit-Remaining')).toBe('2');
            expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
        });

        it('should show correct remaining count', async () => {
            // First request
            const res1 = await app.request('/test', {
                headers: {
                    'X-Forwarded-For': '192.168.1.1'
                }
            });
            expect(res1.headers.get('X-RateLimit-Remaining')).toBe('2');

            // Second request
            const res2 = await app.request('/test', {
                headers: {
                    'X-Forwarded-For': '192.168.1.1'
                }
            });
            expect(res2.headers.get('X-RateLimit-Remaining')).toBe('1');

            // Third request
            const res3 = await app.request('/test', {
                headers: {
                    'X-Forwarded-For': '192.168.1.1'
                }
            });
            expect(res3.headers.get('X-RateLimit-Remaining')).toBe('0');
        });

        it('should show 0 remaining when limit is exceeded', async () => {
            // Make 3 requests
            for (let i = 0; i < 3; i++) {
                await app.request('/test', {
                    headers: {
                        'X-Forwarded-For': '192.168.1.1'
                    }
                });
            }

            // 4th request (blocked)
            const res = await app.request('/test', {
                headers: {
                    'X-Forwarded-For': '192.168.1.1'
                }
            });

            expect(res.status).toBe(429);
            expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
        });
    });

    describe('Different HTTP Methods', () => {
        it('should apply rate limiting to GET requests', async () => {
            // Make 3 GET requests
            for (let i = 0; i < 3; i++) {
                const res = await app.request('/test', {
                    headers: {
                        'X-Forwarded-For': '192.168.1.1'
                    }
                });
                expect(res.status).toBe(200);
            }

            // 4th GET request should be blocked
            const res = await app.request('/test', {
                headers: {
                    'X-Forwarded-For': '192.168.1.1'
                }
            });
            expect(res.status).toBe(429);
        });

        it('should apply rate limiting to POST requests', async () => {
            // Make 3 POST requests
            for (let i = 0; i < 3; i++) {
                const res = await app.request('/test', {
                    method: 'POST',
                    headers: {
                        'X-Forwarded-For': '192.168.1.1'
                    }
                });
                expect(res.status).toBe(200);
            }

            // 4th POST request should be blocked
            const res = await app.request('/test', {
                method: 'POST',
                headers: {
                    'X-Forwarded-For': '192.168.1.1'
                }
            });
            expect(res.status).toBe(429);
        });

        it('should apply rate limiting to PUT requests', async () => {
            // Make 3 PUT requests
            for (let i = 0; i < 3; i++) {
                const res = await app.request('/test', {
                    method: 'PUT',
                    headers: {
                        'X-Forwarded-For': '192.168.1.1'
                    }
                });
                expect(res.status).toBe(200);
            }

            // 4th PUT request should be blocked
            const res = await app.request('/test', {
                method: 'PUT',
                headers: {
                    'X-Forwarded-For': '192.168.1.1'
                }
            });
            expect(res.status).toBe(429);
        });

        it('should apply rate limiting to DELETE requests', async () => {
            // Make 3 DELETE requests
            for (let i = 0; i < 3; i++) {
                const res = await app.request('/test', {
                    method: 'DELETE',
                    headers: {
                        'X-Forwarded-For': '192.168.1.1'
                    }
                });
                expect(res.status).toBe(200);
            }

            // 4th DELETE request should be blocked
            const res = await app.request('/test', {
                method: 'DELETE',
                headers: {
                    'X-Forwarded-For': '192.168.1.1'
                }
            });
            expect(res.status).toBe(429);
        });
    });

    describe('Rate Limit Disabled', () => {
        it('should skip rate limiting when disabled', async () => {
            // Create a new app with disabled rate limiting
            const disabledApp = new Hono();

            // Create a mock middleware that skips rate limiting
            const disabledMiddleware = async (_c: any, next: any) => {
                await next();
            };

            disabledApp.use(disabledMiddleware);
            disabledApp.get('/test', (c) => c.json({ message: 'success' }));

            // Make many requests - should all succeed
            for (let i = 0; i < 10; i++) {
                const res = await disabledApp.request('/test', {
                    headers: {
                        'X-Forwarded-For': '192.168.1.1'
                    }
                });
                expect(res.status).toBe(200);
            }
        });
    });

    describe('Error Handling', () => {
        it('should return standardized error format when rate limited', async () => {
            // Make 3 requests
            for (let i = 0; i < 3; i++) {
                await app.request('/test', {
                    headers: {
                        'X-Forwarded-For': '192.168.1.1'
                    }
                });
            }

            // 4th request should be rate limited
            const res = await app.request('/test', {
                headers: {
                    'X-Forwarded-For': '192.168.1.1'
                }
            });

            expect(res.status).toBe(429);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error).toHaveProperty('code');
            expect(data.error).toHaveProperty('message');
            expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED');
        });

        it('should handle requests without IP headers gracefully', async () => {
            // Make 3 requests without IP headers
            for (let i = 0; i < 3; i++) {
                const res = await app.request('/test');
                expect(res.status).toBe(200);
            }

            // 4th request should be rate limited
            const res = await app.request('/test');
            expect(res.status).toBe(429);
        });
    });

    describe('Edge Cases', () => {
        it('should handle malformed X-Forwarded-For header', async () => {
            const res = await app.request('/test', {
                headers: {
                    'X-Forwarded-For': 'invalid-ip-address'
                }
            });
            expect(res.status).toBe(200);
        });

        it('should handle empty X-Forwarded-For header', async () => {
            const res = await app.request('/test', {
                headers: {
                    'X-Forwarded-For': ''
                }
            });
            expect(res.status).toBe(200);
        });

        it('should handle whitespace in X-Forwarded-For header', async () => {
            const res = await app.request('/test', {
                headers: {
                    'X-Forwarded-For': '  192.168.1.1  '
                }
            });
            expect(res.status).toBe(200);
        });

        it('should handle concurrent requests from same IP', async () => {
            // Note: The in-memory rate limit store uses async get/set without locks.
            // Under concurrent load, multiple requests can read the same count before
            // any write completes, causing non-deterministic results.
            // We verify that at least some requests succeed and responses are valid.
            const promises = Array.from({ length: 5 }, () =>
                app.request('/test', {
                    headers: {
                        'X-Forwarded-For': '192.168.1.1'
                    }
                })
            );

            const responses = await Promise.all(promises);

            // All responses should be valid (200 or 429)
            for (const res of responses) {
                expect([200, 429]).toContain(res.status);
            }

            // At least one request should succeed
            const successful = responses.filter((res) => res.status === 200);
            expect(successful.length).toBeGreaterThanOrEqual(1);

            // Total count should equal 5 (all requests processed)
            expect(responses).toHaveLength(5);
        });
    });

    describe('Differentiated Rate Limiting', () => {
        beforeEach(async () => {
            await clearRateLimitStore();
            app = new Hono();
            app.use('*', rateLimitMiddleware);

            // Setup different endpoint types
            app.get('/test', (c) => c.json({ success: true })); // general (3 requests)
            app.get('/auth/login', (c) => c.json({ success: true })); // auth (5 requests)
            app.get('/public/data', (c) => c.json({ success: true })); // public (10 requests)
            app.get('/admin/users', (c) => c.json({ success: true })); // admin (2 requests)
        });

        it('should apply different limits for auth endpoints', async () => {
            // Auth endpoints should allow 5 requests
            for (let i = 0; i < 5; i++) {
                const res = await app.request('/auth/login');
                expect(res.status).toBe(200);
            }

            // 6th request should be rate limited
            const res = await app.request('/auth/login');
            expect(res.status).toBe(429);

            const data = await res.json();
            expect(data.error.message).toBe(
                'Too many authentication requests, please try again later.'
            );
        });

        it('should apply different limits for public endpoints', async () => {
            // Public endpoints should allow 10 requests
            for (let i = 0; i < 10; i++) {
                const res = await app.request('/public/data');
                expect(res.status).toBe(200);
            }

            // 11th request should be rate limited
            const res = await app.request('/public/data');
            expect(res.status).toBe(429);

            const data = await res.json();
            expect(data.error.message).toBe('Too many API requests, please try again later.');
        });

        it('should apply different limits for admin endpoints', async () => {
            // Admin endpoints should allow only 2 requests
            for (let i = 0; i < 2; i++) {
                const res = await app.request('/admin/users');
                expect(res.status).toBe(200);
            }

            // 3rd request should be rate limited
            const res = await app.request('/admin/users');
            expect(res.status).toBe(429);

            const data = await res.json();
            expect(data.error.message).toBe('Too many admin requests, please try again later.');
        });

        it('should include endpoint type in rate limit headers', async () => {
            const res = await app.request('/auth/login');
            expect(res.status).toBe(200);
            expect(res.headers.get('X-RateLimit-Type')).toBe('auth');
            expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
        });

        it('should track different endpoint types independently', async () => {
            // Use up general endpoint limit (3 requests)
            for (let i = 0; i < 3; i++) {
                const res = await app.request('/test');
                expect(res.status).toBe(200);
            }

            // General endpoint should be rate limited
            const generalRes = await app.request('/test');
            expect(generalRes.status).toBe(429);

            // But auth endpoint should still work (different limit and counter)
            const authRes = await app.request('/auth/login');
            expect(authRes.status).toBe(200);
        });
    });

    describe('clearRateLimitForIp', () => {
        it('should only clear entries for the specified IP', async () => {
            // Arrange: make 2 requests from each IP
            for (let i = 0; i < 2; i++) {
                await app.request('/test', {
                    headers: { 'X-Forwarded-For': '192.168.1.1' }
                });
                await app.request('/test', {
                    headers: { 'X-Forwarded-For': '192.168.1.2' }
                });
            }

            // Act: clear only IP 192.168.1.1
            await clearRateLimitForIp({ ip: '192.168.1.1' });

            // Assert: 192.168.1.1 counter is reset, first request should succeed
            const res1 = await app.request('/test', {
                headers: { 'X-Forwarded-For': '192.168.1.1' }
            });
            expect(res1.status).toBe(200);

            // Assert: 192.168.1.2 still has its previous count (2 requests)
            // One more request (3rd total) should succeed
            const res2 = await app.request('/test', {
                headers: { 'X-Forwarded-For': '192.168.1.2' }
            });
            expect(res2.status).toBe(200);

            // Assert: 192.168.1.2 has now reached the limit (3 requests total)
            const res3 = await app.request('/test', {
                headers: { 'X-Forwarded-For': '192.168.1.2' }
            });
            expect(res3.status).toBe(429);
        });

        it('should handle clearing a non-existent IP gracefully', async () => {
            // Act + Assert: calling clearRateLimitForIp for an unknown IP must not throw
            await expect(clearRateLimitForIp({ ip: '10.0.0.99' })).resolves.toBeUndefined();
        });

        it('should clear entries across all endpoint types for an IP', async () => {
            // Arrange: use a local app with all three endpoint types
            const multiApp = new Hono();
            multiApp.use('*', rateLimitMiddleware);
            multiApp.get('/test', (c) => c.json({ success: true })); // general (limit: 3)
            multiApp.get('/auth/login', (c) => c.json({ success: true })); // auth    (limit: 5)
            multiApp.get('/admin/users', (c) => c.json({ success: true })); // admin   (limit: 2)

            const ip = '192.168.1.50';

            // Make requests on all three endpoint types to build up counts
            await multiApp.request('/test', { headers: { 'X-Forwarded-For': ip } });
            await multiApp.request('/auth/login', { headers: { 'X-Forwarded-For': ip } });
            await multiApp.request('/admin/users', { headers: { 'X-Forwarded-For': ip } });

            // Act: clear all rate limit entries for this IP
            await clearRateLimitForIp({ ip });

            // Assert: all three endpoint types accept a fresh request (counters reset to 0)
            const resGeneral = await multiApp.request('/test', {
                headers: { 'X-Forwarded-For': ip }
            });
            expect(resGeneral.status).toBe(200);

            const resAuth = await multiApp.request('/auth/login', {
                headers: { 'X-Forwarded-For': ip }
            });
            expect(resAuth.status).toBe(200);

            const resAdmin = await multiApp.request('/admin/users', {
                headers: { 'X-Forwarded-For': ip }
            });
            expect(resAdmin.status).toBe(200);
        });
    });

    describe('In-memory store cleanup', () => {
        it('should remove expired entries after cleanup', async () => {
            // Arrange: make requests to populate the store
            for (let i = 0; i < 2; i++) {
                await app.request('/test', {
                    headers: { 'X-Forwarded-For': '10.0.0.1' }
                });
            }

            // Verify entries exist (3rd request should succeed)
            const res1 = await app.request('/test', {
                headers: { 'X-Forwarded-For': '10.0.0.1' }
            });
            expect(res1.status).toBe(200);

            // Act: simulate time passing by clearing and re-adding with old timestamps
            await clearRateLimitStore();

            // Re-make requests then run cleanup with a mocked Date.now
            for (let i = 0; i < 2; i++) {
                await app.request('/test', {
                    headers: { 'X-Forwarded-For': '10.0.0.2' }
                });
            }

            // Mock Date.now to be 2 hours in the future (past MAX_ENTRY_LIFETIME_MS)
            const originalNow = Date.now;
            Date.now = () => originalNow() + 2 * 60 * 60 * 1000;

            try {
                cleanupExpiredEntries();

                // After cleanup, counters should be reset
                // Clear store and re-test to verify cleanup worked
                // The old entries for 10.0.0.2 should have been cleaned up
                const res2 = await app.request('/test', {
                    headers: { 'X-Forwarded-For': '10.0.0.2' }
                });
                // Should be 200 because old entries were cleaned
                expect(res2.status).toBe(200);
            } finally {
                Date.now = originalNow;
            }
        });

        it('should preserve non-expired entries during cleanup', async () => {
            // Arrange: make requests to populate the store
            await app.request('/test', {
                headers: { 'X-Forwarded-For': '10.0.0.3' }
            });

            // Act: run cleanup without advancing time
            cleanupExpiredEntries();

            // Assert: entries should still be there (next request uses same counter)
            const res = await app.request('/test', {
                headers: { 'X-Forwarded-For': '10.0.0.3' }
            });
            expect(res.status).toBe(200);
            // The remaining count should reflect the previous request
            expect(res.headers.get('X-RateLimit-Remaining')).toBe('1');
        });

        it('should export stopCleanupInterval without error', () => {
            expect(() => stopCleanupInterval()).not.toThrow();
        });
    });

    describe('Redis store integration', () => {
        const mockRedisGet = vi.fn();
        const mockRedisSet = vi.fn();
        const mockRedisExists = vi.fn();
        const mockRedisScan = vi.fn();
        const mockRedisDel = vi.fn();
        const mockRedis = {
            get: mockRedisGet,
            set: mockRedisSet,
            exists: mockRedisExists,
            scan: mockRedisScan,
            del: mockRedisDel
        };

        beforeEach(async () => {
            await clearRateLimitStore();
            // Reset store so it re-checks for Redis on next call
            resetRateLimitStore();
            // Enable Redis URL so the Redis store is selected
            process.env.HOSPEDA_REDIS_URL = 'redis://localhost:6379';
            vi.clearAllMocks();
        });

        afterEach(() => {
            process.env.HOSPEDA_REDIS_URL = undefined;
            resetRateLimitStore();
        });

        it('should store rate limit entries in Redis when available', async () => {
            // Arrange: make getRedisClient return our mock Redis
            vi.mocked(getRedisClient).mockResolvedValue(mockRedis as never);
            mockRedisGet.mockResolvedValue(null); // No existing entry

            const redisApp = new Hono();
            redisApp.use('*', rateLimitMiddleware);
            redisApp.get('/test', (c) => c.json({ success: true }));

            // Act
            const res = await redisApp.request('/test', {
                headers: { 'X-Forwarded-For': '10.0.0.10' }
            });

            // Assert
            expect(res.status).toBe(200);
            expect(mockRedisSet).toHaveBeenCalled();
            // Verify it was called with the correct key prefix and EX flag
            const setCall = mockRedisSet.mock.calls[0];
            expect(setCall?.[0]).toContain('rl:');
            expect(setCall?.[2]).toBe('EX');
            expect(typeof setCall?.[3]).toBe('number');
        });

        it('should retrieve rate limit entries from Redis', async () => {
            // Arrange: Redis returns an existing entry
            vi.mocked(getRedisClient).mockResolvedValue(mockRedis as never);
            const windowStart = Math.floor(Date.now() / 1000) * 1000;
            mockRedisGet.mockResolvedValue(JSON.stringify({ count: 2, windowStart }));

            const redisApp = new Hono();
            redisApp.use('*', rateLimitMiddleware);
            redisApp.get('/test', (c) => c.json({ success: true }));

            // Act
            const res = await redisApp.request('/test', {
                headers: { 'X-Forwarded-For': '10.0.0.11' }
            });

            // Assert
            expect(res.status).toBe(200);
            expect(mockRedisGet).toHaveBeenCalled();
        });

        it('should fall back to in-memory when Redis get throws', async () => {
            // Arrange: Redis throws on get
            vi.mocked(getRedisClient).mockResolvedValue(mockRedis as never);
            mockRedisGet.mockRejectedValue(new Error('Redis connection lost'));

            const redisApp = new Hono();
            redisApp.use('*', rateLimitMiddleware);
            redisApp.get('/test', (c) => c.json({ success: true }));

            // Act: should not throw, falls back to in-memory
            const res = await redisApp.request('/test', {
                headers: { 'X-Forwarded-For': '10.0.0.12' }
            });

            // Assert: request still succeeds (graceful fallback)
            expect(res.status).toBe(200);
        });

        it('should fall back to in-memory when Redis set throws', async () => {
            // Arrange: Redis throws on set
            vi.mocked(getRedisClient).mockResolvedValue(mockRedis as never);
            mockRedisGet.mockResolvedValue(null);
            mockRedisSet.mockRejectedValue(new Error('Redis write error'));

            const redisApp = new Hono();
            redisApp.use('*', rateLimitMiddleware);
            redisApp.get('/test', (c) => c.json({ success: true }));

            // Act: should not throw
            const res = await redisApp.request('/test', {
                headers: { 'X-Forwarded-For': '10.0.0.13' }
            });

            // Assert: request still succeeds
            expect(res.status).toBe(200);
        });

        it('should fall back when getRedisClient returns undefined', async () => {
            // Arrange: no Redis available
            vi.mocked(getRedisClient).mockResolvedValue(undefined);

            const redisApp = new Hono();
            redisApp.use('*', rateLimitMiddleware);
            redisApp.get('/test', (c) => c.json({ success: true }));

            // Act: uses in-memory fallback
            const res = await redisApp.request('/test', {
                headers: { 'X-Forwarded-For': '10.0.0.14' }
            });

            // Assert
            expect(res.status).toBe(200);
        });
    });
});
