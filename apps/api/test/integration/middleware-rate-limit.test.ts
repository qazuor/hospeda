/**
 * Rate Limiting Cross-Middleware Integration Tests
 *
 * The shared integration harness runs with rate limiting OFF
 * (`HOSPEDA_TESTING_RATE_LIMIT` unset), so the old stack tests that "hoped" to
 * see a 429 under load never saw one. This file turns it ON at env-load time
 * (`vi.hoisted` runs before any import) and pins the public tier to a small
 * ceiling, so the 429 path through the whole stack is exercised for real.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
    process.env.HOSPEDA_TESTING_RATE_LIMIT = 'true';
    process.env.API_RATE_LIMIT_PUBLIC_MAX_REQUESTS = '5';
    process.env.API_RATE_LIMIT_PUBLIC_WINDOW_MS = '60000';
    // Low on purpose: if the tiers ever shared one bucket, the public burst below
    // (LIMIT + 1 requests) would exhaust this ceiling and the admin request would 429.
    process.env.API_RATE_LIMIT_ADMIN_MAX_REQUESTS = '3';
    process.env.API_RATE_LIMIT_ADMIN_WINDOW_MS = '60000';
});

import { initApp } from '../../src/app';
import { clearCache } from '../../src/middlewares/cache';
import { getMetrics, resetMetrics } from '../../src/middlewares/metrics';
import { clearRateLimitStore } from '../../src/middlewares/rate-limit';
import { validateApiEnv } from '../../src/utils/env';

const LIMIT = 5;
/** A public-tier path no route owns: answers 404 until the limiter steps in. */
const PUBLIC_PATH = '/api/v1/public/rate-limit-probe';

const headersFor = (userAgent: string): Record<string, string> => ({
    'user-agent': userAgent,
    accept: 'application/json'
});

describe('Rate Limiting Cross-Middleware Integration', () => {
    beforeAll(() => {
        // The vars above were set before any import; re-reading and validating the env
        // here makes the dependency explicit instead of leaning on import timing.
        validateApiEnv();
    });

    beforeEach(async () => {
        await clearRateLimitStore();
        clearCache();
        resetMetrics();
    });

    it('should answer the request after the ceiling with a formatted 429', async () => {
        const app = initApp();

        for (let i = 0; i < LIMIT; i++) {
            const res = await app.request(PUBLIC_PATH, { headers: headersFor(`rate-limit-${i}`) });
            expect(res.status).toBe(404);
        }

        const limited = await app.request(PUBLIC_PATH, { headers: headersFor('rate-limit-over') });

        expect(limited.status).toBe(429);
        const data = await limited.json();
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(data.error.reason).toBe('RATE_LIMIT_EXCEEDED');
        expect(limited.headers.get('content-type')).toBe('application/json');
    });

    it('should report the exhausted budget in the rate-limit headers', async () => {
        const app = initApp();

        const first = await app.request(PUBLIC_PATH, { headers: headersFor('rate-limit-first') });
        expect(first.status).toBe(404);
        expect(first.headers.get('ratelimit-limit')).toBe(String(LIMIT));
        expect(first.headers.get('ratelimit-remaining')).toBe(String(LIMIT - 1));

        for (let i = 1; i < LIMIT; i++) {
            await app.request(PUBLIC_PATH, { headers: headersFor(`rate-limit-${i}`) });
        }
        const limited = await app.request(PUBLIC_PATH, { headers: headersFor('rate-limit-over') });

        expect(limited.status).toBe(429);
        expect(limited.headers.get('ratelimit-limit')).toBe(String(LIMIT));
        expect(limited.headers.get('ratelimit-remaining')).toBe('0');
    });

    it('should not rate limit other tiers while the public tier is exhausted', async () => {
        const app = initApp();
        for (let i = 0; i <= LIMIT; i++) {
            await app.request(PUBLIC_PATH, { headers: headersFor(`rate-limit-${i}`) });
        }

        const admin = await app.request('/api/v1/admin/accommodations', {
            headers: headersFor('rate-limit-other-tier')
        });

        expect(admin.status).toBe(401);
    });

    it('should enforce the admin ceiling on its own bucket', async () => {
        const app = initApp();
        const statuses: number[] = [];
        for (let i = 0; i < 4; i++) {
            const res = await app.request('/api/v1/admin/accommodations', {
                headers: headersFor(`rate-limit-admin-${i}`)
            });
            statuses.push(res.status);
        }

        expect(statuses).toEqual([401, 401, 401, 429]);
    });

    it('should count in the metrics exactly the requests the limiter let through', async () => {
        const app = initApp();
        for (let i = 0; i <= LIMIT; i++) {
            await app.request(PUBLIC_PATH, { headers: headersFor(`rate-limit-${i}`) });
        }

        const endpoint = getMetrics().endpoints.find(
            (item) => item.endpoint === `GET ${PUBLIC_PATH}`
        );
        expect(endpoint).toBeDefined();
        // The limiter answers the over-ceiling request itself, before metrics sees it.
        expect(endpoint?.requests).toBe(LIMIT);
        expect(endpoint?.errors).toBe(LIMIT);
    });
});
