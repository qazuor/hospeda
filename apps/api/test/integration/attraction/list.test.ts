import { attractions, getDb } from '@repo/db';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearCache } from '../../../src/middlewares/cache';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

describe('GET /attractions (list)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/attractions';
    const headers = { 'user-agent': 'vitest' };
    const seededCount = 3;

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    beforeEach(async () => {
        const suffix = crypto.randomUUID().slice(0, 8);
        await getDb()
            .insert(attractions)
            .values(
                Array.from({ length: seededCount }, (_, index) => ({
                    name: `Attraction ${index} ${suffix}`,
                    slug: `attraction-${index}-${suffix}`
                }))
            );
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    it('lists attractions (happy path)', async () => {
        const res = await app.request(base, { headers });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.items).toHaveLength(seededCount);
    });

    it('includes pagination metadata', async () => {
        const res = await app.request(base, { headers });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.pagination).toMatchObject({
            page: 1,
            total: seededCount,
            totalPages: 1
        });
        expect(body.data.pagination).toHaveProperty('pageSize');
    });

    it('respects pageSize query parameter', async () => {
        const res = await app.request(`${base}?pageSize=2`, { headers });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.pagination.pageSize).toBe(2);
        expect(body.data.items).toHaveLength(2);
        expect(body.data.pagination.totalPages).toBe(2);
    });

    it('accepts the maximum pageSize of 100', async () => {
        const res = await app.request(`${base}?pageSize=100`, { headers });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.pagination.pageSize).toBe(100);
    });

    it('rejects a pageSize above the maximum with 400', async () => {
        const res = await app.request(`${base}?pageSize=500`, { headers });
        expect(res.status).toBe(400);
    });

    it('marks list responses as cacheable through the cache middleware', async () => {
        // A query string no other test uses, so the first read cannot be a cache hit.
        const url = `${base}?pageSize=7`;
        const res = await app.request(url, { headers });
        expect(res.status).toBe(200);
        expect(res.headers.get('x-cache')).toBe('MISS');
        const second = await app.request(url, { headers });
        expect(second.headers.get('x-cache')).toBe('HIT');
    });
});
