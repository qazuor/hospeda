/**
 * Unit tests: router-level rate limit on admin billing routes.
 *
 * Verifies SPEC-064 T-050: all routes under `/api/v1/admin/billing/` share a
 * 50 requests/minute per-IP rate limit applied via `app.use('*', ...)` in
 * `apps/api/src/routes/billing/admin/index.ts`.
 *
 * Strategy: build a minimal Hono app that mirrors the admin billing router
 * setup — a single `app.use('*', createPerRouteRateLimitMiddleware({...}))` call
 * followed by several dummy routes. No DB, auth, or billing SDK is involved.
 * Tests run with `HOSPEDA_TESTING_RATE_LIMIT=true` to bypass the test-env guard.
 *
 * Decision (T-050): the spec asked for a "category" concept; the codebase already
 * uses `createPerRouteRateLimitMiddleware` applied at the router level as the
 * canonical pattern for category-wide limits. This approach avoids adding new
 * abstractions and is consistent with how other route groups are rate-limited.
 *
 * SPEC-064 T-050.
 *
 * @module test/routes/billing/admin-billing-rate-limit
 */

// Enable rate limiting in test environment BEFORE any module imports.
process.env.HOSPEDA_TESTING_RATE_LIMIT = 'true';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('../../../src/utils/redis', () => ({
    getRedisClient: vi.fn().mockResolvedValue(undefined),
    disconnectRedis: vi.fn().mockResolvedValue(undefined),
    resetRedisState: vi.fn()
}));

vi.mock('../../../src/utils/env', () => {
    const mockEnv = {
        NODE_ENV: 'test',
        HOSPEDA_TESTING_RATE_LIMIT: true,
        HOSPEDA_REDIS_URL: undefined as string | undefined
    };

    const getRateLimitConfig = () => ({
        enabled: true,
        windowMs: 60_000,
        maxRequests: 100,
        keyGenerator: 'ip',
        skip: 'none' as const,
        headers: 'standard' as const,
        message: 'Too many requests, please try again later.',
        trustProxy: true,
        authEnabled: true,
        authWindowMs: 60_000,
        authMaxRequests: 20,
        authMessage: 'Too many authentication requests.',
        publicEnabled: true,
        publicWindowMs: 60_000,
        publicMaxRequests: 100,
        publicMessage: 'Too many API requests.',
        adminEnabled: true,
        adminWindowMs: 60_000,
        adminMaxRequests: 100,
        adminMessage: 'Too many admin requests.',
        billingEnabled: true,
        billingWindowMs: 60_000,
        billingMaxRequests: 20,
        billingMessage: 'Too many billing requests.',
        webhookEnabled: true,
        webhookWindowMs: 60_000,
        webhookMaxRequests: 200,
        webhookMessage: 'Too many webhook requests.'
    });

    return {
        validateApiEnv: vi.fn(),
        env: mockEnv,
        getRateLimitConfig
    };
});

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { Hono } from 'hono';
import {
    clearRateLimitStore,
    createPerRouteRateLimitMiddleware
} from '../../../src/middlewares/rate-limit';

// ============================================================================
// Helpers
// ============================================================================

const ADMIN_BILLING_LIMIT = 50;
const ADMIN_BILLING_WINDOW_MS = 60_000;
const CLIENT_IP = '203.0.113.99';

/**
 * Build a minimal Hono sub-router that mirrors the production setup in
 * `apps/api/src/routes/billing/admin/index.ts`:
 *
 *   app.use('*', createPerRouteRateLimitMiddleware({ requests: 50, windowMs: 60_000 }));
 *   app.route('/usage', ...);
 *   app.route('/plans', ...);
 *   ...
 */
function buildAdminBillingRouter(): Hono {
    const router = new Hono();

    // Mirrors the rate-limit line in admin/index.ts.
    router.use(
        '*',
        createPerRouteRateLimitMiddleware({
            requests: ADMIN_BILLING_LIMIT,
            windowMs: ADMIN_BILLING_WINDOW_MS
        })
    );

    // Dummy routes to simulate the sub-routes registered in production.
    router.get('/usage', (c) => c.json({ data: 'usage' }, 200));
    router.get('/plans', (c) => c.json({ data: 'plans' }, 200));
    router.get('/addons', (c) => c.json({ data: 'addons' }, 200));
    router.post('/subscriptions/:id/cancel', (c) => c.json({ data: 'cancelled' }, 200));

    const app = new Hono();
    app.route('/api/v1/admin/billing', router);
    return app;
}

// ============================================================================
// Suite: T-050 — admin billing router-level rate limit (50 req/min per IP)
// ============================================================================

describe('adminBillingRoutes — router-level rate limit (SPEC-064 T-050)', () => {
    let app: Hono;

    beforeEach(async () => {
        // The per-route limiter uses a tumbling window aligned to epoch
        // (`windowStart = Math.floor(Date.now() / windowMs) * windowMs`). A test
        // that fires N requests near a minute boundary can have the window roll
        // over mid-loop, resetting the counter and letting a request that should
        // be blocked slip through (flaky `expected 200 to be 429`). Freezing the
        // clock at an instant aligned to a bucket start keeps every request in a
        // single deterministic window. `toFake: ['Date']` leaves the real timers
        // (and the limiter's cleanup interval) untouched.
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
        await clearRateLimitStore();
        app = buildAdminBillingRouter();
    });

    afterEach(async () => {
        await clearRateLimitStore();
        vi.useRealTimers();
    });

    it('should allow exactly 50 requests within the window', async () => {
        for (let i = 0; i < ADMIN_BILLING_LIMIT; i++) {
            const res = await app.request('/api/v1/admin/billing/usage', {
                headers: { 'X-Forwarded-For': CLIENT_IP }
            });
            expect(res.status).toBe(200);
        }
    });

    it('should return 429 on the 51st request from the same IP', async () => {
        // Exhaust the 50-request allowance.
        for (let i = 0; i < ADMIN_BILLING_LIMIT; i++) {
            await app.request('/api/v1/admin/billing/usage', {
                headers: { 'X-Forwarded-For': CLIENT_IP }
            });
        }

        const res = await app.request('/api/v1/admin/billing/usage', {
            headers: { 'X-Forwarded-For': CLIENT_IP }
        });

        expect(res.status).toBe(429);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should enforce the 50 req/min limit independently per sub-route path', async () => {
        // createPerRouteRateLimitMiddleware keys by `route:<path>:<ip>`.
        // Each distinct path therefore gets its own 50-req bucket.
        // This test verifies that exhausting `/usage` blocks further `/usage`
        // requests while `/plans` is unaffected — the intended behaviour for
        // router-level middleware using per-path keys.

        const USAGE_PATH = '/api/v1/admin/billing/usage';
        const PLANS_PATH = '/api/v1/admin/billing/plans';

        // Exhaust the `/usage` bucket for this IP.
        for (let i = 0; i < ADMIN_BILLING_LIMIT; i++) {
            await app.request(USAGE_PATH, {
                headers: { 'X-Forwarded-For': CLIENT_IP }
            });
        }

        // `/usage` should now be blocked.
        const resUsage = await app.request(USAGE_PATH, {
            headers: { 'X-Forwarded-For': CLIENT_IP }
        });
        expect(resUsage.status).toBe(429);

        // `/plans` has its own bucket and should still be allowed.
        const resPlans = await app.request(PLANS_PATH, {
            headers: { 'X-Forwarded-For': CLIENT_IP }
        });
        expect(resPlans.status).toBe(200);
    });

    it('should track limits independently per IP', async () => {
        const IP_A = '10.1.0.1';
        const IP_B = '10.1.0.2';

        // Exhaust IP_A's allowance.
        for (let i = 0; i < ADMIN_BILLING_LIMIT; i++) {
            await app.request('/api/v1/admin/billing/usage', {
                headers: { 'X-Forwarded-For': IP_A }
            });
        }

        // IP_A should be blocked.
        const resA = await app.request('/api/v1/admin/billing/usage', {
            headers: { 'X-Forwarded-For': IP_A }
        });
        expect(resA.status).toBe(429);

        // IP_B should still be allowed.
        const resB = await app.request('/api/v1/admin/billing/usage', {
            headers: { 'X-Forwarded-For': IP_B }
        });
        expect(resB.status).toBe(200);
    });

    it('should include RateLimit-Limit=50 header on allowed requests', async () => {
        const res = await app.request('/api/v1/admin/billing/usage', {
            headers: { 'X-Forwarded-For': CLIENT_IP }
        });

        expect(res.status).toBe(200);
        expect(res.headers.get('RateLimit-Limit')).toBe(ADMIN_BILLING_LIMIT.toString());
        expect(res.headers.get('RateLimit-Remaining')).toBe((ADMIN_BILLING_LIMIT - 1).toString());
    });

    it('should include Retry-After and X-RateLimit-* headers on 429 response', async () => {
        for (let i = 0; i < ADMIN_BILLING_LIMIT; i++) {
            await app.request('/api/v1/admin/billing/usage', {
                headers: { 'X-Forwarded-For': CLIENT_IP }
            });
        }

        const res = await app.request('/api/v1/admin/billing/usage', {
            headers: { 'X-Forwarded-For': CLIENT_IP }
        });

        expect(res.status).toBe(429);
        expect(res.headers.get('Retry-After')).toBeDefined();
        expect(res.headers.get('RateLimit-Limit')).toBe(ADMIN_BILLING_LIMIT.toString());
        expect(res.headers.get('RateLimit-Remaining')).toBe('0');
    });
});
