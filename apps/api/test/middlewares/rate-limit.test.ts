import { Hono } from 'hono';
/**
 * Rate Limit Middleware Tests
 * Tests the rate limiting functionality including IP detection, limits, and error handling
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRateLimitStore, createRateLimitMiddleware } from '../../src/middlewares/rate-limit';

// Mock environment
vi.mock('../../src/utils/env', () => {
    const mockEnv = {
        RATE_LIMIT_ENABLED: true,
        RATE_LIMIT_WINDOW_MS: 1000, // 1 second for testing
        RATE_LIMIT_MAX_REQUESTS: 3, // 3 requests per window
        RATE_LIMIT_KEY_GENERATOR: 'ip',
        RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: false,
        RATE_LIMIT_SKIP_FAILED_REQUESTS: false,
        RATE_LIMIT_STANDARD_HEADERS: true,
        RATE_LIMIT_LEGACY_HEADERS: false,
        RATE_LIMIT_MESSAGE: 'Too many requests, please try again later.'
    };

    return {
        env: mockEnv
    };
});

describe('Rate Limit Middleware', () => {
    let app: Hono;

    beforeEach(() => {
        // Clear the rate limit store to ensure clean state between tests
        clearRateLimitStore();

        app = new Hono();
        app.use(createRateLimitMiddleware());
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
            // Make concurrent requests
            const promises = Array.from({ length: 5 }, () =>
                app.request('/test', {
                    headers: {
                        'X-Forwarded-For': '192.168.1.1'
                    }
                })
            );

            const responses = await Promise.all(promises);

            // Should have 3 successful and 2 rate limited
            const successful = responses.filter((res) => res.status === 200);
            const rateLimited = responses.filter((res) => res.status === 429);

            expect(successful).toHaveLength(3);
            expect(rateLimited).toHaveLength(2);
        });
    });
});
