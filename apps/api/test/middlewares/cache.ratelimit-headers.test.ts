/**
 * @file cache.ratelimit-headers.test.ts
 * @description Regression test for H-162 (smoke agosto 2026).
 *
 * The smoke reported "the per-route rate limit does not count": 60 consecutive
 * requests to a public route all returned `ratelimit-remaining: 199` against a
 * `ratelimit-limit: 200`. Instrumenting production settled it — the limiter is
 * fine. Correlating the response header against the actual Redis counter shows:
 *
 *   cache MISS → redis {"count":1..4}   header 199 → 196   (in lockstep)
 *   cache HIT  → redis key absent       header 199 (frozen)
 *
 * On a hit the rate-limit middleware never runs at all; the response is served
 * whole from this middleware's store, and `ratelimit-*` were captured into that
 * store along with the body. Every subsequent hit replays a fossil recorded
 * when the entry was first written.
 *
 * That header is per-request state by definition, so caching it can only ever
 * produce a wrong answer. A client pacing itself by `ratelimit-remaining` reads
 * a number that stopped moving — which is exactly what made the smoke conclude
 * the limiter was broken. Serving no rate-limit header on a cached response is
 * honest; serving a stale one is not.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/env', () => ({
    getCacheConfig: vi.fn(() => ({
        enabled: true,
        defaultMaxAge: 60,
        defaultStaleWhileRevalidate: 30,
        defaultStaleIfError: 3600,
        maxAge: 60,
        staleWhileRevalidate: 30,
        staleIfError: 3600,
        etagEnabled: true,
        lastModifiedEnabled: true
    })),
    validateApiEnv: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }
}));

import { clearCache, createCacheMiddleware } from '../../src/middlewares/cache';
import { getCacheConfig } from '../../src/utils/env';

const ROUTE = '/api/v1/public/accommodations';

/**
 * Builds an app whose handler stamps per-request rate-limit headers, the way
 * `createPerRouteRateLimitMiddleware` does. `remaining` counts down on every
 * real execution, so a replayed value is immediately distinguishable from a
 * freshly computed one.
 */
function createTestApp() {
    const app = new Hono();
    let executions = 0;

    app.use('*', createCacheMiddleware());
    app.get(ROUTE, (c) => {
        executions++;
        c.header('RateLimit-Limit', '200');
        c.header('RateLimit-Remaining', String(200 - executions));
        c.header('RateLimit-Reset', '1786887360');
        c.header('X-Custom-Payload-Header', 'safe-to-cache');
        return c.json({ ok: true });
    });

    return { app, getExecutions: () => executions };
}

describe('cache middleware — rate-limit headers on cached responses (H-162)', () => {
    beforeEach(() => {
        clearCache();
        vi.clearAllMocks();
        vi.mocked(getCacheConfig).mockReturnValue({
            enabled: true,
            defaultMaxAge: 60,
            defaultStaleWhileRevalidate: 30,
            defaultStaleIfError: 3600,
            maxAge: 60,
            staleWhileRevalidate: 30,
            staleIfError: 3600,
            etagEnabled: true,
            lastModifiedEnabled: true
        } as ReturnType<typeof getCacheConfig>);
    });

    it('confirms the premise: a hit replays the body without re-running the handler', () => {
        // Guards the test itself. If this ever stops holding, the assertions
        // below would pass for the wrong reason — an always-miss cache trivially
        // never replays a stale header.
        const { app, getExecutions } = createTestApp();

        return (async () => {
            const first = await app.request(ROUTE);
            const second = await app.request(ROUTE);

            expect(first.headers.get('x-cache')).toBe('MISS');
            expect(second.headers.get('x-cache')).toBe('HIT');
            expect(getExecutions()).toBe(1);
        })();
    });

    it('does not replay a stale ratelimit-remaining from the cached entry', async () => {
        const { app } = createTestApp();

        const miss = await app.request(ROUTE);
        expect(miss.headers.get('ratelimit-remaining')).toBe('199');

        const hit = await app.request(ROUTE);
        expect(hit.headers.get('x-cache')).toBe('HIT');

        // The fossil. Before the fix this was '199' — the value computed for the
        // MISS, frozen for the whole TTL, which is what the smoke measured 60
        // times in a row and read as "the counter never moves".
        expect(hit.headers.get('ratelimit-remaining')).toBeNull();
    });

    it('drops every ratelimit-* header, not just remaining', async () => {
        const { app } = createTestApp();

        await app.request(ROUTE);
        const hit = await app.request(ROUTE);

        // `limit` and `reset` are just as per-request as `remaining`: a client
        // that reads a cached `reset` waits for a window that already closed.
        expect(hit.headers.get('ratelimit-limit')).toBeNull();
        expect(hit.headers.get('ratelimit-remaining')).toBeNull();
        expect(hit.headers.get('ratelimit-reset')).toBeNull();
    });

    it('still replays the headers that genuinely belong to the cached body', async () => {
        // The fix must be a scalpel. Dropping every header would break content
        // negotiation, ETags and caching semantics far worse than a stale
        // counter ever did.
        const { app } = createTestApp();

        await app.request(ROUTE);
        const hit = await app.request(ROUTE);

        expect(hit.headers.get('x-custom-payload-header')).toBe('safe-to-cache');
        expect(hit.headers.get('content-type')).toContain('application/json');
        expect(await hit.json()).toEqual({ ok: true });
    });

    it('leaves the fresh headers untouched on a miss', async () => {
        // The miss is the request that actually consumed quota, so its headers
        // are true and must survive verbatim.
        const { app } = createTestApp();

        const miss = await app.request(ROUTE);

        expect(miss.headers.get('x-cache')).toBe('MISS');
        expect(miss.headers.get('ratelimit-limit')).toBe('200');
        expect(miss.headers.get('ratelimit-remaining')).toBe('199');
        expect(miss.headers.get('ratelimit-reset')).toBe('1786887360');
    });
});
