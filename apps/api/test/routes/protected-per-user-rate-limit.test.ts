/**
 * Integration tests: per-user sliding-window rate limit on protected routes (Point A)
 * and per-user write limit on review/comment create endpoints (Point B).
 *
 * ## Approach: middleware-level tests
 *
 * Both task groups use the middleware-level approach — building a minimal Hono
 * app that injects an actor, applies the limiter under test, and exposes a dummy
 * POST endpoint — rather than wiring up the full protected-route stack.
 *
 * **Why not real-route?**  The actual protected routes require:
 *  - Better Auth session middleware + DB actor lookup (not easy to stub without
 *    the real auth layer)
 *  - Per-service mocks (GastronomyReviewService, EntityCommentService, …) with
 *    transactional DB mocks to avoid real DB hits
 *  - All of `setupRoutes(app)` which starts billing, cron, and Sentry side-effects
 *
 * The middleware-level harness gives full isolation of the rate-limiting logic
 * (the exact function applied in production) without those side-effects.  The
 * actor is injected via an upstream `app.use('*', ...)` that calls
 * `c.set('actor', ...)`, which is exactly what the auth chain does in production
 * before any per-route middleware sees the context.
 *
 * ## What is tested
 *
 * ### Point A — global per-user limit on /api/v1/protected/* (200 req / 60 s)
 *  - Requests up to the limit pass with 200.
 *  - The (max+1)th request returns 429 with `error.code === RATE_LIMIT_EXCEEDED`.
 *  - Two DIFFERENT authenticated actors from the SAME IP get INDEPENDENT buckets
 *    (actor A hitting the limit does NOT block actor B — this is the core proof
 *    that the limiter keys by actor.id, not by IP).
 *  - `RateLimit-Limit` / `RateLimit-Remaining` headers are correct.
 *
 * ### Point B — write limit on review/comment create routes (30 req / 1 h)
 *  - Review bucket: 30 writes pass; 31st returns 429 (mirrors I2 bug: gastronomy
 *    review returning 429 prematurely under IP-keyed limit).
 *  - Comment bucket: same semantics, independent budget from the review bucket.
 *  - The two keyPrefixes (`prot:write:review` vs `prot:write:comment`) are
 *    verified to be independent — exhausting one does NOT drain the other.
 *  - Two actors each have their own write budget.
 *
 * Clock is frozen with `vi.useFakeTimers({ toFake: ['Date'] })` for determinism.
 * The sliding-window store is cleared in beforeEach/afterEach for isolation.
 *
 * @module test/routes/protected-per-user-rate-limit
 */

// Enable rate limiting in test environment BEFORE any module imports.
process.env.HOSPEDA_TESTING_RATE_LIMIT = 'true';

// ============================================================================
// Mocks
// ============================================================================

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

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    clearSlidingWindowStore,
    createSlidingWindowPerUserRateLimit
} from '../../src/middlewares/rate-limit';
import type { AppBindings } from '../../src/types';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a minimal Hono app that mirrors the production per-user rate-limit setup:
 *  1. Inject actor via `c.set('actor', ...)` (mirrors actorMiddleware).
 *  2. Apply the sliding-window limiter (mirrors the `app.use('/api/v1/protected/*', ...)` call).
 *  3. Expose a dummy POST endpoint.
 *
 * Passing `actorId: undefined` simulates a guest (no actor in context) — the
 * limiter will fall back to IP-based keying.
 */
function buildApp(opts: {
    windowMs: number;
    max: number;
    keyPrefix: string;
    actorId?: string;
}): Hono<AppBindings> {
    const { windowMs, max, keyPrefix, actorId } = opts;
    const app = new Hono<AppBindings>();

    // Mirror: actorMiddleware sets actor before any route handler / route middleware.
    app.use('*', async (c, next) => {
        if (actorId) {
            c.set('actor', { id: actorId } as AppBindings['Variables']['actor']);
        }
        await next();
    });

    // Mirror: the `app.use('/api/v1/protected/*', createSlidingWindowPerUserRateLimit(...))` line
    // in apps/api/src/routes/index.ts.
    app.use('*', createSlidingWindowPerUserRateLimit({ windowMs, max, keyPrefix }));

    app.post('/api/v1/protected/test', (c) => c.json({ success: true }, 200));

    return app;
}

// ============================================================================
// Suite A — global per-user limit on protected routes (200 req / 60 s)
// ============================================================================

describe('Point A — per-user rate limit on /api/v1/protected/* (200 req / 60 s)', () => {
    /**
     * The sliding window is NOT tumbling-epoch-aligned (unlike the per-route
     * limiter). Freezing the clock ensures every request falls inside a single
     * deterministic window without relying on real-time progression.
     */
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
        clearSlidingWindowStore();
    });

    afterEach(() => {
        clearSlidingWindowStore();
        vi.useRealTimers();
    });

    it('should pass requests up to the limit', async () => {
        // Use max=5 for test speed; the exact 200 limit is exercised via the
        // window-reset test in sliding-window-rate-limit.test.ts.
        const app = buildApp({
            windowMs: 60_000,
            max: 5,
            keyPrefix: 'prot:user',
            actorId: 'actor-aaa'
        });

        for (let i = 0; i < 5; i++) {
            const res = await app.request('/api/v1/protected/test', { method: 'POST' });
            expect(res.status, `Request ${i + 1} should pass`).toBe(200);
        }
    });

    it('should return 429 on the (max+1)th request', async () => {
        const app = buildApp({
            windowMs: 60_000,
            max: 5,
            keyPrefix: 'prot:user',
            actorId: 'actor-bbb'
        });

        for (let i = 0; i < 5; i++) {
            await app.request('/api/v1/protected/test', { method: 'POST' });
        }

        const res = await app.request('/api/v1/protected/test', { method: 'POST' });
        expect(res.status).toBe(429);
    });

    it('should return RATE_LIMIT_EXCEEDED error code in the 429 body', async () => {
        const app = buildApp({
            windowMs: 60_000,
            max: 2,
            keyPrefix: 'prot:user',
            actorId: 'actor-ccc'
        });
        await app.request('/api/v1/protected/test', { method: 'POST' });
        await app.request('/api/v1/protected/test', { method: 'POST' });

        const res = await app.request('/api/v1/protected/test', { method: 'POST' });

        expect(res.status).toBe(429);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    /**
     * KEY PROPERTY: actor A hitting the limit does NOT block actor B, even
     * when both requests arrive from the same IP. This proves the limiter keys
     * by actor.id, not by IP.
     */
    it('should give INDEPENDENT buckets to two different actors from the same IP', async () => {
        const sharedIp = '10.0.0.1';

        // Actor A exhausts their budget.
        const appA = buildApp({
            windowMs: 60_000,
            max: 3,
            keyPrefix: 'prot:user',
            actorId: 'actor-alice'
        });
        for (let i = 0; i < 3; i++) {
            await appA.request('/api/v1/protected/test', {
                method: 'POST',
                headers: { 'X-Forwarded-For': sharedIp }
            });
        }
        const blockedA = await appA.request('/api/v1/protected/test', {
            method: 'POST',
            headers: { 'X-Forwarded-For': sharedIp }
        });
        expect(blockedA.status, 'Actor A should be rate-limited').toBe(429);

        // Actor B — same IP, different actor.id — has their own full budget.
        const appB = buildApp({
            windowMs: 60_000,
            max: 3,
            keyPrefix: 'prot:user',
            actorId: 'actor-bob'
        });
        const resB = await appB.request('/api/v1/protected/test', {
            method: 'POST',
            headers: { 'X-Forwarded-For': sharedIp }
        });
        expect(resB.status, 'Actor B from same IP should NOT be rate-limited').toBe(200);
    });

    it('should include correct RateLimit-Limit and RateLimit-Remaining headers', async () => {
        const app = buildApp({
            windowMs: 60_000,
            max: 5,
            keyPrefix: 'prot:user',
            actorId: 'actor-ddd'
        });

        const res1 = await app.request('/api/v1/protected/test', { method: 'POST' });
        expect(res1.status).toBe(200);
        expect(res1.headers.get('RateLimit-Limit')).toBe('5');
        expect(res1.headers.get('RateLimit-Remaining')).toBe('4');

        const res2 = await app.request('/api/v1/protected/test', { method: 'POST' });
        expect(res2.status).toBe(200);
        expect(res2.headers.get('RateLimit-Remaining')).toBe('3');
    });

    it('should set RateLimit-Remaining=0 and include Retry-After on the 429 response', async () => {
        const app = buildApp({
            windowMs: 60_000,
            max: 1,
            keyPrefix: 'prot:user',
            actorId: 'actor-eee'
        });
        await app.request('/api/v1/protected/test', { method: 'POST' });

        const res = await app.request('/api/v1/protected/test', { method: 'POST' });

        expect(res.status).toBe(429);
        expect(res.headers.get('RateLimit-Remaining')).toBe('0');
        expect(res.headers.get('Retry-After')).toBeDefined();
        const retryAfterSec = Number(res.headers.get('Retry-After'));
        expect(retryAfterSec).toBeGreaterThan(0);
    });
});

// ============================================================================
// Suite B — write rate limit on review/comment create routes (30 req / 1 h)
// ============================================================================

describe('Point B — write rate limit on review/comment create endpoints (30 req / 1 h)', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));
        clearSlidingWindowStore();
    });

    afterEach(() => {
        clearSlidingWindowStore();
        vi.useRealTimers();
    });

    // ── Review bucket (keyPrefix: prot:write:review) ─────────────────────────

    it('should allow exactly 30 review-create requests within the hour', async () => {
        const app = buildApp({
            windowMs: 3_600_000,
            max: 30,
            keyPrefix: 'prot:write:review',
            actorId: 'tourist-review-aaa'
        });

        for (let i = 0; i < 30; i++) {
            const res = await app.request('/api/v1/protected/test', { method: 'POST' });
            expect(res.status, `Review write ${i + 1} should pass`).toBe(200);
        }
    });

    /**
     * Regression for the I2 bug: gastronomy review create was returning 429
     * prematurely because the per-route IP-keyed limiter collapsed NAT traffic.
     * This test verifies the per-user write limiter (keyed by actor.id) fires
     * only after the 30th write within an hour.
     */
    it('should return 429 on the 31st review-create write (I2 regression: gastronomy review flow)', async () => {
        const app = buildApp({
            windowMs: 3_600_000,
            max: 30,
            keyPrefix: 'prot:write:review',
            actorId: 'tourist-review-bbb'
        });

        for (let i = 0; i < 30; i++) {
            await app.request('/api/v1/protected/test', { method: 'POST' });
        }

        const res = await app.request('/api/v1/protected/test', { method: 'POST' });

        expect(res.status).toBe(429);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    // ── Comment bucket (keyPrefix: prot:write:comment) ───────────────────────

    it('should allow exactly 30 comment-create requests within the hour', async () => {
        const app = buildApp({
            windowMs: 3_600_000,
            max: 30,
            keyPrefix: 'prot:write:comment',
            actorId: 'tourist-comment-aaa'
        });

        for (let i = 0; i < 30; i++) {
            const res = await app.request('/api/v1/protected/test', { method: 'POST' });
            expect(res.status).toBe(200);
        }

        const blocked = await app.request('/api/v1/protected/test', { method: 'POST' });
        expect(blocked.status).toBe(429);
    });

    it('should return RATE_LIMIT_EXCEEDED on the 31st comment-create write', async () => {
        const app = buildApp({
            windowMs: 3_600_000,
            max: 30,
            keyPrefix: 'prot:write:comment',
            actorId: 'tourist-comment-bbb'
        });

        for (let i = 0; i < 30; i++) {
            await app.request('/api/v1/protected/test', { method: 'POST' });
        }

        const res = await app.request('/api/v1/protected/test', { method: 'POST' });

        expect(res.status).toBe(429);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    // ── Bucket isolation: review vs comment ─────────────────────────────────

    it('should use SEPARATE buckets for reviews and comments (keyPrefix isolation)', async () => {
        // Use a small max for speed; the important thing is that separate prefixes
        // do not share a counter, regardless of the same actor.id.
        const appReview = buildApp({
            windowMs: 3_600_000,
            max: 3,
            keyPrefix: 'prot:write:review',
            actorId: 'tourist-multi'
        });
        for (let i = 0; i < 3; i++) {
            await appReview.request('/api/v1/protected/test', { method: 'POST' });
        }
        const blockedReview = await appReview.request('/api/v1/protected/test', { method: 'POST' });
        expect(blockedReview.status, 'Review bucket should be exhausted').toBe(429);

        // Same actor, different keyPrefix — comment budget is untouched.
        const appComment = buildApp({
            windowMs: 3_600_000,
            max: 3,
            keyPrefix: 'prot:write:comment',
            actorId: 'tourist-multi'
        });
        const resComment = await appComment.request('/api/v1/protected/test', { method: 'POST' });
        expect(resComment.status, 'Comment bucket should still allow writes').toBe(200);
    });

    // ── Per-actor isolation ──────────────────────────────────────────────────

    it('should give each actor their own independent write budget', async () => {
        // Actor A exhausts the review write limit.
        const appA = buildApp({
            windowMs: 3_600_000,
            max: 3,
            keyPrefix: 'prot:write:review',
            actorId: 'tourist-alice'
        });
        for (let i = 0; i < 3; i++) {
            await appA.request('/api/v1/protected/test', { method: 'POST' });
        }
        const blockedA = await appA.request('/api/v1/protected/test', { method: 'POST' });
        expect(blockedA.status, 'Actor A should be rate-limited').toBe(429);

        // Actor B has their own full budget, unaffected by actor A's writes.
        const appB = buildApp({
            windowMs: 3_600_000,
            max: 3,
            keyPrefix: 'prot:write:review',
            actorId: 'tourist-bob'
        });
        for (let i = 0; i < 3; i++) {
            const res = await appB.request('/api/v1/protected/test', { method: 'POST' });
            expect(res.status, `Actor B write ${i + 1} should pass`).toBe(200);
        }
    });
});

// ============================================================================
// Suite C — wiring guard: the per-user limiter is actually mounted in routes/index.ts
// ============================================================================

describe('Point A — wiring guard (routes/index.ts mounts the per-user limiter)', () => {
    const routesSrc = readFileSync(resolve(__dirname, '../../src/routes/index.ts'), 'utf8');

    it('mounts the per-user limiter on the /api/v1/protected/* wildcard (not another tier)', () => {
        // The middleware-level suites above mirror the wiring with a local app.use,
        // so they would stay green even if the real mount were removed or pointed at
        // the wrong tier. This anchors the actual mount PATH in routes/index.ts: the
        // limiter must be attached to the protected wildcard, with the prot:user prefix.
        expect(routesSrc).toMatch(
            /app\.use\(\s*['"]\/api\/v1\/protected\/\*['"]\s*,\s*createSlidingWindowPerUserRateLimit/
        );
        expect(routesSrc).toContain("keyPrefix: 'prot:user'");
    });
});
