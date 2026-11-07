/**
 * Wiring test for the public accommodation cache invalidation (HOS-2063).
 *
 * The write routes themselves sit behind listing-access ports and entitlement
 * gates (DB-backed), so this suite mounts stand-in handlers at the real tier
 * mount paths. What it proves is the contract that broke: a successful write
 * through a protected/admin accommodation path evicts the cached public reads,
 * through the SAME `mountAccommodationCacheInvalidation` that `routes/index.ts`
 * calls, whatever sub-resource path the write hits.
 *
 * @module test/routes/accommodation/cache-invalidation-wiring
 */
import { readFileSync } from 'node:fs';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountAccommodationCacheInvalidation } from '../../../src/middlewares/accommodation-cache-invalidation.js';
import { clearCache, createCacheMiddleware } from '../../../src/middlewares/cache.js';
import type { AppBindings } from '../../../src/types.js';

vi.mock('../../../src/utils/env.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/utils/env.js')>();
    return {
        ...actual,
        env: { NODE_ENV: 'test' },
        getCacheConfig: () => ({
            enabled: true,
            maxAge: 60,
            staleWhileRevalidate: 30,
            staleIfError: 3600,
            etagEnabled: true,
            lastModifiedEnabled: true
        })
    };
});

vi.mock('../../../src/middlewares/response-validator.js', () => ({
    responseValidatorMiddleware: async (_context: unknown, next: () => Promise<void>) => {
        await next();
    },
    createResponseValidatorMiddleware:
        () => async (_context: unknown, next: () => Promise<void>) => {
            await next();
        }
}));

const ID = '44444444-4444-4444-8444-444444444444';
const SLUG_URL = '/api/v1/public/accommodations/slug/hotel-x';
const DEST_URL = `/api/v1/public/destinations/${ID}/accommodations`;
const UNRELATED_URL = '/api/v1/public/events/some-event';
let servedValue = 'old';

/** Write paths a host editor / admin hits, relative to the tier mount (method, path). */
const WRITE_PATHS: ReadonlyArray<readonly [string, string]> = [
    ['POST', ''],
    ['PATCH', `/${ID}`],
    ['PUT', `/${ID}`],
    ['POST', `/${ID}/faqs`],
    ['PUT', `/${ID}/media/${ID}/featured`],
    ['DELETE', `/${ID}/media/${ID}`],
    ['POST', `/${ID}/external-listings`]
];

function buildApp(tier: 'protected' | 'admin'): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.use('*', createCacheMiddleware());
    app.get(SLUG_URL, (c) => c.json({ amenities: servedValue }));
    app.get(DEST_URL, (c) => c.json({ accommodations: servedValue }));
    app.get(UNRELATED_URL, (c) => c.json({ event: servedValue }));
    mountAccommodationCacheInvalidation({ app });
    const writes = new Hono<AppBindings>();
    // Status is driven by the request so one stand-in covers success and failure.
    writes.all('*', (c) => {
        if (c.req.header('x-test-throw') === 'validation') {
            throw new HTTPException(400, { message: 'invalid' });
        }
        const status = Number(c.req.header('x-test-status') ?? '200');
        return c.json({ ok: status < 400 }, status as 200);
    });
    app.route(`/api/v1/${tier}/accommodations`, writes);
    return app;
}

function write(
    app: Hono<AppBindings>,
    tier: string,
    [method, path]: readonly [string, string],
    status = 200
): Promise<Response> | Response {
    return app.request(`/api/v1/${tier}/accommodations${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-test-status': String(status) },
        body: method === 'DELETE' || method === 'GET' ? undefined : JSON.stringify({})
    });
}

beforeEach(() => {
    clearCache();
    servedValue = 'old';
});

afterEach(() => {
    clearCache();
});

describe.each(['protected', 'admin'] as const)('%s accommodation cache invalidation', (tier) => {
    it.each(
        WRITE_PATHS
    )('serves fresh public data after a successful %s %s (regression)', async (method, path) => {
        const app = buildApp(tier);
        const first = await app.request(SLUG_URL);
        expect(first.headers.get('x-cache')).toBe('MISS');
        expect((await first.json()).amenities).toBe('old');
        await (await app.request(DEST_URL)).text();
        await (await app.request(UNRELATED_URL)).text();

        servedValue = 'new';
        const res = await write(app, tier, [method, path]);
        expect(res.status).toBe(200);

        const next = await app.request(SLUG_URL);
        expect(next.headers.get('x-cache')).toBe('MISS');
        expect((await next.json()).amenities).toBe('new');
        expect((await app.request(DEST_URL)).headers.get('x-cache')).toBe('MISS');
        // Only accommodation-bearing families are evicted.
        expect((await app.request(UNRELATED_URL)).headers.get('x-cache')).toBe('HIT');
    });

    it('keeps the cached public data after a failed write', async () => {
        const app = buildApp(tier);
        await (await app.request(SLUG_URL)).text();

        servedValue = 'new';
        const res = await write(app, tier, ['PATCH', `/${ID}`], 403);
        expect(res.status).toBe(403);

        const next = await app.request(SLUG_URL);
        expect(next.headers.get('x-cache')).toBe('HIT');
        expect((await next.json()).amenities).toBe('old');
    });

    it('keeps the cached public data after a GET on the write tier', async () => {
        const app = buildApp(tier);
        await (await app.request(SLUG_URL)).text();

        const res = await write(app, tier, ['GET', `/${ID}/media`]);
        expect(res.status).toBe(200);

        expect((await app.request(SLUG_URL)).headers.get('x-cache')).toBe('HIT');
    });
});

describe.each([
    ['protected', '/compare'],
    ['admin', '/batch']
] as const)('%s read-only POST %s', (tier, path) => {
    it('does not evict the public cache', async () => {
        const app = buildApp(tier);
        await (await app.request(SLUG_URL)).text();
        await (await app.request(DEST_URL)).text();

        const res = await write(app, tier, ['POST', path]);
        expect(res.status).toBe(200);

        expect((await app.request(SLUG_URL)).headers.get('x-cache')).toBe('HIT');
        expect((await app.request(DEST_URL)).headers.get('x-cache')).toBe('HIT');
    });
});

describe.each(['protected', 'admin'] as const)('%s thrown handler error', (tier) => {
    it('does not evict on a 4xx that goes through onError', async () => {
        const app = buildApp(tier);
        await (await app.request(SLUG_URL)).text();

        const res = await app.request(`/api/v1/${tier}/accommodations/${ID}`, {
            method: 'PATCH',
            headers: { 'x-test-throw': 'validation' },
            body: '{}'
        });
        expect(res.status).toBe(400);

        expect((await app.request(SLUG_URL)).headers.get('x-cache')).toBe('HIT');
    });
});

describe('routes/index.ts wiring', () => {
    it('mounts the accommodation invalidation before the accommodation routers', () => {
        const source = readFileSync(
            new URL('../../../src/routes/index.ts', import.meta.url),
            'utf8'
        );
        const mountAt = source.search(/mountAccommodationCacheInvalidation\(\s*\{\s*app\s*\}\s*\)/);
        const protectedAt = source.search(
            /app\.route\(\s*'\/api\/v1\/protected\/accommodations',\s*protectedAccommodationRoutes\s*\)/
        );
        const adminAt = source.search(
            /app\.route\(\s*'\/api\/v1\/admin\/accommodations',\s*adminAccommodationRoutes\s*\)/
        );
        expect(mountAt).toBeGreaterThan(-1);
        expect(protectedAt).toBeGreaterThan(-1);
        expect(adminAt).toBeGreaterThan(-1);
        expect(mountAt).toBeLessThan(protectedAt);
        expect(mountAt).toBeLessThan(adminAt);
    });
});
