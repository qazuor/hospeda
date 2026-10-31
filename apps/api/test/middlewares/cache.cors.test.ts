/**
 * @file cache.cors.test.ts
 * @description HOS-1924 item 2. `cors()` runs OUTSIDE the response cache and
 * writes `Access-Control-Allow-Origin` and `Vary` before `next()`. If those
 * headers were stored with the body, a HIT would replay the origin of whoever
 * filled the entry and overwrite the origin of the caller actually being served.
 *
 * The CORS middleware here is the real `corsMiddleware()`, mounted in front of
 * the real cache middleware in the same order as `utils/create-app.ts`.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGIN_A = 'https://web.hospeda.test';
const ORIGIN_B = 'https://admin.hospeda.test';
const ROUTE = '/api/v1/public/destinations';

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
    getCorsConfig: vi.fn(() => ({
        origins: ['https://web.hospeda.test', 'https://admin.hospeda.test'],
        allowCredentials: true,
        allowMethods: ['GET', 'OPTIONS'],
        allowHeaders: ['Content-Type'],
        exposeHeaders: [],
        maxAge: 600
    })),
    validateApiEnv: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }
}));

import { clearCache, createCacheMiddleware } from '../../src/middlewares/cache';
import { createCorsMiddleware } from '../../src/middlewares/cors';

function createTestApp() {
    const app = new Hono();
    app.use('*', createCorsMiddleware());
    app.use('*', createCacheMiddleware());
    app.get(ROUTE, (c) => c.json({ data: [] }));
    return app;
}

describe('Cache middleware — CORS headers belong to the caller, not the entry (HOS-1924)', () => {
    beforeEach(() => {
        clearCache();
    });

    it('a HIT carries the Access-Control-Allow-Origin of the CURRENT caller', async () => {
        // Arrange
        const app = createTestApp();
        const fill = await app.request(ROUTE, { headers: { Origin: ORIGIN_A } });

        // Act
        const hit = await app.request(ROUTE, { headers: { Origin: ORIGIN_B } });

        // Assert
        expect(fill.headers.get('x-cache')).toBe('MISS');
        expect(fill.headers.get('access-control-allow-origin')).toBe(ORIGIN_A);
        expect(hit.headers.get('x-cache')).toBe('HIT');
        expect(hit.headers.get('access-control-allow-origin')).toBe(ORIGIN_B);
    });

    it('a HIT for a caller without an Origin does not inherit the filler origin', async () => {
        // Arrange
        const app = createTestApp();
        await app.request(ROUTE, { headers: { Origin: ORIGIN_A } });

        // Act
        const hit = await app.request(ROUTE);

        // Assert
        expect(hit.headers.get('x-cache')).toBe('HIT');
        expect(hit.headers.get('access-control-allow-origin')).not.toBe(ORIGIN_A);
    });
});
