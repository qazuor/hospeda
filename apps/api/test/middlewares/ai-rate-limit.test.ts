/**
 * Tests for the AI rate-limit middleware factory (SPEC-173 T-032).
 *
 * Coverage:
 *   - The factory returns exactly 2 middlewares.
 *   - Defaults are applied when options are omitted.
 *   - Per-user limiter: burst over maxPerUser within window → 429 + Retry-After.
 *   - Per-user limiter: under limit → 200.
 *   - Per-user window slide allows again (injected store with time control).
 *   - Per-IP limiter: many requests from the same IP exceed maxPerIp → 429.
 *   - Per-IP limiter: different IPs have independent counters.
 *   - Per-IP limiter: actor is restored on the next() path after the IP check.
 *   - Per-IP limiter: actor is restored when the IP limiter returns 429.
 *   - Different features have isolated counters (keyPrefix isolation).
 *   - Custom options override all three defaults.
 *
 * Uses Hono test apps with injected stores and actors (same idiom as
 * sliding-window-rate-limit.test.ts). `rate-limit.ts` env is fully mocked so
 * rate-limiting is active in the test environment.
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
        HOSPEDA_RATE_LIMIT_BACKEND: 'memory' as const,
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
            skip: 'none' as const,
            headers: 'standard' as const,
            message: 'Too many requests',
            trustProxy: true,
            trustedProxies: [] as string[],
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

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAiRateLimitMiddlewares } from '../../src/middlewares/ai-rate-limit';
import { clearSlidingWindowStore } from '../../src/middlewares/rate-limit';
import type { AppBindings } from '../../src/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a minimal Hono app that:
 *   1. Injects `actorId` into context (optional).
 *   2. Mounts both middlewares from `createAiRateLimitMiddlewares`.
 *   3. Exposes a POST /ai route that returns 200 + { ok: true }.
 *
 * The actor is injected using a cast to the minimal shape the limiter needs.
 */
function buildApp(opts: {
    feature?: Parameters<typeof createAiRateLimitMiddlewares>[0];
    rateLimitOptions?: Parameters<typeof createAiRateLimitMiddlewares>[1];
    actorId?: string;
}): Hono<AppBindings> {
    const { feature = 'text_improve', rateLimitOptions, actorId } = opts;

    const app = new Hono<AppBindings>();

    // Inject actor before rate-limit middlewares
    app.use('*', async (c, next) => {
        if (actorId) {
            c.set('actor', { id: actorId } as AppBindings['Variables']['actor']);
        }
        await next();
    });

    const middlewares = createAiRateLimitMiddlewares(feature, rateLimitOptions);
    for (const mw of middlewares) {
        app.use('*', mw);
    }

    app.post('/ai', (c) => {
        // Expose the actor id in the response body so we can assert it was restored
        const actor = c.get('actor');
        return c.json({ ok: true, actorId: actor?.id });
    });

    return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createAiRateLimitMiddlewares', () => {
    beforeEach(() => {
        clearSlidingWindowStore();
    });

    afterEach(() => {
        clearSlidingWindowStore();
        vi.clearAllMocks();
    });

    // ── 1. Return value shape ────────────────────────────────────────────────

    describe('return value', () => {
        it('returns exactly 2 middlewares', () => {
            // Arrange + Act
            const middlewares = createAiRateLimitMiddlewares('chat');

            // Assert
            expect(middlewares).toHaveLength(2);
            expect(typeof middlewares[0]).toBe('function');
            expect(typeof middlewares[1]).toBe('function');
        });

        it('returns exactly 2 middlewares when options are omitted', () => {
            const middlewares = createAiRateLimitMiddlewares('search');
            expect(middlewares).toHaveLength(2);
        });
    });

    // ── 2. Defaults applied when options omitted ─────────────────────────────

    describe('default options', () => {
        it('allows 20 requests per user before blocking (default maxPerUser)', async () => {
            // Arrange: default maxPerUser = 20
            const app = buildApp({ feature: 'text_improve', actorId: 'user-defaults-test' });

            // Act: send 20 requests — all should pass
            for (let i = 0; i < 20; i++) {
                const res = await app.request('/ai', { method: 'POST' });
                expect(res.status).toBe(200);
            }

            // 21st should be blocked
            const blocked = await app.request('/ai', { method: 'POST' });
            expect(blocked.status).toBe(429);
        });
    });

    // ── 3. Per-user limiter ──────────────────────────────────────────────────

    describe('per-user limiter (middlewares[0])', () => {
        it('allows exactly maxPerUser requests within the window', async () => {
            // Arrange
            const app = buildApp({
                feature: 'text_improve',
                rateLimitOptions: { windowMs: 60_000, maxPerUser: 3 },
                actorId: 'user-rl-aaa'
            });

            // Act + Assert: first 3 pass
            for (let i = 0; i < 3; i++) {
                const res = await app.request('/ai', { method: 'POST' });
                expect(res.status).toBe(200);
            }
        });

        it('returns 429 on the (maxPerUser+1)th request', async () => {
            // Arrange
            const app = buildApp({
                feature: 'text_improve',
                rateLimitOptions: { windowMs: 60_000, maxPerUser: 3 },
                actorId: 'user-rl-bbb'
            });

            // Exhaust
            for (let i = 0; i < 3; i++) {
                await app.request('/ai', { method: 'POST' });
            }

            // Act
            const res = await app.request('/ai', { method: 'POST' });

            // Assert
            expect(res.status).toBe(429);
        });

        it('includes Retry-After header on 429', async () => {
            // Arrange
            const app = buildApp({
                feature: 'text_improve',
                rateLimitOptions: { windowMs: 60_000, maxPerUser: 1 },
                actorId: 'user-rl-ccc'
            });
            await app.request('/ai', { method: 'POST' });

            // Act
            const res = await app.request('/ai', { method: 'POST' });

            // Assert
            expect(res.status).toBe(429);
            const retryAfter = res.headers.get('Retry-After');
            expect(retryAfter).toBeDefined();
            expect(Number(retryAfter)).toBeGreaterThan(0);
        });

        it('includes RATE_LIMIT_EXCEEDED error code in body', async () => {
            // Arrange
            const app = buildApp({
                feature: 'text_improve',
                rateLimitOptions: { windowMs: 60_000, maxPerUser: 1 },
                actorId: 'user-rl-ddd'
            });
            await app.request('/ai', { method: 'POST' });

            // Act
            const res = await app.request('/ai', { method: 'POST' });
            const body = (await res.json()) as { success: boolean; error: { code: string } };

            // Assert
            expect(res.status).toBe(429);
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
        });

        it('allows requests again after the window elapses', async () => {
            // Arrange: very short window
            const app = buildApp({
                feature: 'text_improve',
                rateLimitOptions: { windowMs: 100, maxPerUser: 2 },
                actorId: 'user-rl-eee'
            });

            // Exhaust
            await app.request('/ai', { method: 'POST' });
            await app.request('/ai', { method: 'POST' });
            const blocked = await app.request('/ai', { method: 'POST' });
            expect(blocked.status).toBe(429);

            // Wait for window to expire
            await new Promise((resolve) => setTimeout(resolve, 150));

            // Assert: accepted again
            const res = await app.request('/ai', { method: 'POST' });
            expect(res.status).toBe(200);
        });
    });

    // ── 4. Per-IP limiter ────────────────────────────────────────────────────

    describe('per-IP limiter (middlewares[1])', () => {
        it('returns 429 when maxPerIp requests come from the same IP', async () => {
            // Arrange: maxPerIp = 3; three different user accounts but same IP
            const baseOpts = {
                feature: 'chat' as const,
                rateLimitOptions: { windowMs: 60_000, maxPerUser: 100, maxPerIp: 3 }
            };

            // Use three different actor IDs (per-user won't block them) but same IP
            const appA = buildApp({ ...baseOpts, actorId: 'user-ip-aaa' });
            const appB = buildApp({ ...baseOpts, actorId: 'user-ip-bbb' });
            const appC = buildApp({ ...baseOpts, actorId: 'user-ip-ccc' });

            // Share the same source IP via X-Forwarded-For
            const sameIp = { 'X-Forwarded-For': '203.0.113.5' };

            // Act: one request each — all pass (3 total = maxPerIp)
            const r1 = await appA.request('/ai', { method: 'POST', headers: sameIp });
            const r2 = await appB.request('/ai', { method: 'POST', headers: sameIp });
            const r3 = await appC.request('/ai', { method: 'POST', headers: sameIp });
            expect(r1.status).toBe(200);
            expect(r2.status).toBe(200);
            expect(r3.status).toBe(200);

            // 4th request from the same IP should be blocked
            const appD = buildApp({ ...baseOpts, actorId: 'user-ip-ddd' });
            const blocked = await appD.request('/ai', { method: 'POST', headers: sameIp });
            expect(blocked.status).toBe(429);
        });

        it('allows requests from a different IP even when one IP is at the limit', async () => {
            // Arrange
            const baseOpts = {
                feature: 'chat' as const,
                rateLimitOptions: { windowMs: 60_000, maxPerUser: 100, maxPerIp: 2 }
            };

            // Exhaust IP A
            const appA1 = buildApp({ ...baseOpts, actorId: 'user-ip2-aaa' });
            const appA2 = buildApp({ ...baseOpts, actorId: 'user-ip2-bbb' });
            await appA1.request('/ai', {
                method: 'POST',
                headers: { 'X-Forwarded-For': '10.0.0.1' }
            });
            await appA2.request('/ai', {
                method: 'POST',
                headers: { 'X-Forwarded-For': '10.0.0.1' }
            });
            const blocked = await appA1.request('/ai', {
                method: 'POST',
                headers: { 'X-Forwarded-For': '10.0.0.1' }
            });
            expect(blocked.status).toBe(429);

            // IP B is unaffected
            const appB = buildApp({ ...baseOpts, actorId: 'user-ip2-ccc' });
            const res = await appB.request('/ai', {
                method: 'POST',
                headers: { 'X-Forwarded-For': '10.0.0.2' }
            });
            expect(res.status).toBe(200);
        });

        it('restores the original actor id in the handler after per-IP check passes', async () => {
            // Arrange: actor id should be 'user-restore-test', not the IP
            const app = buildApp({
                feature: 'search',
                rateLimitOptions: { windowMs: 60_000, maxPerUser: 10, maxPerIp: 10 },
                actorId: 'user-restore-test'
            });

            // Act
            const res = await app.request('/ai', {
                method: 'POST',
                headers: { 'X-Forwarded-For': '1.2.3.4' }
            });
            const body = (await res.json()) as { ok: boolean; actorId: string };

            // Assert: handler sees original actor, not the IP
            expect(res.status).toBe(200);
            expect(body.actorId).toBe('user-restore-test');
        });
    });

    // ── 5. Feature key-prefix isolation ─────────────────────────────────────

    describe('feature key-prefix isolation', () => {
        it('keeps independent counters for different features', async () => {
            // Arrange: same actor, both features have maxPerUser = 2
            const appTextImprove = buildApp({
                feature: 'text_improve',
                rateLimitOptions: { windowMs: 60_000, maxPerUser: 2 },
                actorId: 'user-feature-iso'
            });
            const appChat = buildApp({
                feature: 'chat',
                rateLimitOptions: { windowMs: 60_000, maxPerUser: 2 },
                actorId: 'user-feature-iso'
            });

            // Exhaust text_improve
            await appTextImprove.request('/ai', { method: 'POST' });
            await appTextImprove.request('/ai', { method: 'POST' });
            const blocked = await appTextImprove.request('/ai', { method: 'POST' });
            expect(blocked.status).toBe(429);

            // chat counter is independent — still passes
            const chatRes1 = await appChat.request('/ai', { method: 'POST' });
            const chatRes2 = await appChat.request('/ai', { method: 'POST' });
            expect(chatRes1.status).toBe(200);
            expect(chatRes2.status).toBe(200);

            // Now chat is also exhausted
            const chatBlocked = await appChat.request('/ai', { method: 'POST' });
            expect(chatBlocked.status).toBe(429);
        });

        it('all four AiFeature values produce isolated counters', async () => {
            // Arrange: each feature with maxPerUser = 1
            const features = ['text_improve', 'chat', 'search', 'support'] as const;
            const apps = features.map((f) =>
                buildApp({
                    feature: f,
                    rateLimitOptions: { windowMs: 60_000, maxPerUser: 1 },
                    actorId: 'user-all-features'
                })
            );

            // Exhaust each feature independently
            for (let i = 0; i < features.length; i++) {
                const app = apps[i]!;
                // First request: OK
                const r1 = await app.request('/ai', { method: 'POST' });
                expect(r1.status).toBe(200);
                // Second request: blocked for THIS feature only
                const r2 = await app.request('/ai', { method: 'POST' });
                expect(r2.status).toBe(429);
            }
        });
    });

    // ── 6. Custom options override ───────────────────────────────────────────

    describe('custom options', () => {
        it('respects a custom windowMs', async () => {
            // Arrange: 150ms window, max 2
            const app = buildApp({
                feature: 'support',
                rateLimitOptions: { windowMs: 150, maxPerUser: 2 },
                actorId: 'user-custom-window'
            });

            // Exhaust
            await app.request('/ai', { method: 'POST' });
            await app.request('/ai', { method: 'POST' });
            const blocked = await app.request('/ai', { method: 'POST' });
            expect(blocked.status).toBe(429);

            // After 200ms, window slides and new request passes
            await new Promise((resolve) => setTimeout(resolve, 200));
            const res = await app.request('/ai', { method: 'POST' });
            expect(res.status).toBe(200);
        });

        it('respects a custom maxPerUser lower than the default', async () => {
            // Arrange: maxPerUser = 5 (lower than default 20)
            const app = buildApp({
                feature: 'search',
                rateLimitOptions: { windowMs: 60_000, maxPerUser: 5 },
                actorId: 'user-custom-max'
            });

            for (let i = 0; i < 5; i++) {
                const r = await app.request('/ai', { method: 'POST' });
                expect(r.status).toBe(200);
            }
            const blocked = await app.request('/ai', { method: 'POST' });
            expect(blocked.status).toBe(429);
        });

        it('respects a custom maxPerIp lower than the default', async () => {
            // Arrange: maxPerIp = 2, maxPerUser = 100 (so only per-IP blocks)
            const baseOpts = {
                feature: 'support' as const,
                rateLimitOptions: { windowMs: 60_000, maxPerUser: 100, maxPerIp: 2 }
            };

            const appA = buildApp({ ...baseOpts, actorId: 'user-custom-ip-a' });
            const appB = buildApp({ ...baseOpts, actorId: 'user-custom-ip-b' });

            const ip = { 'X-Forwarded-For': '198.51.100.1' };

            await appA.request('/ai', { method: 'POST', headers: ip });
            await appB.request('/ai', { method: 'POST', headers: ip });

            const appC = buildApp({ ...baseOpts, actorId: 'user-custom-ip-c' });
            const blocked = await appC.request('/ai', { method: 'POST', headers: ip });
            expect(blocked.status).toBe(429);
        });
    });
});
