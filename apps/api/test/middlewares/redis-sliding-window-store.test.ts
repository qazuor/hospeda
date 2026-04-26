/**
 * RedisSlidingWindowStore unit tests (SPEC-079)
 *
 * Covers:
 *   - record: counts correctly, applies TTL, respects sliding window
 *   - count: reads without recording, respects sliding window
 *   - oldestInWindow: returns oldest timestamp or undefined
 *   - Fail-open: falls back to in-memory when Redis is unavailable
 *   - Backend selection: createSlidingWindowPerUserRateLimit uses Redis when
 *     HOSPEDA_RATE_LIMIT_BACKEND=redis is set
 */

// Enable rate limiting for this test file
process.env.HOSPEDA_TESTING_RATE_LIMIT = 'true';

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock redis client ────────────────────────────────────────────────────────

/** Minimal subset of ioredis methods used by RedisSlidingWindowStore */
interface MockRedis {
    zremrangebyscore: ReturnType<typeof vi.fn>;
    zadd: ReturnType<typeof vi.fn>;
    zcard: ReturnType<typeof vi.fn>;
    expire: ReturnType<typeof vi.fn>;
    zrangebyscore: ReturnType<typeof vi.fn>;
}

/** Factory that creates a fresh mock Redis with default pass-through behaviour */
function createMockRedis(): MockRedis {
    return {
        zremrangebyscore: vi.fn().mockResolvedValue(0),
        zadd: vi.fn().mockResolvedValue(1),
        zcard: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
        zrangebyscore: vi.fn().mockResolvedValue([])
    };
}

let mockRedis: MockRedis | undefined = createMockRedis();

vi.mock('../../src/utils/redis', () => ({
    getRedisClient: vi.fn().mockImplementation(() => Promise.resolve(mockRedis)),
    disconnectRedis: vi.fn().mockResolvedValue(undefined),
    resetRedisState: vi.fn()
}));

vi.mock('../../src/utils/env', () => {
    const mockEnv = {
        NODE_ENV: 'test',
        HOSPEDA_TESTING_RATE_LIMIT: true,
        HOSPEDA_REDIS_URL: 'redis://localhost:6379',
        HOSPEDA_RATE_LIMIT_BACKEND: 'redis' as 'memory' | 'redis',
        API_RATE_LIMIT_TRUST_PROXY: true
    };

    return {
        validateApiEnv: vi.fn(),
        env: mockEnv,
        getRateLimitConfig: () => ({
            enabled: true,
            windowMs: 60_000,
            maxRequests: 100,
            keyGenerator: 'ip',
            skipSuccessfulRequests: false,
            skipFailedRequests: false,
            standardHeaders: true,
            legacyHeaders: false,
            message: 'Too many requests',
            trustProxy: true,
            authEnabled: true,
            authWindowMs: 60_000,
            authMaxRequests: 20,
            authMessage: 'Too many auth requests',
            publicEnabled: true,
            publicWindowMs: 60_000,
            publicMaxRequests: 100,
            publicMessage: 'Too many public requests',
            adminEnabled: true,
            adminWindowMs: 60_000,
            adminMaxRequests: 50,
            adminMessage: 'Too many admin requests',
            billingEnabled: true,
            billingWindowMs: 60_000,
            billingMaxRequests: 20,
            billingMessage: 'Too many billing requests',
            webhookEnabled: true,
            webhookWindowMs: 60_000,
            webhookMaxRequests: 200,
            webhookMessage: 'Too many webhook requests'
        })
    };
});

import {
    RedisSlidingWindowStore,
    clearSlidingWindowStore,
    createSlidingWindowPerUserRateLimit,
    resetRedisSlidingWindowStore
} from '../../src/middlewares/rate-limit';
import type { AppBindings } from '../../src/types';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RedisSlidingWindowStore', () => {
    beforeEach(() => {
        mockRedis = createMockRedis();
        clearSlidingWindowStore();
        resetRedisSlidingWindowStore();
    });

    afterEach(() => {
        clearSlidingWindowStore();
        resetRedisSlidingWindowStore();
    });

    // ── record ────────────────────────────────────────────────────────────────

    describe('record()', () => {
        it('should call ZREMRANGEBYSCORE, ZADD, ZCARD, and EXPIRE', async () => {
            // Arrange
            const store = new RedisSlidingWindowStore();
            if (mockRedis) {
                mockRedis.zcard.mockResolvedValue(1);
            }

            // Act
            await store.record('test-key', 60_000);

            // Assert: all four commands were called
            expect(mockRedis?.zremrangebyscore).toHaveBeenCalledOnce();
            expect(mockRedis?.zadd).toHaveBeenCalledOnce();
            expect(mockRedis?.zcard).toHaveBeenCalledOnce();
            expect(mockRedis?.expire).toHaveBeenCalledOnce();
        });

        it('should use the correct Redis key namespace prefix', async () => {
            // Arrange
            const store = new RedisSlidingWindowStore();
            const key = 'upload:user-abc';

            // Act
            await store.record(key, 60_000);

            // Assert: key is namespaced with rl:slide:
            const [rlKey] = (mockRedis?.zadd as ReturnType<typeof vi.fn>).mock.calls[0] as [
                string,
                ...unknown[]
            ];
            expect(rlKey).toBe(`rl:slide:${key}`);
        });

        it('should set TTL = ceil(windowMs/1000) + 10 seconds buffer', async () => {
            // Arrange
            const store = new RedisSlidingWindowStore();
            const windowMs = 60_000; // 1 minute

            // Act
            await store.record('ttl-test', windowMs);

            // Assert: EXPIRE called with 70 seconds (60 + 10 buffer)
            const [, ttl] = (mockRedis?.expire as ReturnType<typeof vi.fn>).mock.calls[0] as [
                string,
                number
            ];
            expect(ttl).toBe(70);
        });

        it('should return the ZCARD result as the count', async () => {
            // Arrange
            const store = new RedisSlidingWindowStore();
            if (mockRedis) {
                mockRedis.zcard.mockResolvedValue(5);
            }

            // Act
            const count = await store.record('count-test', 60_000);

            // Assert
            expect(count).toBe(5);
        });

        it('should fall back to in-memory when Redis returns undefined', async () => {
            // Arrange: Redis unavailable
            mockRedis = undefined;
            clearSlidingWindowStore();
            const store = new RedisSlidingWindowStore();

            // Act: should not throw, returns in-memory count
            const count = await store.record('fallback-key', 60_000);

            // Assert: in-memory store counted 1 request
            expect(count).toBe(1);
        });

        it('should fall back to in-memory when ZADD throws', async () => {
            // Arrange
            const store = new RedisSlidingWindowStore();
            if (mockRedis) {
                mockRedis.zadd.mockRejectedValue(new Error('Redis ZADD failed'));
            }
            clearSlidingWindowStore();

            // Act: should not throw
            const count = await store.record('error-key', 60_000);

            // Assert: in-memory fallback returned 1
            expect(count).toBe(1);
        });
    });

    // ── count ─────────────────────────────────────────────────────────────────

    describe('count()', () => {
        it('should call ZREMRANGEBYSCORE and ZCARD', async () => {
            // Arrange
            const store = new RedisSlidingWindowStore();
            if (mockRedis) {
                mockRedis.zcard.mockResolvedValue(3);
            }

            // Act
            await store.count('count-key', 60_000);

            // Assert
            expect(mockRedis?.zremrangebyscore).toHaveBeenCalledOnce();
            expect(mockRedis?.zcard).toHaveBeenCalledOnce();
            // ZADD and EXPIRE must NOT be called (count doesn't record)
            expect(mockRedis?.zadd).not.toHaveBeenCalled();
            expect(mockRedis?.expire).not.toHaveBeenCalled();
        });

        it('should return the ZCARD result', async () => {
            // Arrange
            const store = new RedisSlidingWindowStore();
            if (mockRedis) {
                mockRedis.zcard.mockResolvedValue(7);
            }

            // Act
            const count = await store.count('count-key', 60_000);

            // Assert
            expect(count).toBe(7);
        });

        it('should fall back to in-memory when Redis is unavailable', async () => {
            // Arrange
            mockRedis = undefined;
            clearSlidingWindowStore();
            const store = new RedisSlidingWindowStore();

            // Act
            const count = await store.count('no-redis-key', 60_000);

            // Assert: in-memory reports 0 (no prior records)
            expect(count).toBe(0);
        });
    });

    // ── oldestInWindow ────────────────────────────────────────────────────────

    describe('oldestInWindow()', () => {
        it('should return undefined when no entries exist', async () => {
            // Arrange
            const store = new RedisSlidingWindowStore();
            if (mockRedis) {
                mockRedis.zrangebyscore.mockResolvedValue([]);
            }

            // Act
            const oldest = await store.oldestInWindow('empty-key', 60_000);

            // Assert
            expect(oldest).toBeUndefined();
        });

        it('should parse the timestamp from the member string', async () => {
            // Arrange
            const store = new RedisSlidingWindowStore();
            const timestamp = Date.now() - 5_000; // 5 seconds ago
            if (mockRedis) {
                mockRedis.zrangebyscore.mockResolvedValue([`${timestamp}-abc123`]);
            }

            // Act
            const oldest = await store.oldestInWindow('ts-key', 60_000);

            // Assert
            expect(oldest).toBe(timestamp);
        });

        it('should call ZRANGEBYSCORE with correct range and LIMIT 0 1', async () => {
            // Arrange
            const store = new RedisSlidingWindowStore();
            const now = Date.now();
            const windowMs = 60_000;

            // Act
            await store.oldestInWindow('range-key', windowMs);

            // Assert: ZRANGEBYSCORE called with (key, cutoff, '+inf', 'LIMIT', 0, 1)
            const args = (mockRedis?.zrangebyscore as ReturnType<typeof vi.fn>).mock
                .calls[0] as unknown[];
            expect(args[0]).toBe('rl:slide:range-key');
            expect(typeof args[1]).toBe('number'); // cutoff (now - windowMs)
            expect(args[2]).toBe('+inf');
            expect(args[3]).toBe('LIMIT');
            expect(args[4]).toBe(0);
            expect(args[5]).toBe(1);
            // Verify cutoff is approximately (now - windowMs)
            const cutoff = args[1] as number;
            expect(cutoff).toBeGreaterThanOrEqual(now - windowMs - 100);
            expect(cutoff).toBeLessThanOrEqual(now - windowMs + 100);
        });

        it('should fall back to in-memory when Redis throws', async () => {
            // Arrange
            const store = new RedisSlidingWindowStore();
            if (mockRedis) {
                mockRedis.zrangebyscore.mockRejectedValue(new Error('Redis error'));
            }

            // Act: should not throw
            const oldest = await store.oldestInWindow('err-key', 60_000);

            // Assert: in-memory fallback (no entries recorded) returns undefined
            expect(oldest).toBeUndefined();
        });
    });
});

// ─── Backend selection tests ──────────────────────────────────────────────────

describe('createSlidingWindowPerUserRateLimit backend selection', () => {
    beforeEach(() => {
        mockRedis = createMockRedis();
        clearSlidingWindowStore();
        resetRedisSlidingWindowStore();
    });

    afterEach(() => {
        clearSlidingWindowStore();
        resetRedisSlidingWindowStore();
    });

    it('should use Redis store when HOSPEDA_RATE_LIMIT_BACKEND=redis', async () => {
        // Arrange: env is mocked with 'redis', mockRedis returns count=0 then count=1
        if (mockRedis) {
            mockRedis.zcard
                .mockResolvedValueOnce(0) // count() call: 0 requests so far
                .mockResolvedValueOnce(1); // record() call: 1 after recording
        }

        const app = new Hono<AppBindings>();
        app.use('*', async (c, next) => {
            c.set('actor', { id: 'user-redis-test' } as AppBindings['Variables']['actor']);
            await next();
        });
        app.use('*', createSlidingWindowPerUserRateLimit({ windowMs: 60_000, max: 5 }));
        app.post('/upload', (c) => c.json({ success: true }));

        // Act
        const res = await app.request('/upload', { method: 'POST' });

        // Assert: request passed and Redis was consulted
        expect(res.status).toBe(200);
        expect(mockRedis?.zcard).toHaveBeenCalled();
    });

    it('should enforce rate limit via Redis store when limit is exceeded', async () => {
        // Arrange: Redis reports count=5 (already at max)
        if (mockRedis) {
            mockRedis.zcard.mockResolvedValue(5);
            // oldestInWindow call: return a timestamp 30s ago
            mockRedis.zrangebyscore.mockResolvedValue([`${Date.now() - 30_000}-abc`]);
        }

        const app = new Hono<AppBindings>();
        app.use('*', async (c, next) => {
            c.set('actor', { id: 'user-redis-blocked' } as AppBindings['Variables']['actor']);
            await next();
        });
        app.use('*', createSlidingWindowPerUserRateLimit({ windowMs: 60_000, max: 5 }));
        app.post('/upload', (c) => c.json({ success: true }));

        // Act
        const res = await app.request('/upload', { method: 'POST' });

        // Assert: 429 returned
        expect(res.status).toBe(429);
        const body = await res.json();
        expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should fail-open and allow request when Redis is down', async () => {
        // Arrange: Redis is unavailable
        mockRedis = undefined;
        clearSlidingWindowStore();

        const app = new Hono<AppBindings>();
        app.use('*', async (c, next) => {
            c.set('actor', { id: 'user-failopen' } as AppBindings['Variables']['actor']);
            await next();
        });
        app.use('*', createSlidingWindowPerUserRateLimit({ windowMs: 60_000, max: 1 }));
        app.post('/upload', (c) => c.json({ success: true }));

        // Act: even though max=1, in-memory fallback tracks independently
        // First request: count=0 -> allowed, records to in-memory
        const res1 = await app.request('/upload', { method: 'POST' });
        // Second request: in-memory count=1 >= max=1 -> blocked by in-memory fallback
        const res2 = await app.request('/upload', { method: 'POST' });

        // Assert: first request allowed (fail-open from Redis failure -> in-memory took over)
        expect(res1.status).toBe(200);
        // The in-memory fallback correctly enforces the limit
        expect(res2.status).toBe(429);
    });

    it('should use explicit store when passed, ignoring env backend', async () => {
        // Arrange: spy store that always allows (count=0)
        const spyStore = {
            record: vi.fn().mockResolvedValue(1),
            count: vi.fn().mockResolvedValue(0),
            oldestInWindow: vi.fn().mockResolvedValue(undefined)
        };

        const app = new Hono<AppBindings>();
        app.use('*', createSlidingWindowPerUserRateLimit({ windowMs: 60_000, max: 1 }, spyStore));
        app.post('/upload', (c) => c.json({ success: true }));

        // Act: 3 requests with max=1, but spy store always reports count=0
        for (let i = 0; i < 3; i++) {
            const res = await app.request('/upload', { method: 'POST' });
            expect(res.status).toBe(200);
        }

        // Assert: Redis was NOT consulted (spyStore used instead)
        expect(mockRedis?.zcard).not.toHaveBeenCalled();
        expect(spyStore.count).toHaveBeenCalledTimes(3);
    });
});
