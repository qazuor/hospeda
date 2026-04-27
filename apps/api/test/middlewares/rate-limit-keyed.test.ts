/// <reference types="vitest/globals" />
/**
 * Unit tests for `createKeyedRateLimitMiddleware` factory.
 *
 * Covers:
 * - keyExtractor returning null → no limiter applied (all requests pass)
 * - keyExtractor returning an email → first N succeed, N+1 returns 429 with Retry-After
 * - Different emails are rate-limited independently
 * - Same raw email in upper/lower case → same bucket (extractor normalises, hash is deterministic)
 *
 * @module test/middlewares/rate-limit-keyed
 */

import { createHash } from 'node:crypto';
import type { Context } from 'hono';
import { Hono } from 'hono';
import {
    clearRateLimitStore,
    createKeyedRateLimitMiddleware,
    resetRateLimitStore
} from '../../src/middlewares/rate-limit';

// Mock Redis so no real Redis connection is made
vi.mock('../../src/utils/redis', () => ({
    getRedisClient: vi.fn().mockResolvedValue(undefined)
}));

// Mock logger
vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn()
    }
}));

// Enable rate limiting in tests
vi.mock('../../src/utils/env', () => ({
    env: new Proxy(
        {
            NODE_ENV: 'test',
            HOSPEDA_TESTING_RATE_LIMIT: true,
            HOSPEDA_REDIS_URL: undefined
        },
        {
            get: (target, prop) => target[prop as keyof typeof target]
        }
    ),
    getRateLimitConfig: vi.fn().mockReturnValue({
        trustProxy: false
    })
}));

/** Helper: build a minimal Hono app with the given middleware and a success handler. */
function buildApp(
    keyExtractor: (c: Context) => string | null,
    requests = 3,
    windowMs = 60 * 1000
): Hono {
    const app = new Hono();

    const limiter = createKeyedRateLimitMiddleware({
        requests,
        windowMs,
        keyPrefix: 'test:keyed',
        keyExtractor
    });

    app.use(
        '*',
        limiter as unknown as (c: Context, next: () => Promise<void>) => Promise<Response>
    );
    app.get('/', (c) => c.json({ success: true }));
    app.post('/', (c) => c.json({ success: true }));

    return app;
}

/** Creates a request with the given body JSON. */
async function makeRequest(
    app: Hono,
    method: 'GET' | 'POST' = 'GET',
    headers: Record<string, string> = {}
): Promise<Response> {
    return app.request('/', {
        method,
        headers: { 'Content-Type': 'application/json', ...headers }
    });
}

describe('createKeyedRateLimitMiddleware', () => {
    beforeEach(async () => {
        resetRateLimitStore();
        await clearRateLimitStore();
    });

    // ──────────────────────────────────────────────────────────────────────────
    // keyExtractor returns null → no limiter applied
    // ──────────────────────────────────────────────────────────────────────────

    describe('when keyExtractor returns null', () => {
        it('should allow unlimited requests (limiter is a no-op)', async () => {
            // Arrange
            const app = buildApp(() => null, 2); // limit 2 but extractor always returns null

            // Act — fire 5 requests (more than the limit)
            const results: number[] = [];
            for (let i = 0; i < 5; i++) {
                const res = await makeRequest(app);
                results.push(res.status);
            }

            // Assert — all succeed because extractor returns null (no key, no limit)
            expect(results).toEqual([200, 200, 200, 200, 200]);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // keyExtractor returns email → enforces per-email limit
    // ──────────────────────────────────────────────────────────────────────────

    describe('when keyExtractor returns a fixed email', () => {
        it('should allow exactly `requests` calls and then return 429', async () => {
            // Arrange — limit 3 per window
            const email = 'guest@example.com';
            const app = buildApp(() => email.toLowerCase(), 3);

            // Act
            const statuses: number[] = [];
            for (let i = 0; i < 5; i++) {
                const res = await makeRequest(app);
                statuses.push(res.status);
            }

            // Assert — first 3 succeed, next 2 are rate-limited
            expect(statuses[0]).toBe(200);
            expect(statuses[1]).toBe(200);
            expect(statuses[2]).toBe(200);
            expect(statuses[3]).toBe(429);
            expect(statuses[4]).toBe(429);
        });

        it('should include Retry-After header on 429 response', async () => {
            // Arrange — limit 1 per window
            const app = buildApp(() => 'user@test.com', 1, 5 * 60 * 1000);

            // Act — exhaust the limit
            await makeRequest(app);
            const res = await makeRequest(app);

            // Assert
            expect(res.status).toBe(429);
            const retryAfter = res.headers.get('Retry-After');
            expect(retryAfter).not.toBeNull();
            expect(Number(retryAfter)).toBeGreaterThan(0);
        });

        it('should include reason RATE_LIMIT_EXCEEDED in the response body', async () => {
            // Arrange
            const app = buildApp(() => 'user@test.com', 1);

            // Act — exhaust limit
            await makeRequest(app);
            const res = await makeRequest(app);
            const body = (await res.json()) as { success: boolean; error: { reason?: string } };

            // Assert
            expect(res.status).toBe(429);
            expect(body.success).toBe(false);
            expect(body.error.reason).toBe('RATE_LIMIT_EXCEEDED');
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Different emails are rate-limited independently
    // ──────────────────────────────────────────────────────────────────────────

    describe('independent buckets per email', () => {
        it('should rate-limit each email independently', async () => {
            // Arrange — limit 2 per window, extractor reads x-email header
            const app = buildApp((c: Context) => {
                const email = c.req.header('x-email');
                return email ? email.toLowerCase() : null;
            }, 2);

            // Act — exhaust limit for user-a, user-b should still be allowed
            await makeRequest(app, 'GET', { 'x-email': 'a@example.com' });
            await makeRequest(app, 'GET', { 'x-email': 'a@example.com' });
            const thirdA = await makeRequest(app, 'GET', { 'x-email': 'a@example.com' });

            const firstB = await makeRequest(app, 'GET', { 'x-email': 'b@example.com' });

            // Assert
            expect(thirdA.status).toBe(429); // a is rate-limited
            expect(firstB.status).toBe(200); // b is not
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Case-insensitive bucketing (extractor must normalise before returning)
    // ──────────────────────────────────────────────────────────────────────────

    describe('case-insensitive email bucketing', () => {
        it('should treat upper-case and lower-case emails as the same bucket', async () => {
            // The extractor lowercases the email, so SHA-256 of "user@example.com"
            // is the same regardless of how the caller capitalised it.
            const app = buildApp((c: Context) => {
                const raw = c.req.header('x-email') ?? '';
                return raw.toLowerCase().trim() || null;
            }, 2);

            // Act — send with mixed-case variations of the same address
            await makeRequest(app, 'GET', { 'x-email': 'User@Example.COM' });
            await makeRequest(app, 'GET', { 'x-email': 'user@example.com' });
            const third = await makeRequest(app, 'GET', { 'x-email': 'USER@EXAMPLE.COM' });

            // Assert — all three map to the same bucket → third is 429
            expect(third.status).toBe(429);
        });

        it('SHA-256 of lowercased key is deterministic across runs', () => {
            // Arrange
            const email = 'test@hospeda.com';
            const normalized = email.toLowerCase().trim();

            // Act
            const hash1 = createHash('sha256').update(normalized).digest('hex');
            const hash2 = createHash('sha256').update(normalized).digest('hex');

            // Assert
            expect(hash1).toBe(hash2);
            expect(hash1).toHaveLength(64); // SHA-256 hex is always 64 chars
        });
    });
});
