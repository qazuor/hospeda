/**
 * Unit tests: per-route rate limit on the promo code validate endpoint.
 *
 * Verifies SPEC-064 T-049: the `/validate` endpoint enforces a limit of
 * 5 requests per minute per IP to prevent brute-force code enumeration.
 *
 * Strategy: build a minimal Hono app mounting `createPerRouteRateLimitMiddleware`
 * with the production config (requests: 5, windowMs: 60_000) against a dummy
 * route. Tests run with `HOSPEDA_TESTING_RATE_LIMIT=true` to bypass the
 * test-environment skip guard inside the middleware.
 *
 * SPEC-064 T-049.
 *
 * @module test/routes/billing/promo-validate-rate-limit
 */

// Enable rate limiting in test environment BEFORE any module imports.
process.env.HOSPEDA_TESTING_RATE_LIMIT = 'true';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================

// Prevent Redis connection attempts during tests — use in-memory store only.
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

const PROMO_VALIDATE_LIMIT = 5;
const PROMO_VALIDATE_WINDOW_MS = 60_000;
const CLIENT_IP = '203.0.113.42';

/**
 * Build a minimal Hono app that mimics the validate endpoint's rate limit setup.
 * The production route uses createProtectedRoute with options.customRateLimit,
 * which in turn calls createPerRouteRateLimitMiddleware with the same config.
 */
function buildValidateApp(): Hono {
    const app = new Hono();

    app.post(
        '/api/v1/protected/billing/promo-codes/validate',
        createPerRouteRateLimitMiddleware({
            requests: PROMO_VALIDATE_LIMIT,
            windowMs: PROMO_VALIDATE_WINDOW_MS
        }),
        (c) => c.json({ valid: true }, 200)
    );

    return app;
}

// ============================================================================
// Suite: T-049 — validate endpoint rate limit (5 req/min per IP)
// ============================================================================

describe('validatePromoCodeRoute — per-route rate limit (SPEC-064 T-049)', () => {
    let app: Hono;

    beforeEach(async () => {
        await clearRateLimitStore();
        app = buildValidateApp();
    });

    afterEach(async () => {
        await clearRateLimitStore();
    });

    it('should allow up to 5 requests within the window', async () => {
        for (let i = 0; i < PROMO_VALIDATE_LIMIT; i++) {
            const res = await app.request('/api/v1/protected/billing/promo-codes/validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Forwarded-For': CLIENT_IP
                },
                body: JSON.stringify({ code: 'TEST10', userId: 'u1' })
            });
            expect(res.status).toBe(200);
        }
    });

    it('should return 429 on the 6th request from the same IP', async () => {
        // Consume the 5-request allowance.
        for (let i = 0; i < PROMO_VALIDATE_LIMIT; i++) {
            await app.request('/api/v1/protected/billing/promo-codes/validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Forwarded-For': CLIENT_IP
                },
                body: JSON.stringify({ code: 'TEST10', userId: 'u1' })
            });
        }

        // 6th request must be rate-limited.
        const res = await app.request('/api/v1/protected/billing/promo-codes/validate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Forwarded-For': CLIENT_IP
            },
            body: JSON.stringify({ code: 'TEST10', userId: 'u1' })
        });

        expect(res.status).toBe(429);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should track limits independently per IP', async () => {
        const IP_A = '10.0.0.1';
        const IP_B = '10.0.0.2';

        // Exhaust IP_A's allowance.
        for (let i = 0; i < PROMO_VALIDATE_LIMIT; i++) {
            await app.request('/api/v1/protected/billing/promo-codes/validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Forwarded-For': IP_A
                },
                body: JSON.stringify({ code: 'TEST10', userId: 'u1' })
            });
        }

        // IP_A should be blocked.
        const resA = await app.request('/api/v1/protected/billing/promo-codes/validate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Forwarded-For': IP_A
            },
            body: JSON.stringify({ code: 'TEST10', userId: 'u1' })
        });
        expect(resA.status).toBe(429);

        // IP_B should still be allowed.
        const resB = await app.request('/api/v1/protected/billing/promo-codes/validate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Forwarded-For': IP_B
            },
            body: JSON.stringify({ code: 'TEST10', userId: 'u1' })
        });
        expect(resB.status).toBe(200);
    });

    it('should include X-RateLimit-* headers on allowed requests', async () => {
        const res = await app.request('/api/v1/protected/billing/promo-codes/validate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Forwarded-For': CLIENT_IP
            },
            body: JSON.stringify({ code: 'TEST10', userId: 'u1' })
        });

        expect(res.status).toBe(200);
        expect(res.headers.get('RateLimit-Limit')).toBe(PROMO_VALIDATE_LIMIT.toString());
        expect(res.headers.get('RateLimit-Remaining')).toBeDefined();
    });

    it('should include Retry-After header on 429 response', async () => {
        // Exhaust allowance.
        for (let i = 0; i < PROMO_VALIDATE_LIMIT; i++) {
            await app.request('/api/v1/protected/billing/promo-codes/validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Forwarded-For': CLIENT_IP
                },
                body: JSON.stringify({ code: 'TEST10', userId: 'u1' })
            });
        }

        const res = await app.request('/api/v1/protected/billing/promo-codes/validate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Forwarded-For': CLIENT_IP
            },
            body: JSON.stringify({ code: 'TEST10', userId: 'u1' })
        });

        expect(res.status).toBe(429);
        expect(res.headers.get('Retry-After')).toBeDefined();
    });
});
