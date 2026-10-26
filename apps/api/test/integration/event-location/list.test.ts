import { destinations, eventLocations, getDb } from '@repo/db';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearCache } from '../../../src/middlewares/cache';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

describe('GET /event-locations (list)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/event-locations';
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
        const db = getDb();
        const [destination] = await db
            .insert(destinations)
            .values({
                slug: `dest-${suffix}`,
                name: `Destination ${suffix}`,
                summary: 'Destination seeded for the event location list tests.',
                description: 'Destination seeded for the event location list tests.',
                destinationType: 'CITY',
                path: `/dest-${suffix}`,
                pathIds: '',
                level: 4,
                location: {
                    country: 'AR',
                    state: 'ER',
                    coordinates: { lat: '-32.48', long: '-58.23' }
                }
            })
            .returning({ id: destinations.id });
        const destinationId = destination?.id;
        if (!destinationId) throw new Error('event-location list: destination insert failed');
        await db.insert(eventLocations).values(
            Array.from({ length: seededCount }, (_, index) => ({
                slug: `location-${index}-${suffix}`,
                placeName: `Location ${index} ${suffix}`,
                destinationId
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

    it('lists event locations (happy path)', async () => {
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

    // HOS-1904: EventLocationService._executeSearch reads page/pageSize from
    // params (eventLocation.service.ts:327), but BaseCrudRead.search strips them first (base.crud.read.ts:408-411).
    // Same mechanism as HOS-1900. Drop `.fails` once fixed.
    it.fails('respects pageSize query parameter', async () => {
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
