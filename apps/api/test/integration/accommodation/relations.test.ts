import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearCache } from '../../../src/middlewares/cache';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    type SeededPublicAccommodation,
    seedPublicAccommodation
} from '../helpers/seed-public-accommodation';

/**
 * The public accommodation list carries the destination foreign key a client
 * needs to expand relations, and keeps the owner id private
 * (`AccommodationPublicSchema` does not pick `ownerId`). Runs against the real
 * services and a seeded row, so an empty 200 cannot pass.
 */
describe('Accommodations API - Relations Support', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/accommodations';
    const headers = { 'user-agent': 'vitest', accept: 'application/json' };
    let seeded: SeededPublicAccommodation;

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        validateApiEnv();
        app = initApp();
    });

    beforeEach(async () => {
        seeded = await seedPublicAccommodation();
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    it('lists the seeded accommodation with its destination key and without the owner id', async () => {
        const res = await app.request(base, { headers });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.items).toHaveLength(1);
        expect(body.data.items[0]).toMatchObject({
            id: seeded.id,
            name: seeded.name,
            destinationId: seeded.destinationId
        });
        expect(body.data.items[0]).not.toHaveProperty('ownerId');
        expect(body.data.pagination).toMatchObject({ page: 1, total: 1 });
    });

    it('honours pagination query parameters', async () => {
        const res = await app.request(`${base}?page=1&pageSize=5`, { headers });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.pagination).toMatchObject({ page: 1, pageSize: 5, total: 1 });
        expect(body.data.items.map((item: { id: string }) => item.id)).toEqual([seeded.id]);
    });

    it('serves every seeded row exactly once across consecutive pages', async () => {
        const second = await seedPublicAccommodation({
            ownerId: seeded.ownerId,
            destinationId: seeded.destinationId
        });
        const third = await seedPublicAccommodation({
            ownerId: seeded.ownerId,
            destinationId: seeded.destinationId
        });
        const seenIds: string[] = [];

        for (const page of [1, 2, 3]) {
            const res = await app.request(`${base}?page=${page}&pageSize=1`, { headers });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.pagination).toMatchObject({
                page,
                pageSize: 1,
                total: 3,
                totalPages: 3
            });
            expect(body.data.items).toHaveLength(1);
            seenIds.push(body.data.items[0].id);
        }

        expect([...seenIds].sort()).toEqual([seeded.id, second.id, third.id].sort());

        const beyond = await app.request(`${base}?page=4&pageSize=1`, { headers });
        expect(beyond.status).toBe(200);
        expect((await beyond.json()).data.items).toEqual([]);
    });

    it('keeps the destination key a string on every listed item', async () => {
        const res = await app.request(base, { headers });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toMatchObject({
            data: expect.objectContaining({
                items: expect.any(Array),
                pagination: expect.any(Object)
            })
        });
        for (const item of body.data.items as ReadonlyArray<Record<string, unknown>>) {
            expect(typeof item.id).toBe('string');
            expect(typeof item.destinationId).toBe('string');
        }
    });
});
