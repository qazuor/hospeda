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
        publicEndpoints: ['/api/v1/public/accommodations', '/api/v1/public/destinations'],
        privateEndpoints: ['/api/v1/protected/users'],
        noCacheEndpoints: ['/health/db', '/docs'],
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
}: { readonly route?: string } = {}) {
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
            publicEndpoints: ['/api/v1/public/accommodations', '/api/v1/public/destinations'],
            privateEndpoints: ['/api/v1/protected/users'],
            noCacheEndpoints: ['/health/db', '/docs'],
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
                publicEndpoints: [],
                privateEndpoints: [],
                noCacheEndpoints: [],
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

        it('should cache private endpoints with separate keys per auth token', async () => {
            const middleware = createCacheMiddleware();
            const app = new Hono();
            let callCount = 0;

            app.use('*', middleware);
            app.get('/api/v1/protected/users', (c) => {
                callCount++;
                return c.json({ user: 'data', callCount });
            });

            // Two requests with different auth tokens
            const res1 = await app.request('/api/v1/protected/users', {
                headers: { Authorization: 'Bearer token-a' }
            });
            const res2 = await app.request('/api/v1/protected/users', {
                headers: { Authorization: 'Bearer token-b' }
            });

            // Each should be a cache miss (different keys)
            expect(res1.headers.get('X-Cache')).toBe('MISS');
            expect(res2.headers.get('X-Cache')).toBe('MISS');
            expect(callCount).toBe(2);

            // Now repeat with token-a - should be a HIT
            const res3 = await app.request('/api/v1/protected/users', {
                headers: { Authorization: 'Bearer token-a' }
            });
            expect(res3.headers.get('X-Cache')).toBe('HIT');
            expect(callCount).toBe(2);
        });

        it('should use "anonymous" key for private endpoints without auth header', async () => {
            const middleware = createCacheMiddleware();
            const app = new Hono();
            let callCount = 0;

            app.use('*', middleware);
            app.get('/api/v1/protected/users', (c) => {
                callCount++;
                return c.json({ user: 'anon' });
            });

            await app.request('/api/v1/protected/users');
            const res2 = await app.request('/api/v1/protected/users');

            expect(res2.headers.get('X-Cache')).toBe('HIT');
            expect(callCount).toBe(1);
        });
    });

    describe('TTL Expiration', () => {
        it('should expire cached entries after TTL', async () => {
            // Use a very short TTL for testing
            vi.mocked(getCacheConfig).mockReturnValue({
                enabled: true,
                publicEndpoints: ['/api/v1/public/accommodations'],
                privateEndpoints: [],
                noCacheEndpoints: [],
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
                publicEndpoints: [],
                privateEndpoints: [],
                noCacheEndpoints: [],
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
