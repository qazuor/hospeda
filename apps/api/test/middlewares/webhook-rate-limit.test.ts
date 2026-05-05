/**
 * Per-route rate limit tests for the MercadoPago webhook endpoint.
 *
 * Verifies that the `createPerRouteRateLimitMiddleware` applied in
 * `router.ts` returns HTTP 429 when a single IP exceeds the configured
 * threshold within the sliding window.
 *
 * SPEC-064 T-049 / T-050.
 *
 * @module test/middlewares/webhook-rate-limit
 */

// Enable rate limiting for this test file
process.env.HOSPEDA_TESTING_RATE_LIMIT = 'true';

// Mock Redis so tests run in-memory
import { vi } from 'vitest';
vi.mock('../../src/utils/redis', () => ({
    getRedisClient: vi.fn().mockResolvedValue(undefined),
    disconnectRedis: vi.fn().mockResolvedValue(undefined),
    resetRedisState: vi.fn()
}));

// Minimal env mock — only the fields consumed by rate-limit.ts
vi.mock('../../src/utils/env', () => {
    const getRateLimitConfig = () => ({
        enabled: true,
        windowMs: 60_000,
        maxRequests: 200,
        keyGenerator: 'ip',
        skip: 'none' as const,
        headers: 'standard' as const,
        message: 'Too many requests.',
        trustProxy: true,

        authEnabled: false,
        authWindowMs: 60_000,
        authMaxRequests: 10,
        authMessage: '',

        publicEnabled: false,
        publicWindowMs: 60_000,
        publicMaxRequests: 200,
        publicMessage: '',

        adminEnabled: false,
        adminWindowMs: 60_000,
        adminMaxRequests: 200,
        adminMessage: '',

        billingEnabled: false,
        billingWindowMs: 60_000,
        billingMaxRequests: 200,
        billingMessage: '',

        webhookEnabled: true,
        webhookWindowMs: 60_000,
        webhookMaxRequests: 200,
        webhookMessage: 'Too many webhook requests.'
    });

    return {
        validateApiEnv: vi.fn(),
        getRateLimitConfig,
        env: {
            NODE_ENV: 'test',
            HOSPEDA_TESTING_RATE_LIMIT: true,
            HOSPEDA_REDIS_URL: undefined
        }
    };
});

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    clearRateLimitStore,
    createPerRouteRateLimitMiddleware
} from '../../src/middlewares/rate-limit';

/**
 * Build a minimal Hono app that applies a per-route rate limiter with a
 * very small threshold so tests stay fast without sleeping for a full minute.
 *
 * @param limit - Maximum requests allowed per window
 * @param windowMs - Window duration in milliseconds
 */
function buildWebhookApp({
    limit,
    windowMs
}: {
    readonly limit: number;
    readonly windowMs: number;
}): Hono {
    const app = new Hono();
    app.use('*', createPerRouteRateLimitMiddleware({ requests: limit, windowMs }));
    app.post('/api/v1/webhooks/mercadopago', (c) => c.json({ ok: true }));
    return app;
}

describe('MercadoPago webhook per-route rate limit (SPEC-064 T-049/T-050)', () => {
    const CLIENT_IP = '10.0.0.1';
    const PATH = '/api/v1/webhooks/mercadopago';

    beforeEach(async () => {
        await clearRateLimitStore();
    });

    afterEach(async () => {
        await clearRateLimitStore();
    });

    it('should allow requests up to the configured limit', async () => {
        // Arrange — limit of 3 per window
        const app = buildWebhookApp({ limit: 3, windowMs: 60_000 });

        // Act + Assert — all 3 must pass
        for (let i = 0; i < 3; i++) {
            const res = await app.request(PATH, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Forwarded-For': CLIENT_IP
                },
                body: JSON.stringify({ data: { id: `evt-${i}` } })
            });
            expect(res.status).toBe(200);
        }
    });

    it('should return 429 on the request exceeding the limit (101st of 100)', async () => {
        // Arrange — mirror production threshold (100 req/min)
        const PRODUCTION_LIMIT = 100;
        const app = buildWebhookApp({ limit: PRODUCTION_LIMIT, windowMs: 60_000 });

        // Act — send exactly PRODUCTION_LIMIT requests (all should pass)
        for (let i = 0; i < PRODUCTION_LIMIT; i++) {
            const res = await app.request(PATH, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Forwarded-For': CLIENT_IP
                },
                body: JSON.stringify({ data: { id: `evt-${i}` } })
            });
            expect(res.status).toBe(200);
        }

        // Assert — 101st request must be throttled
        const blocked = await app.request(PATH, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Forwarded-For': CLIENT_IP
            },
            body: JSON.stringify({ data: { id: 'evt-over-limit' } })
        });

        expect(blocked.status).toBe(429);
        const body = (await blocked.json()) as { success: boolean; error: { code: string } };
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should isolate rate limit buckets per IP address', async () => {
        // Arrange — limit of 2 per window
        const app = buildWebhookApp({ limit: 2, windowMs: 60_000 });

        // First IP exhausts its bucket
        for (let i = 0; i < 2; i++) {
            await app.request(PATH, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '1.2.3.4' },
                body: JSON.stringify({ data: { id: `a-${i}` } })
            });
        }
        const blockedFirst = await app.request(PATH, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '1.2.3.4' },
            body: JSON.stringify({ data: { id: 'a-over' } })
        });
        expect(blockedFirst.status).toBe(429);

        // Second IP should still have a full fresh bucket
        const secondIp = await app.request(PATH, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '5.6.7.8' },
            body: JSON.stringify({ data: { id: 'b-first' } })
        });
        expect(secondIp.status).toBe(200);
    });

    it('should include RateLimit headers on throttled responses', async () => {
        // Arrange — very tight limit
        const app = buildWebhookApp({ limit: 1, windowMs: 60_000 });

        // First request passes
        await app.request(PATH, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': CLIENT_IP },
            body: JSON.stringify({ data: { id: 'first' } })
        });

        // Act — second request is throttled
        const res = await app.request(PATH, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': CLIENT_IP },
            body: JSON.stringify({ data: { id: 'second' } })
        });

        // Assert headers are present on the 429 response
        expect(res.status).toBe(429);
        expect(res.headers.get('RateLimit-Limit')).toBe('1');
        expect(res.headers.get('RateLimit-Remaining')).toBe('0');
        expect(res.headers.get('Retry-After')).toBeTruthy();
    });
});
