/**
 * @file rate-limit-session-read.guard.test.ts
 * @description HOS-1153 guard — session READS must never fall back into the
 * anti-brute-force `auth` bucket.
 *
 * ## Why this guard exists
 *
 * `auth` is a deliberately tight tier (50 requests / 5 min per IP) whose whole
 * purpose is to cap *authentication attempts*: `POST sign-in`, `sign-up`,
 * password reset. Session *reads* — `GET /api/auth/get-session`,
 * `GET /api/v1/public/auth/me`, `GET /api/v1/public/auth/status` — accept no
 * credential and are fired dozens of times per normal session by any signed-in
 * client (the admin panel issues two of them on every route `beforeLoad`).
 * While both lived in one bucket, ordinary navigation exhausted the
 * brute-force budget and the API answered 429 after a handful of clicks.
 *
 * HOS-325 tried to fix the same SYMPTOM by widening `/api/v1/admin/*` — the
 * wrong bucket, because the header the middleware itself emits
 * (`x-ratelimit-type`) said `auth`. This guard pins the classification so the
 * next attempt cannot silently re-aim at the wrong tier.
 *
 * ## What it actually verifies
 *
 * The specification list below is written out HERE, independently of whatever
 * constant the middleware happens to use, so this file is a specification and
 * not a mirror of the implementation.
 *
 * The distinction under test is **GET-of-read vs POST-of-attempt**, not the
 * path prefix: a POST to a session-read path is an attempt and must stay in
 * `auth`, and a GET to a non-session-read auth path (`reset-password/check`)
 * must ALSO stay in `auth`. A guard that looked only at the prefix, or only at
 * the method, would pass while putting everything back in one bucket.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Rate limiting is skipped in NODE_ENV=test unless this is set.
process.env.HOSPEDA_TESTING_RATE_LIMIT = 'true';

vi.mock('../../src/utils/redis', () => ({
    getRedisClient: vi.fn().mockResolvedValue(undefined),
    disconnectRedis: vi.fn().mockResolvedValue(undefined),
    resetRedisState: vi.fn()
}));

/**
 * Deliberately tiny, clearly DIFFERENT budgets for the two tiers so an
 * assertion can tell them apart by behaviour alone:
 *   - `auth`              → 2 requests / 1 s window
 *   - `auth-session-read` → 6 requests / 1 s window
 *
 * If the session-read tier ever collapses back into `auth`, the read budget
 * silently becomes 2 and the isolation tests below go red.
 */
vi.mock('../../src/utils/env', () => {
    const mockEnv = {
        NODE_ENV: 'test',
        HOSPEDA_TESTING_RATE_LIMIT: true,
        HOSPEDA_REDIS_URL: undefined as string | undefined,
        HOSPEDA_INTERNAL_REQUEST_SECRET: ''
    };

    const getRateLimitConfig = () => ({
        enabled: true,
        windowMs: 1000,
        maxRequests: 50,
        keyGenerator: 'ip',
        skip: 'none' as const,
        headers: 'legacy' as const,
        message: 'Too many requests, please try again later.',
        trustProxy: true,
        trustedProxies: [] as readonly string[],

        authEnabled: true,
        authWindowMs: 1000,
        authMaxRequests: 2,
        authMessage: 'Too many authentication requests, please try again later.',

        authSessionReadEnabled: true,
        authSessionReadWindowMs: 1000,
        authSessionReadMaxRequests: 6,
        authSessionReadMessage: 'Too many session checks, please try again later.',

        publicEnabled: true,
        publicWindowMs: 1000,
        publicMaxRequests: 50,
        publicMessage: 'Too many API requests, please try again later.',

        adminEnabled: true,
        adminWindowMs: 1000,
        adminMaxRequests: 50,
        adminMessage: 'Too many admin requests, please try again later.',

        protectedEnabled: true,
        protectedWindowMs: 1000,
        protectedMaxRequests: 50,
        protectedMessage: 'Too many requests, please try again later.',

        billingEnabled: true,
        billingWindowMs: 1000,
        billingMaxRequests: 50,
        billingMessage: 'Too many billing requests, please try again later.',

        webhookEnabled: true,
        webhookWindowMs: 1000,
        webhookMaxRequests: 50,
        webhookMessage: 'Too many webhook requests, please try again later.'
    });

    return {
        validateApiEnv: vi.fn(),
        env: mockEnv,
        getRateLimitConfig
    };
});

import { Hono } from 'hono';
import {
    clearRateLimitStore,
    getEndpointType,
    rateLimitMiddleware
} from '../../src/middlewares/rate-limit';

/**
 * The SPECIFICATION: every endpoint whose GET form is a session read.
 *
 * Written here rather than imported so this file constrains the middleware
 * instead of restating it. Adding a new session-read endpoint means adding it
 * to BOTH this list and the middleware.
 */
const SESSION_READ_ENDPOINTS: readonly string[] = [
    // Better Auth's own session lookup — the admin and the web both poll it.
    '/api/auth/get-session',
    // The actor/roles/permissions snapshot every authenticated surface reads.
    '/api/v1/public/auth/me',
    // The lightweight "am I signed in?" probe.
    '/api/v1/public/auth/status'
];

/**
 * Authentication ATTEMPTS: these accept a credential, so the tight
 * anti-brute-force ceiling is exactly right for them and must not move.
 */
const AUTH_ATTEMPT_ENDPOINTS: readonly { readonly path: string; readonly method: string }[] = [
    { path: '/api/auth/sign-in/email', method: 'POST' },
    { path: '/api/auth/sign-up/email', method: 'POST' },
    { path: '/api/auth/forget-password', method: 'POST' },
    { path: '/api/auth/reset-password', method: 'POST' },
    { path: '/api/v1/public/auth/signout', method: 'POST' },
    { path: '/api/v1/protected/auth/change-password', method: 'POST' }
];

/** Client IP header used by every request here (trusted-proxy path). */
const IP = { 'X-Forwarded-For': '203.0.113.7' } as const;

/**
 * Hono app wired exactly like production: the global rate limiter first, then
 * catch-all handlers so any path/method combination resolves to a 200.
 */
const buildApp = (): Hono => {
    const app = new Hono();
    app.use('*', rateLimitMiddleware);
    app.all('*', (c) => c.json({ ok: true }));
    return app;
};

describe('HOS-1153 guard — session reads do not share the `auth` bucket', () => {
    let app: Hono;

    beforeEach(async () => {
        await clearRateLimitStore();
        // Freeze the clock: the fixed-window counter resets on a boundary, and
        // a slow runner straddling one would mask the 429 these tests require.
        vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00.000Z').getTime(), toFake: ['Date'] });
        app = buildApp();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('classification', () => {
        for (const path of SESSION_READ_ENDPOINTS) {
            it(`classifies GET ${path} out of the \`auth\` bucket`, () => {
                // Act
                const result = getEndpointType(path, 'GET');

                // Assert
                expect(
                    result,
                    `GET ${path} is a session read: it accepts no credential, yet it was classified as \`${result}\`. While it shares the \`auth\` tier it spends the anti-brute-force budget on ordinary navigation (HOS-1153).`
                ).not.toBe('auth');
                expect(result).toBe('auth-session-read');
            });

            it(`keeps POST ${path} in the \`auth\` bucket (method, not prefix, is the distinction)`, () => {
                // Act
                const result = getEndpointType(path, 'POST');

                // Assert
                expect(
                    result,
                    `POST ${path} is an attempt, not a read. Classifying it as \`${result}\` would move a credential-accepting method out of the anti-brute-force tier.`
                ).toBe('auth');
            });
        }

        for (const { path, method } of AUTH_ATTEMPT_ENDPOINTS) {
            it(`keeps ${method} ${path} in the \`auth\` bucket`, () => {
                // Act
                const result = getEndpointType(path, method);

                // Assert
                expect(result).toBe('auth');
            });
        }

        it('keeps GET /api/v1/public/auth/reset-password/check in the `auth` bucket', () => {
            // Arrange: a GET under an auth prefix that is NOT a session read —
            // it probes a reset token, so it stays brute-forceable and keeps the
            // tight ceiling. A guard that read the method alone would miss this.
            const result = getEndpointType('/api/v1/public/auth/reset-password/check', 'GET');

            // Assert
            expect(result).toBe('auth');
        });

        it('does not leak the session-read tier to a path that merely starts with one', () => {
            // Arrange: exact-match classification, not prefix matching.
            const result = getEndpointType('/api/v1/public/auth/menu', 'GET');

            // Assert
            expect(result).toBe('auth');
        });

        for (const path of SESSION_READ_ENDPOINTS) {
            it(`classifies GET ${path}/ (trailing slash) as a session read too`, () => {
                // Arrange: exact-set membership is only safe because the path is
                // normalised first. Without that step a trailing slash silently
                // drops the request back into the anti-brute-force bucket — the
                // exact regression this file exists to prevent. Neutralising the
                // normaliser to the identity survived 80 green tests until this
                // case existed.
                const result = getEndpointType(`${path}/`, 'GET');

                // Assert
                expect(
                    result,
                    `GET ${path}/ landed in \`${result}\`. A trailing slash must not change which budget a session read spends.`
                ).toBe('auth-session-read');
            });
        }

        it('classifies a lower-case "get" as a session read (the method is normalised)', () => {
            // Arrange: Hono upper-cases `c.req.method` before the middleware
            // calls in, so the normalisation inside `getEndpointType` is only
            // exercised by direct callers — tests, guards, future call sites.
            // Dropping it must not silently re-route a read into `auth`.
            const result = getEndpointType('/api/v1/public/auth/me', 'get');

            // Assert
            expect(result).toBe('auth-session-read');
        });

        it('still keeps a lower-case "post" to a session-read path in `auth`', () => {
            // Arrange: the mixed case for that normalisation — normalising the
            // method must not turn every method into a read.
            const result = getEndpointType('/api/v1/public/auth/me', 'post');

            // Assert
            expect(result).toBe('auth');
        });
    });

    describe('x-ratelimit-type header (what the middleware actually applied)', () => {
        for (const path of SESSION_READ_ENDPOINTS) {
            it(`reports auth-session-read for GET ${path}`, async () => {
                // Act
                const res = await app.request(path, { method: 'GET', headers: { ...IP } });

                // Assert
                expect(res.status).toBe(200);
                expect(res.headers.get('X-RateLimit-Type')).toBe('auth-session-read');
            });
        }

        it('reports auth for POST /api/auth/sign-in/email', async () => {
            // Act
            const res = await app.request('/api/auth/sign-in/email', {
                method: 'POST',
                headers: { ...IP }
            });

            // Assert
            expect(res.status).toBe(200);
            expect(res.headers.get('X-RateLimit-Type')).toBe('auth');
        });
    });

    describe('budget isolation', () => {
        it('a GET /api/v1/public/auth/me does NOT consume the auth budget', async () => {
            // Arrange: burn the whole auth budget (2) with real sign-in attempts.
            for (let i = 0; i < 2; i++) {
                const res = await app.request('/api/auth/sign-in/email', {
                    method: 'POST',
                    headers: { ...IP }
                });
                expect(res.status).toBe(200);
            }
            const exhausted = await app.request('/api/auth/sign-in/email', {
                method: 'POST',
                headers: { ...IP }
            });
            expect(exhausted.status).toBe(429);

            // Act: the same IP now reads its session.
            const read = await app.request('/api/v1/public/auth/me', {
                method: 'GET',
                headers: { ...IP }
            });

            // Assert
            expect(
                read.status,
                'A signed-in client was refused a session read because sign-in attempts had drained the shared bucket — the exact HOS-1153 failure.'
            ).toBe(200);
        });

        it('session reads do NOT drain the auth budget for a later sign-in', async () => {
            // Arrange: 6 session reads — three times the auth budget.
            for (let i = 0; i < 6; i++) {
                const res = await app.request('/api/auth/get-session', {
                    method: 'GET',
                    headers: { ...IP }
                });
                expect(res.status).toBe(200);
            }

            // Act
            const signIn = await app.request('/api/auth/sign-in/email', {
                method: 'POST',
                headers: { ...IP }
            });

            // Assert
            expect(signIn.status).toBe(200);
            expect(signIn.headers.get('X-RateLimit-Type')).toBe('auth');
        });

        it('still caps session reads — the new tier is a ceiling, not an exemption', async () => {
            // Arrange: spend the session-read budget (6).
            for (let i = 0; i < 6; i++) {
                const res = await app.request('/api/v1/public/auth/me', {
                    method: 'GET',
                    headers: { ...IP }
                });
                expect(res.status).toBe(200);
            }

            // Act
            const over = await app.request('/api/v1/public/auth/me', {
                method: 'GET',
                headers: { ...IP }
            });

            // Assert
            expect(over.status).toBe(429);
            expect(over.headers.get('X-RateLimit-Type')).toBe('auth-session-read');
        });

        it('keeps the anti-brute-force ceiling intact for sign-in attempts', async () => {
            // Arrange
            for (let i = 0; i < 2; i++) {
                await app.request('/api/auth/sign-in/email', {
                    method: 'POST',
                    headers: { ...IP }
                });
            }

            // Act
            const over = await app.request('/api/auth/sign-in/email', {
                method: 'POST',
                headers: { ...IP }
            });

            // Assert
            expect(over.status).toBe(429);
            expect(over.headers.get('X-RateLimit-Type')).toBe('auth');
        });
    });
});
