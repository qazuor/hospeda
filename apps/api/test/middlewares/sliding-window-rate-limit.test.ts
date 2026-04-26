/**
 * Sliding-Window Per-User Rate Limit Middleware Tests (SPEC-079)
 *
 * Covers:
 *   - Unit: N requests pass, (N+1)th returns 429 with Retry-After
 *   - Sliding window: requests expire after windowMs, new ones are accepted
 *   - Per-user isolation: user A hitting limit does not affect user B
 *   - Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
 *   - Guest/IP fallback when actor is unavailable
 */

// Enable rate limiting for this test file
process.env.HOSPEDA_TESTING_RATE_LIMIT = 'true';

vi.mock('../../src/utils/redis', () => ({
    getRedisClient: vi.fn().mockResolvedValue(undefined),
    disconnectRedis: vi.fn().mockResolvedValue(undefined),
    resetRedisState: vi.fn()
}));

vi.mock('../../src/utils/env', () => {
    const mockEnv = {
        NODE_ENV: 'test',
        HOSPEDA_TESTING_RATE_LIMIT: true,
        HOSPEDA_REDIS_URL: undefined as string | undefined,
        // Required by getClientIp via getBaseRateLimitConfig
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

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type SlidingWindowStore,
    clearSlidingWindowStore,
    createSlidingWindowPerUserRateLimit
} from '../../src/middlewares/rate-limit';
import type { AppBindings } from '../../src/types';

/** Build a minimal Hono app with the sliding-window middleware and a test actor. */
function buildApp(opts: {
    windowMs: number;
    max: number;
    actorId?: string;
    store?: SlidingWindowStore;
}): Hono<AppBindings> {
    const { windowMs, max, actorId, store } = opts;
    const app = new Hono<AppBindings>();

    // Inject actor into context BEFORE the rate-limit middleware
    app.use('*', async (c, next) => {
        if (actorId) {
            // Cast to minimal Actor shape required by the rate limiter (only .id is read)
            c.set('actor', { id: actorId } as AppBindings['Variables']['actor']);
        }
        await next();
    });

    const limiter = createSlidingWindowPerUserRateLimit({ windowMs, max }, store);
    app.use('*', limiter);

    app.post('/upload', (c) => c.json({ success: true }));

    return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createSlidingWindowPerUserRateLimit', () => {
    beforeEach(() => {
        clearSlidingWindowStore();
    });

    afterEach(() => {
        clearSlidingWindowStore();
    });

    // ── 1. Basic allow/deny ───────────────────────────────────────────────────

    describe('Basic allow/deny (max = 3)', () => {
        it('should allow exactly max requests within the window', async () => {
            // Arrange
            const app = buildApp({ windowMs: 60_000, max: 3, actorId: 'user-aaa' });

            // Act + Assert
            for (let i = 0; i < 3; i++) {
                const res = await app.request('/upload', { method: 'POST' });
                expect(res.status).toBe(200);
            }
        });

        it('should return 429 on the (max+1)th request', async () => {
            // Arrange
            const app = buildApp({ windowMs: 60_000, max: 3, actorId: 'user-bbb' });

            // Act: exhaust the window
            for (let i = 0; i < 3; i++) {
                await app.request('/upload', { method: 'POST' });
            }

            // Assert: 4th request is blocked
            const res = await app.request('/upload', { method: 'POST' });
            expect(res.status).toBe(429);
        });

        it('should return RATE_LIMIT_EXCEEDED code in the body', async () => {
            // Arrange
            const app = buildApp({ windowMs: 60_000, max: 1, actorId: 'user-ccc' });
            await app.request('/upload', { method: 'POST' });

            // Act
            const res = await app.request('/upload', { method: 'POST' });

            // Assert
            expect(res.status).toBe(429);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
        });

        it('should include Retry-After header on 429', async () => {
            // Arrange
            const app = buildApp({ windowMs: 60_000, max: 1, actorId: 'user-ddd' });
            await app.request('/upload', { method: 'POST' });

            // Act
            const res = await app.request('/upload', { method: 'POST' });

            // Assert
            expect(res.status).toBe(429);
            const retryAfter = res.headers.get('Retry-After');
            expect(retryAfter).toBeDefined();
            const retryAfterSec = Number(retryAfter);
            expect(retryAfterSec).toBeGreaterThan(0);
            expect(retryAfterSec).toBeLessThanOrEqual(60);
        });
    });

    // ── 2. Informational headers on allowed requests ──────────────────────────

    describe('X-RateLimit-* headers on successful responses', () => {
        it('should set X-RateLimit-Limit header', async () => {
            // Arrange
            const app = buildApp({ windowMs: 60_000, max: 10, actorId: 'user-eee' });

            // Act
            const res = await app.request('/upload', { method: 'POST' });

            // Assert
            expect(res.status).toBe(200);
            expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
        });

        it('should decrement X-RateLimit-Remaining with each request', async () => {
            // Arrange
            const app = buildApp({ windowMs: 60_000, max: 5, actorId: 'user-fff' });

            // Act
            const res1 = await app.request('/upload', { method: 'POST' });
            const res2 = await app.request('/upload', { method: 'POST' });
            const res3 = await app.request('/upload', { method: 'POST' });

            // Assert (max=5, consumed 1/2/3 → remaining 4/3/2)
            expect(res1.headers.get('X-RateLimit-Remaining')).toBe('4');
            expect(res2.headers.get('X-RateLimit-Remaining')).toBe('3');
            expect(res3.headers.get('X-RateLimit-Remaining')).toBe('2');
        });

        it('should set X-RateLimit-Reset to a future epoch timestamp', async () => {
            // Arrange
            const app = buildApp({ windowMs: 60_000, max: 10, actorId: 'user-ggg' });

            // Act
            const beforeMs = Date.now();
            const res = await app.request('/upload', { method: 'POST' });
            const afterMs = Date.now();

            // The middleware sets X-RateLimit-Reset = ceil((now + windowMs) / 1000).
            // Allow a 2-second margin to account for ceil rounding and test jitter.
            const minReset = Math.floor((beforeMs + 60_000) / 1000);
            const maxReset = Math.ceil((afterMs + 60_000) / 1000) + 2;

            // Assert
            const reset = Number(res.headers.get('X-RateLimit-Reset'));
            expect(reset).toBeGreaterThanOrEqual(minReset);
            expect(reset).toBeLessThanOrEqual(maxReset);
        });

        it('should set X-RateLimit-Remaining to 0 on the last allowed request', async () => {
            // Arrange
            const app = buildApp({ windowMs: 60_000, max: 2, actorId: 'user-hhh' });

            await app.request('/upload', { method: 'POST' });
            const res = await app.request('/upload', { method: 'POST' });

            // Assert: last allowed request — remaining = 0
            expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
        });

        it('should set X-RateLimit-Remaining = 0 and include Retry-After on 429', async () => {
            // Arrange
            const app = buildApp({ windowMs: 60_000, max: 1, actorId: 'user-iii' });
            await app.request('/upload', { method: 'POST' });

            // Act
            const res = await app.request('/upload', { method: 'POST' });

            // Assert
            expect(res.status).toBe(429);
            expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
            expect(res.headers.get('Retry-After')).toBeDefined();
        });
    });

    // ── 3. Sliding-window expiry ──────────────────────────────────────────────

    describe('Sliding window expiry', () => {
        it('should accept new requests after the window elapses', async () => {
            // Arrange: very short window so we can wait
            const app = buildApp({ windowMs: 100, max: 2, actorId: 'user-jjj' });

            // Act: exhaust the window
            await app.request('/upload', { method: 'POST' });
            await app.request('/upload', { method: 'POST' });
            const blocked = await app.request('/upload', { method: 'POST' });
            expect(blocked.status).toBe(429);

            // Wait for the window to expire
            await new Promise((resolve) => setTimeout(resolve, 150));

            // Assert: requests are accepted again
            const res = await app.request('/upload', { method: 'POST' });
            expect(res.status).toBe(200);
        });

        it('should only count requests within the sliding window', async () => {
            // Arrange: window of 200ms, max = 3
            const app = buildApp({ windowMs: 200, max: 3, actorId: 'user-kkk' });

            // Make 2 requests
            await app.request('/upload', { method: 'POST' });
            await app.request('/upload', { method: 'POST' });

            // Wait for them to expire
            await new Promise((resolve) => setTimeout(resolve, 250));

            // Make 3 fresh requests — should all pass (old ones expired)
            for (let i = 0; i < 3; i++) {
                const res = await app.request('/upload', { method: 'POST' });
                expect(res.status).toBe(200);
            }

            // 4th should be blocked
            const blocked = await app.request('/upload', { method: 'POST' });
            expect(blocked.status).toBe(429);
        });
    });

    // ── 4. Per-user isolation ─────────────────────────────────────────────────

    describe('Per-user isolation', () => {
        it('should track counters independently per user', async () => {
            // Arrange: user A exhausts the limit
            const appA = buildApp({ windowMs: 60_000, max: 2, actorId: 'user-alice' });
            const appB = buildApp({ windowMs: 60_000, max: 2, actorId: 'user-bob' });

            await appA.request('/upload', { method: 'POST' });
            await appA.request('/upload', { method: 'POST' });
            const blockedA = await appA.request('/upload', { method: 'POST' });
            expect(blockedA.status).toBe(429);

            // Assert: user B's requests are unaffected
            for (let i = 0; i < 2; i++) {
                const resB = await appB.request('/upload', { method: 'POST' });
                expect(resB.status).toBe(200);
            }
        });

        it('should share a counter when the same user ID is used', async () => {
            // Arrange: two different Hono apps but SAME actorId and SAME store
            // (both use the default in-memory store + clearSlidingWindowStore in beforeEach)
            const app1 = buildApp({ windowMs: 60_000, max: 3, actorId: 'user-shared' });
            const app2 = buildApp({ windowMs: 60_000, max: 3, actorId: 'user-shared' });

            // Act: drain 2 requests on app1, 1 on app2 (total 3)
            await app1.request('/upload', { method: 'POST' });
            await app1.request('/upload', { method: 'POST' });
            await app2.request('/upload', { method: 'POST' });

            // Assert: both apps see the same exhausted counter
            const res1 = await app1.request('/upload', { method: 'POST' });
            const res2 = await app2.request('/upload', { method: 'POST' });
            expect(res1.status).toBe(429);
            expect(res2.status).toBe(429);
        });
    });

    // ── 5. IP fallback ────────────────────────────────────────────────────────

    describe('IP fallback when no actor', () => {
        it('should use IP as identity when actor is absent', async () => {
            // Arrange: no actor injected, use a recognisable IP
            const app = new Hono();
            const limiter = createSlidingWindowPerUserRateLimit({ windowMs: 60_000, max: 2 });
            app.use('*', limiter);
            app.post('/upload', (c) => c.json({ success: true }));

            // Act
            for (let i = 0; i < 2; i++) {
                const res = await app.request('/upload', {
                    method: 'POST',
                    headers: { 'X-Forwarded-For': '1.2.3.4' }
                });
                expect(res.status).toBe(200);
            }

            const blocked = await app.request('/upload', {
                method: 'POST',
                headers: { 'X-Forwarded-For': '1.2.3.4' }
            });
            expect(blocked.status).toBe(429);

            // Different IP should still work
            const otherIp = await app.request('/upload', {
                method: 'POST',
                headers: { 'X-Forwarded-For': '5.6.7.8' }
            });
            expect(otherIp.status).toBe(200);
        });
    });

    // ── 6. Custom store injection ─────────────────────────────────────────────

    describe('Custom SlidingWindowStore injection', () => {
        it('should use the injected store for record/count/oldestInWindow', async () => {
            // Arrange: a spy store that always reports count=0 (never blocks)
            const spyStore: SlidingWindowStore = {
                record: vi.fn().mockResolvedValue(1),
                count: vi.fn().mockResolvedValue(0),
                oldestInWindow: vi.fn().mockResolvedValue(undefined)
            };

            const app = buildApp({
                windowMs: 60_000,
                max: 1,
                actorId: 'user-spy',
                store: spyStore
            });

            // Act: make 5 requests — none should be blocked because count always returns 0
            for (let i = 0; i < 5; i++) {
                const res = await app.request('/upload', { method: 'POST' });
                expect(res.status).toBe(200);
            }

            // Assert: store was consulted on every request
            expect(spyStore.count).toHaveBeenCalledTimes(5);
            expect(spyStore.record).toHaveBeenCalledTimes(5);
        });
    });

    // ── 7. keyPrefix isolation ────────────────────────────────────────────────

    describe('keyPrefix isolation', () => {
        it('should maintain separate counters for different keyPrefixes', async () => {
            // Arrange: same actorId, different keyPrefixes
            const appUpload = new Hono<AppBindings>();
            appUpload.use('*', async (c, next) => {
                c.set('actor', { id: 'user-prefix-test' } as AppBindings['Variables']['actor']);
                await next();
            });
            appUpload.use(
                '*',
                createSlidingWindowPerUserRateLimit({
                    windowMs: 60_000,
                    max: 2,
                    keyPrefix: 'upload:protected'
                })
            );
            appUpload.post('/upload', (c) => c.json({ success: true }));

            const appDelete = new Hono<AppBindings>();
            appDelete.use('*', async (c, next) => {
                c.set('actor', { id: 'user-prefix-test' } as AppBindings['Variables']['actor']);
                await next();
            });
            appDelete.use(
                '*',
                createSlidingWindowPerUserRateLimit({
                    windowMs: 60_000,
                    max: 2,
                    keyPrefix: 'delete:admin'
                })
            );
            appDelete.delete('/media', (c) => c.json({ success: true }));

            // Act: exhaust the upload limit
            await appUpload.request('/upload', { method: 'POST' });
            await appUpload.request('/upload', { method: 'POST' });
            const blockedUpload = await appUpload.request('/upload', { method: 'POST' });
            expect(blockedUpload.status).toBe(429);

            // Assert: delete counter is independent
            for (let i = 0; i < 2; i++) {
                const resDelete = await appDelete.request('/media', { method: 'DELETE' });
                expect(resDelete.status).toBe(200);
            }
        });
    });
});
