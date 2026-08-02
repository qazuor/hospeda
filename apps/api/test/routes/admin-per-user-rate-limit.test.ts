/**
 * Integration tests: per-user sliding-window rate limit on admin routes (HOS-325).
 *
 * ## The bug
 *
 * `/api/v1/admin/*` was the only broad authenticated path tier with NO per-user
 * governor: one IP-keyed bucket of 200 requests / 10 min was the whole control.
 * A single operator working normally in the admin panel exhausted it and the API
 * started answering 429. (It was not the API's tightest tier in absolute terms —
 * billing POSTs and `/public/auth/*` are tighter — but it was the only broad one
 * with nothing keyed to the user.)
 *
 * The naive fix (raise the number) would have removed the only control that
 * existed. This mirrors the resolution already applied to `/api/v1/protected/*`
 * by HOS-186: add a per-USER limiter as the real governor and leave the IP
 * ceiling purely as an anti-abuse guard. An IP-keyed limit is hostile to CGNAT
 * regardless of its value — Argentine mobile carriers put thousands of users
 * behind one IP.
 *
 * The IP tier also had to be RE-CUT, not merely raised: it is a fixed window, so
 * its rate is `max / (windowMs / 60_000)`. See the calibration guard in suite B.
 *
 * ## Approach: middleware-level tests
 *
 * Same harness as `protected-per-user-rate-limit.test.ts`: a minimal Hono app
 * that injects an actor, applies the limiter under test, and exposes a dummy
 * endpoint. Wiring the real admin stack would drag in Better Auth, permission
 * middleware and all of `setupRoutes(app)` (billing, cron, Sentry side-effects)
 * for no additional coverage of the limiter itself.
 *
 * Because that harness mirrors the production wiring rather than exercising it,
 * suite B reads `routes/index.ts` and `env-config-helpers.ts` directly and
 * anchors the actual mount, its budget, and the IP-vs-per-user calibration — the
 * middleware-level suite would stay green even if the real mount were deleted or
 * pointed at the wrong tier.
 *
 * @module test/routes/admin-per-user-rate-limit
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
 * Build a minimal Hono app mirroring the production per-user admin setup:
 *  1. Inject actor via `c.set('actor', ...)` (mirrors actorMiddleware).
 *  2. Apply the sliding-window limiter (mirrors the `app.use('/api/v1/admin/*', ...)` call).
 *  3. Expose a dummy endpoint.
 *
 * Passing `actorId: undefined` simulates a guest — the limiter falls back to
 * IP-based keying.
 */
function buildApp(opts: {
    windowMs: number;
    max: number;
    keyPrefix: string;
    actorId?: string;
}): Hono<AppBindings> {
    const { windowMs, max, keyPrefix, actorId } = opts;
    const app = new Hono<AppBindings>();

    app.use('*', async (c, next) => {
        if (actorId) {
            c.set('actor', { id: actorId } as AppBindings['Variables']['actor']);
        }
        await next();
    });

    app.use('*', createSlidingWindowPerUserRateLimit({ windowMs, max, keyPrefix }));

    app.get('/api/v1/admin/test', (c) => c.json({ success: true }, 200));

    return app;
}

// ============================================================================
// Suite A — per-user limit on admin routes
// ============================================================================

describe('HOS-325 — per-user rate limit on /api/v1/admin/*', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
        clearSlidingWindowStore();
    });

    afterEach(() => {
        clearSlidingWindowStore();
        vi.useRealTimers();
    });

    it('passes requests up to the limit', async () => {
        const app = buildApp({
            windowMs: 60_000,
            max: 5,
            keyPrefix: 'admin:user',
            actorId: 'admin-aaa'
        });

        for (let i = 0; i < 5; i++) {
            const res = await app.request('/api/v1/admin/test');
            expect(res.status, `Request ${i + 1} should pass`).toBe(200);
        }
    });

    it('returns 429 RATE_LIMIT_EXCEEDED on the (max+1)th request', async () => {
        const app = buildApp({
            windowMs: 60_000,
            max: 2,
            keyPrefix: 'admin:user',
            actorId: 'admin-bbb'
        });
        await app.request('/api/v1/admin/test');
        await app.request('/api/v1/admin/test');

        const res = await app.request('/api/v1/admin/test');

        expect(res.status).toBe(429);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    /**
     * THE POINT OF THE WHOLE CHANGE: two operators behind one office NAT (or one
     * CGNAT block) must not share a budget. Under the old IP-only admin bucket
     * this was impossible — that is what made a single operator trip the limiter.
     */
    it('gives INDEPENDENT buckets to two different operators from the same IP', async () => {
        const sharedIp = '10.0.0.1';

        const appA = buildApp({
            windowMs: 60_000,
            max: 3,
            keyPrefix: 'admin:user',
            actorId: 'admin-alice'
        });
        for (let i = 0; i < 3; i++) {
            await appA.request('/api/v1/admin/test', {
                headers: { 'X-Forwarded-For': sharedIp }
            });
        }
        const blockedA = await appA.request('/api/v1/admin/test', {
            headers: { 'X-Forwarded-For': sharedIp }
        });
        expect(blockedA.status, 'Operator A should be rate-limited').toBe(429);

        const appB = buildApp({
            windowMs: 60_000,
            max: 3,
            keyPrefix: 'admin:user',
            actorId: 'admin-bob'
        });
        const resB = await appB.request('/api/v1/admin/test', {
            headers: { 'X-Forwarded-For': sharedIp }
        });
        expect(resB.status, 'Operator B from the same IP should NOT be rate-limited').toBe(200);
    });

    /**
     * The admin bucket must not share a counter with the protected one — an
     * operator who is also a normal authenticated user of the web app would
     * otherwise drain their admin budget by browsing.
     */
    it('uses a bucket separate from the protected per-user limiter', async () => {
        const appAdmin = buildApp({
            windowMs: 60_000,
            max: 3,
            keyPrefix: 'admin:user',
            actorId: 'admin-multi'
        });
        for (let i = 0; i < 3; i++) {
            await appAdmin.request('/api/v1/admin/test');
        }
        expect((await appAdmin.request('/api/v1/admin/test')).status).toBe(429);

        const appProtected = buildApp({
            windowMs: 60_000,
            max: 3,
            keyPrefix: 'prot:user',
            actorId: 'admin-multi'
        });
        expect(
            (await appProtected.request('/api/v1/admin/test')).status,
            'The protected bucket must be untouched by admin traffic'
        ).toBe(200);
    });

    it('reports the budget in RateLimit-Limit / RateLimit-Remaining headers', async () => {
        const app = buildApp({
            windowMs: 60_000,
            max: 5,
            keyPrefix: 'admin:user',
            actorId: 'admin-ddd'
        });

        const res1 = await app.request('/api/v1/admin/test');
        expect(res1.status).toBe(200);
        expect(res1.headers.get('RateLimit-Limit')).toBe('5');
        expect(res1.headers.get('RateLimit-Remaining')).toBe('4');

        const res2 = await app.request('/api/v1/admin/test');
        expect(res2.headers.get('RateLimit-Remaining')).toBe('3');
    });
});

// ============================================================================
// Suite B — wiring + calibration guards
// ============================================================================

describe('HOS-325 — wiring and calibration guards', () => {
    const routesSrc = readFileSync(resolve(__dirname, '../../src/routes/index.ts'), 'utf8');
    const envHelpersSrc = readFileSync(
        resolve(__dirname, '../../src/utils/env-config-helpers.ts'),
        'utf8'
    );
    const envSchemaSrc = readFileSync(resolve(__dirname, '../../src/utils/env-schema.ts'), 'utf8');

    it('mounts the per-user limiter on the /api/v1/admin/* wildcard', () => {
        // The middleware-level suite above mirrors the wiring with a local
        // app.use, so it would stay green if the real mount were removed. This
        // anchors the actual mount PATH.
        expect(routesSrc).toMatch(
            /app\.use\(\s*['"]\/api\/v1\/admin\/\*['"]\s*,\s*createSlidingWindowPerUserRateLimit/
        );
        expect(routesSrc).toContain("keyPrefix: 'admin:user'");
    });

    it('mounts the admin limiter before the first admin route is registered', () => {
        // Hono applies middleware in registration order, so a limiter mounted
        // after `app.route('/api/v1/admin/...')` would silently never run for
        // routes registered above it.
        const mountIndex = routesSrc.indexOf("keyPrefix: 'admin:user'");
        const firstAdminRouteIndex = routesSrc.indexOf("app.route('/api/v1/admin/");

        expect(mountIndex).toBeGreaterThan(-1);
        expect(firstAdminRouteIndex).toBeGreaterThan(-1);
        expect(mountIndex).toBeLessThan(firstAdminRouteIndex);
    });

    it('pins the per-user budget the whole change is built around', () => {
        // Without this, `max` is the one number HOS-325 introduces and nothing
        // guards it: changing the mount to max: 3 or max: 30000 would leave every
        // other test in this file green.
        // Anchor on the keyPrefix and read the options object around it, so the
        // guard survives reindentation (e.g. wrapping the mount in an `if`).
        const keyPrefixIndex = routesSrc.indexOf("keyPrefix: 'admin:user'");
        expect(keyPrefixIndex).toBeGreaterThan(-1);
        const mountBlock = routesSrc.slice(Math.max(0, keyPrefixIndex - 300), keyPrefixIndex);

        expect(mountBlock).toContain('windowMs: 60_000');
        expect(mountBlock).toContain('max: 300');
    });

    it('keeps the IP ceiling above per-user-budget x operators sharing one IP', () => {
        // THE calibration invariant, and the one that is easy to get wrong: the
        // IP tier is a FIXED window, so what matters is its rate per minute, not
        // its raw max. The first attempt at this fix set 2000/10min = 200/min
        // against a 300/min per-user budget — the IP tier stayed the binding
        // constraint and the per-user limiter could never govern anything, which
        // is precisely the defect being fixed, reproduced one tier over.
        //
        // Asserting the RELATION rather than a chosen constant is deliberate: a
        // `>= 2000` style guard passes while the invariant is violated, which
        // makes it self-confirming instead of protective.
        const ipMax = Number(
            envHelpersSrc.match(/getNumber\('API_RATE_LIMIT_ADMIN_MAX_REQUESTS',\s*(\d+)\)/)?.[1]
        );
        const ipWindowMs = Number(
            envHelpersSrc.match(/getNumber\('API_RATE_LIMIT_ADMIN_WINDOW_MS',\s*(\d+)\)/)?.[1]
        );
        const perUserMax = Number(
            routesSrc.match(/max:\s*(\d+),\s*\n\s*keyPrefix: 'admin:user'/)?.[1]
        );

        expect(ipMax).toBeGreaterThan(0);
        expect(ipWindowMs).toBeGreaterThan(0);
        expect(perUserMax).toBeGreaterThan(0);

        const ipRatePerMinute = ipMax / (ipWindowMs / 60_000);
        // Room for several operators behind one office / CGNAT egress IP before
        // the anti-abuse tier — rather than the per-user governor — starts biting.
        const MIN_OPERATORS_PER_EGRESS_IP = 5;
        expect(ipRatePerMinute).toBeGreaterThanOrEqual(perUserMax * MIN_OPERATORS_PER_EGRESS_IP);
    });

    it('keeps the Zod defaults in sync with the helper defaults', () => {
        // They are read on different paths (`env-schema` when the var is absent,
        // `env-config-helpers` at request time), so a mismatch makes the effective
        // ceiling depend on whether the var happens to be set in the environment.
        const helperMax = envHelpersSrc.match(
            /getNumber\('API_RATE_LIMIT_ADMIN_MAX_REQUESTS',\s*(\d+)\)/
        )?.[1];
        const helperWindow = envHelpersSrc.match(
            /getNumber\('API_RATE_LIMIT_ADMIN_WINDOW_MS',\s*(\d+)\)/
        )?.[1];

        expect(
            envSchemaSrc.match(
                /API_RATE_LIMIT_ADMIN_MAX_REQUESTS:\s*z\.coerce\.number\(\)\.default\((\d+)\)/
            )?.[1]
        ).toBe(helperMax);
        expect(
            envSchemaSrc.match(
                /API_RATE_LIMIT_ADMIN_WINDOW_MS:\s*z\.coerce\.number\(\)\.default\((\d+)\)/
            )?.[1]
        ).toBe(helperWindow);
    });

    it('gates the per-user limiter on the same switch as the IP tier', () => {
        // e2e disables rate limiting purely through API_RATE_LIMIT_*_ENABLED and
        // runs a PRODUCTION build (NODE_ENV !== 'test'), so a limiter that ignored
        // the flag would silently throttle parallel workers, which all share the
        // loopback IP and so share one bucket.
        expect(routesSrc).toMatch(
            /if\s*\(getRateLimitConfig\(\)\.adminEnabled\)\s*\{[\s\S]{0,400}?keyPrefix: 'admin:user'/
        );
    });
});
