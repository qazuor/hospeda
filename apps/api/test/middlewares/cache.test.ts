/**
 * Cache Middleware Tests
 * Tests the in-memory cache with TTL, eviction, and X-Cache headers
 */
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock environment before importing the module
vi.mock('../../src/utils/env', () => ({
    getCacheConfig: vi.fn(() => ({
        enabled: true,
        maxAge: 60,
        staleWhileRevalidate: 30,
        staleIfError: 3600,
        etagEnabled: true,
        lastModifiedEnabled: true
    })),
    validateApiEnv: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        error: vi.fn()
    }
}));

import { clearCache, createCacheMiddleware, getCacheSize } from '../../src/middlewares/cache';
import { getCacheConfig } from '../../src/utils/env';
import { apiLogger } from '../../src/utils/logger';

/**
 * Creates a Hono test app with the cache middleware and a test route.
 */
function createTestApp({
    route = '/api/v1/public/accommodations'
}: {
    readonly route?: string;
} = {}) {
    const middleware = createCacheMiddleware();
    const app = new Hono();
    let callCount = 0;

    app.use('*', middleware);
    app.get(route, (c) => {
        callCount++;
        return c.json({ data: 'test', callCount });
    });

    // Add a 404-producing route
    app.get('/api/v1/public/accommodations/not-found', (c) => {
        callCount++;
        return c.json({ error: 'not found' }, 404);
    });

    // Add a 500-producing route
    app.get('/api/v1/public/accommodations/error', (c) => {
        callCount++;
        return c.json({ error: 'server error' }, 500);
    });

    return { app, getCallCount: () => callCount };
}

describe('Cache Middleware', () => {
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
        });
    });

    afterEach(() => {
        clearCache();
    });

    describe('Cache Disabled', () => {
        it('should return pass-through middleware when cache is disabled', async () => {
            vi.mocked(getCacheConfig).mockReturnValue({
                enabled: false,
                defaultMaxAge: 60,
                defaultStaleWhileRevalidate: 30,
                defaultStaleIfError: 3600,
                maxAge: 60,
                staleWhileRevalidate: 30,
                staleIfError: 3600,
                etagEnabled: true,
                lastModifiedEnabled: true
            });

            const { app, getCallCount } = createTestApp();

            const res1 = await app.request('/api/v1/public/accommodations');
            const res2 = await app.request('/api/v1/public/accommodations');

            expect(res1.status).toBe(200);
            expect(res2.status).toBe(200);
            // Both requests hit the handler because cache is disabled
            expect(getCallCount()).toBe(2);
            // No X-Cache header when disabled
            expect(res1.headers.get('X-Cache')).toBeNull();
        });
    });

    describe('Cache Hit and Miss', () => {
        it('should return MISS on first request and HIT on second', async () => {
            const { app, getCallCount } = createTestApp();

            const res1 = await app.request('/api/v1/public/accommodations');
            expect(res1.status).toBe(200);
            expect(res1.headers.get('X-Cache')).toBe('MISS');
            expect(getCallCount()).toBe(1);

            const res2 = await app.request('/api/v1/public/accommodations');
            expect(res2.status).toBe(200);
            expect(res2.headers.get('X-Cache')).toBe('HIT');
            // Handler was NOT called again
            expect(getCallCount()).toBe(1);

            // Body should be identical
            const body1 = await res1.json();
            const body2 = await res2.json();
            expect(body1.data).toBe('test');
            expect(body2.data).toBe('test');
        });

        it('should cache 404 responses', async () => {
            const { app, getCallCount } = createTestApp();

            const res1 = await app.request('/api/v1/public/accommodations/not-found');
            expect(res1.status).toBe(404);
            expect(res1.headers.get('X-Cache')).toBe('MISS');

            const res2 = await app.request('/api/v1/public/accommodations/not-found');
            expect(res2.status).toBe(404);
            expect(res2.headers.get('X-Cache')).toBe('HIT');
            expect(getCallCount()).toBe(1);
        });

        it('should NOT cache 500 responses', async () => {
            const { app, getCallCount } = createTestApp();

            const res1 = await app.request('/api/v1/public/accommodations/error');
            expect(res1.status).toBe(500);
            expect(res1.headers.get('X-Cache')).toBe('MISS');

            const res2 = await app.request('/api/v1/public/accommodations/error');
            expect(res2.status).toBe(500);
            expect(res2.headers.get('X-Cache')).toBe('MISS');
            // Both requests hit the handler
            expect(getCallCount()).toBe(2);
        });
    });

    describe('Only GET Requests Are Cached', () => {
        it('should not cache POST requests', async () => {
            const middleware = createCacheMiddleware();
            const app = new Hono();
            let callCount = 0;

            app.use('*', middleware);
            app.post('/api/v1/public/accommodations', (c) => {
                callCount++;
                return c.json({ created: true });
            });

            const res1 = await app.request('/api/v1/public/accommodations', { method: 'POST' });
            const res2 = await app.request('/api/v1/public/accommodations', { method: 'POST' });

            expect(res1.status).toBe(200);
            expect(res2.status).toBe(200);
            // No X-Cache header for non-GET requests
            expect(res1.headers.get('X-Cache')).toBeNull();
            expect(callCount).toBe(2);
        });
    });

    describe('Endpoint Classification', () => {
        it('should cache public endpoints', async () => {
            const { app, getCallCount } = createTestApp();

            await app.request('/api/v1/public/accommodations');
            await app.request('/api/v1/public/accommodations');
            expect(getCallCount()).toBe(1);
        });

        it('should cache the public authors endpoint (HOS-375 T-013)', async () => {
            // `/api/v1/public/authors` must resolve to the PUBLIC bucket, not
            // fall through unclassified (uncached) or under the PRIVATE
            // `/api/v1/public/users` prefix — the payload is actor-blind and
            // must be shared-cacheable at the edge.
            const { app, getCallCount } = createTestApp({ route: '/api/v1/public/authors' });

            const res1 = await app.request('/api/v1/public/authors');
            expect(res1.headers.get('X-Cache')).toBe('MISS');

            const res2 = await app.request('/api/v1/public/authors');
            expect(res2.headers.get('X-Cache')).toBe('HIT');
            expect(getCallCount()).toBe(1);
        });

        it('should NOT cache no-cache endpoints', async () => {
            const middleware = createCacheMiddleware();
            const app = new Hono();
            let callCount = 0;

            app.use('*', middleware);
            app.get('/health/db', (c) => {
                callCount++;
                return c.json({ status: 'ok' });
            });

            await app.request('/health/db');
            await app.request('/health/db');
            // Both requests hit the handler
            expect(callCount).toBe(2);
        });

        it('should NOT cache unclassified endpoints', async () => {
            const middleware = createCacheMiddleware();
            const app = new Hono();
            let callCount = 0;

            app.use('*', middleware);
            app.get('/api/v1/unknown', (c) => {
                callCount++;
                return c.json({ data: 'unknown' });
            });

            await app.request('/api/v1/unknown');
            await app.request('/api/v1/unknown');
            expect(callCount).toBe(2);
        });

        it('should never cache private endpoints for a request with an auth token (HOS-1923)', async () => {
            const middleware = createCacheMiddleware();
            const app = new Hono();
            let callCount = 0;

            app.use('*', middleware);
            app.get('/api/v1/public/users', (c) => {
                callCount++;
                return c.json({ user: 'data', callCount });
            });

            const request = () =>
                app.request('/api/v1/public/users', {
                    headers: { Authorization: 'Bearer token-a' }
                });

            const res1 = await request();
            const res2 = await request();

            // Credentials bypass the cache entirely: both runs reach the handler.
            expect(res1.headers.get('X-Cache')).toBe('BYPASS');
            expect(res2.headers.get('X-Cache')).toBe('BYPASS');
            expect(callCount).toBe(2);
            expect(getCacheSize()).toBe(0);
        });

        it('should use "anonymous" key for private endpoints without auth header', async () => {
            const middleware = createCacheMiddleware();
            const app = new Hono();
            let callCount = 0;

            app.use('*', middleware);
            app.get('/api/v1/public/users', (c) => {
                callCount++;
                return c.json({ user: 'anon' });
            });

            await app.request('/api/v1/public/users');
            const res2 = await app.request('/api/v1/public/users');

            expect(res2.headers.get('X-Cache')).toBe('HIT');
            expect(callCount).toBe(1);
        });
    });

    describe('TTL Expiration', () => {
        it('should expire cached entries after TTL', async () => {
            // Use a very short TTL for testing
            vi.mocked(getCacheConfig).mockReturnValue({
                enabled: true,
                defaultMaxAge: 0,
                defaultStaleWhileRevalidate: 0,
                defaultStaleIfError: 0,
                maxAge: 0, // 0 seconds = immediate expiry
                staleWhileRevalidate: 0,
                staleIfError: 0,
                etagEnabled: true,
                lastModifiedEnabled: true
            });

            const { app, getCallCount } = createTestApp();

            await app.request('/api/v1/public/accommodations');
            expect(getCallCount()).toBe(1);

            // Wait a tiny bit for the TTL to expire (0 seconds TTL = 0ms)
            await new Promise((resolve) => setTimeout(resolve, 5));

            const res2 = await app.request('/api/v1/public/accommodations');
            expect(res2.headers.get('X-Cache')).toBe('MISS');
            expect(getCallCount()).toBe(2);
        });
    });

    describe('LRU Eviction', () => {
        it('should track cache size via getCacheSize', async () => {
            const { app } = createTestApp({ route: '/api/v1/public/accommodations/:id' });

            expect(getCacheSize()).toBe(0);

            await app.request('/api/v1/public/accommodations/1');
            expect(getCacheSize()).toBe(1);

            await app.request('/api/v1/public/accommodations/2');
            expect(getCacheSize()).toBe(2);

            // Same request should not increase size
            await app.request('/api/v1/public/accommodations/1');
            expect(getCacheSize()).toBe(2);
        });

        it('should clear cache with clearCache', async () => {
            const { app } = createTestApp({ route: '/api/v1/public/accommodations/:id' });

            await app.request('/api/v1/public/accommodations/1');
            await app.request('/api/v1/public/accommodations/2');
            expect(getCacheSize()).toBe(2);

            clearCache();
            expect(getCacheSize()).toBe(0);
        });
    });

    describe('Nested Paths', () => {
        it('should handle nested paths under public endpoints', async () => {
            const { app, getCallCount } = createTestApp({
                route: '/api/v1/public/accommodations/:id/details'
            });

            await app.request('/api/v1/public/accommodations/123/details');
            const res2 = await app.request('/api/v1/public/accommodations/123/details');

            expect(res2.headers.get('X-Cache')).toBe('HIT');
            expect(getCallCount()).toBe(1);
        });
    });

    describe('cacheMiddleware export', () => {
        it('should export cacheMiddleware as a factory function', async () => {
            const { cacheMiddleware } = await import('../../src/middlewares/cache');
            expect(typeof cacheMiddleware).toBe('function');

            const result = cacheMiddleware();
            expect(typeof result).toBe('function');
        });
    });

    describe('Logging', () => {
        it('should log info message when cache is enabled', () => {
            createCacheMiddleware();
            expect(apiLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Cache middleware enabled')
            );
        });

        it('should log info message when cache is disabled', () => {
            vi.mocked(getCacheConfig).mockReturnValue({
                enabled: false,
                defaultMaxAge: 60,
                defaultStaleWhileRevalidate: 30,
                defaultStaleIfError: 3600,
                maxAge: 60,
                staleWhileRevalidate: 30,
                staleIfError: 3600,
                etagEnabled: true,
                lastModifiedEnabled: true
            });

            createCacheMiddleware();
            expect(apiLogger.info).toHaveBeenCalledWith(
                'Cache middleware disabled via configuration (CACHE_ENABLED=false)'
            );
        });
    });
});

/**
 * HOS-1915: a cache HIT must carry the CURRENT request's id, both in the
 * `x-request-id` header and in the JSON envelope's `metadata.requestId`.
 */
describe('cache middleware request id on HIT (HOS-1915)', () => {
    const ROUTE = '/api/v1/public/accommodations';

    /** App whose upstream stamps the id the way `hono/request-id` + the formatter do. */
    function createRequestIdApp({
        respond
    }: {
        readonly respond: (c: import('hono').Context, requestId: string) => Response;
    }) {
        const app = new Hono<{ Variables: { requestId: string } }>();
        app.use('*', async (c, next) => {
            const id = c.req.header('x-test-request-id') ?? 'missing';
            c.set('requestId', id);
            c.header('X-Request-Id', id);
            await next();
        });
        app.use('*', createCacheMiddleware());
        app.get(ROUTE, (c) => respond(c, c.get('requestId')));
        return app;
    }

    const send = ({
        app,
        id
    }: {
        readonly app: { request: (u: string, i?: RequestInit) => Response | Promise<Response> };
        readonly id: string;
    }) => Promise.resolve(app.request(ROUTE, { headers: { 'x-test-request-id': id } }));

    beforeEach(() => {
        clearCache();
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
        });
    });

    it('re-stamps the header and metadata.requestId on a HIT', async () => {
        const app = createRequestIdApp({
            respond: (c, id) =>
                c.json({ success: true, data: { ok: true }, metadata: { requestId: id } })
        });

        const first = await send({ app, id: 'req-A' });
        const second = await send({ app, id: 'req-BBBBBBBB' });

        expect(second.headers.get('x-cache')).toBe('HIT');
        expect(second.headers.get('x-request-id')).toBe('req-BBBBBBBB');
        const body = await second.json();
        expect(body.metadata.requestId).toBe('req-BBBBBBBB');
        expect(body.data).toEqual({ ok: true });
        expect((await first.json()).metadata.requestId).toBe('req-A');
    });

    it('recomputes content-length to match the re-stamped body when the entry stored one', async () => {
        const app = createRequestIdApp({
            respond: (_c, id) => {
                const body = JSON.stringify({ metadata: { requestId: id }, data: 'x' });
                return new Response(body, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': String(new TextEncoder().encode(body).length)
                    }
                });
            }
        });

        const first = await send({ app, id: 'a' });
        const second = await send({ app, id: 'a-much-longer-request-id' });

        expect(first.headers.get('content-length')).not.toBeNull();
        expect(second.headers.get('x-cache')).toBe('HIT');
        const text = await second.text();
        expect(second.headers.get('content-length')).toBe(
            String(new TextEncoder().encode(text).length)
        );
    });

    it('adds no content-length on a HIT when the stored entry had none', async () => {
        const app = createRequestIdApp({
            respond: (c, id) => c.json({ metadata: { requestId: id }, data: 'x' })
        });

        const first = await send({ app, id: 'a' });
        const second = await send({ app, id: 'a-much-longer-request-id' });

        expect(first.headers.get('content-length')).toBeNull();
        expect(second.headers.get('x-cache')).toBe('HIT');
        expect(second.headers.get('content-length')).toBeNull();
        expect((await second.json()).metadata.requestId).toBe('a-much-longer-request-id');
    });

    it('re-stamps a large body and ignores a data field spelling "requestId"', async () => {
        const items = Array.from({ length: 5000 }, (_, i) => ({ id: i, name: `item-${i}` }));
        const app = createRequestIdApp({
            respond: (c, id) =>
                c.json({
                    data: { items, note: 'requestId', requestId: 'data-value' },
                    metadata: { requestId: id }
                })
        });

        await send({ app, id: 'req-A' });
        const second = await send({ app, id: 'req-B' });

        expect(second.headers.get('x-cache')).toBe('HIT');
        const body = await second.json();
        expect(body.metadata.requestId).toBe('req-B');
        expect(body.data.requestId).toBe('data-value');
        expect(body.data.items).toHaveLength(5000);
    });

    it('leaves a non-JSON body untouched', async () => {
        const app = createRequestIdApp({
            respond: (c, id) => c.text(`{"metadata":{"requestId":"${id}"}}`)
        });

        await send({ app, id: 'req-A' });
        const second = await send({ app, id: 'req-B' });

        expect(second.headers.get('x-cache')).toBe('HIT');
        expect(await second.text()).toBe('{"metadata":{"requestId":"req-A"}}');
        expect(second.headers.get('x-request-id')).toBe('req-B');
    });

    it('leaves a JSON body without metadata.requestId untouched', async () => {
        const app = createRequestIdApp({
            respond: (c) => c.json({ data: 'x', metadata: { timestamp: 't' } })
        });

        await send({ app, id: 'req-A' });
        const second = await send({ app, id: 'req-B' });

        expect(second.headers.get('x-cache')).toBe('HIT');
        expect(await second.json()).toEqual({ data: 'x', metadata: { timestamp: 't' } });
    });

    it('does not break when the cached JSON is not an object', async () => {
        const app = createRequestIdApp({ respond: (c) => c.json([1, 2, 3]) });

        await send({ app, id: 'req-A' });
        const second = await send({ app, id: 'req-B' });

        expect(second.headers.get('x-cache')).toBe('HIT');
        expect(await second.json()).toEqual([1, 2, 3]);
    });
});
