import { randomUUID } from 'node:crypto';
/**
 * Integration tests for HOS-145 T-005:
 * `GET /api/v1/public/accommodations/:slug/nearby-pois`.
 *
 * Seeds an accommodation with real coordinates plus a handful of points of
 * interest at known distances, then asserts:
 *  - nearest-first ordering with a numeric `distanceKm` per item (AC-1/AC-6)
 *  - `{ items: [] }` (never a 404) for a coordinate-less accommodation (AC-2)
 *  - `{ items: [] }` (never a 404) for an unknown slug (AC-2/route contract)
 *  - the accommodation's own coordinates never leak into the response body
 *    (AC-4 — the privacy-critical assertion)
 *  - `radius`/`limit` query params are honored and out-of-bounds values are
 *    rejected with 400 (AC-6)
 *
 * Uses testDb.setup()/clean()/teardown() + direct `getDb()` inserts, mirroring
 * `test/integration/destination/detail-includes-points-of-interest.test.ts`.
 */
import { accommodations, destinations, getDb, pointsOfInterest } from '@repo/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { createTestUser } from '../../e2e/setup/seed-helpers';
import { testDb } from '../../e2e/setup/test-database';

describe('GET /accommodations/:slug/nearby-pois (HOS-145 T-005)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/accommodations';

    const ts = Date.now();

    // Distinctive coordinate string — used only by the accommodation, never
    // by any seeded POI, so it can safely stand in for "did the accommodation's
    // own coordinates leak into the response".
    const accLat = '-32.482577';
    const accLong = '-58.237245';

    let destId: string;
    let ownerId: string;

    let slugWithCoords: string;
    let slugWithoutCoords: string;
    const unknownSlug = `hos145-t005-unknown-${ts}`;

    let poiNearSlug: string;
    let poiMidSlug: string;
    let poiFarSlug: string;
    let poiInactiveSlug: string;

    beforeAll(async () => {
        await testDb.setup();
        validateApiEnv();
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        app = initApp();

        const db = getDb();

        const user = await createTestUser({ email: `hos145-t005-${ts}@example.com` });
        ownerId = user.id;

        destId = randomUUID();
        await db.insert(destinations).values({
            id: destId,
            destinationType: 'CITY',
            path: `/hos145-t005-dest-${ts}`,
            slug: `hos145-t005-dest-${ts}`,
            name: `HOS-145 T-005 Destination ${ts}`,
            summary: 'Destination for the nearby-POIs integration test.',
            description: 'Destination seeded for the HOS-145 T-005 nearby-POIs integration test.',
            location: { country: 'AR', state: 'ER', city: 'CDU' }
        } as typeof destinations.$inferInsert);

        slugWithCoords = `hos145-t005-acc-coords-${ts}`;
        await db.insert(accommodations).values({
            slug: slugWithCoords,
            name: 'HOS-145 T-005 Accommodation With Coords',
            summary: 'Accommodation seeded with real coordinates.',
            type: 'APARTMENT',
            description: 'Accommodation seeded for the HOS-145 T-005 nearby-POIs integration test.',
            ownerId,
            destinationId: destId,
            lifecycleState: 'ACTIVE',
            visibility: 'PUBLIC',
            location: { coordinates: { lat: accLat, long: accLong } }
        } as typeof accommodations.$inferInsert);

        slugWithoutCoords = `hos145-t005-acc-nocoords-${ts}`;
        await db.insert(accommodations).values({
            slug: slugWithoutCoords,
            name: 'HOS-145 T-005 Accommodation Without Coords',
            summary: 'Accommodation seeded with no coordinates.',
            type: 'APARTMENT',
            description: 'Accommodation seeded for the HOS-145 T-005 nearby-POIs integration test.',
            ownerId,
            destinationId: destId,
            lifecycleState: 'ACTIVE',
            visibility: 'PUBLIC'
        } as typeof accommodations.$inferInsert);

        // ~0.06km from the accommodation
        poiNearSlug = `hos145-t005-poi-near-${ts}`;
        await db.insert(pointsOfInterest).values({
            slug: poiNearSlug,
            lat: -32.4831,
            long: -58.2402,
            type: 'PARK',
            description: 'Nearest seeded POI.',
            icon: 'tree',
            isFeatured: false,
            isBuiltin: false,
            displayWeight: 50,
            lifecycleState: 'ACTIVE'
        } as typeof pointsOfInterest.$inferInsert);

        // ~1.9km from the accommodation — still inside the default 5km radius
        poiMidSlug = `hos145-t005-poi-mid-${ts}`;
        await db.insert(pointsOfInterest).values({
            slug: poiMidSlug,
            lat: -32.5,
            long: -58.245,
            type: 'MUSEUM',
            description: 'Mid-distance seeded POI.',
            icon: 'bank',
            isFeatured: false,
            isBuiltin: false,
            displayWeight: 40,
            lifecycleState: 'ACTIVE'
        } as typeof pointsOfInterest.$inferInsert);

        // ~22km from the accommodation — outside the max allowed 20km radius
        poiFarSlug = `hos145-t005-poi-far-${ts}`;
        await db.insert(pointsOfInterest).values({
            slug: poiFarSlug,
            lat: -32.68,
            long: -58.3,
            type: 'NATURAL',
            description: 'Far seeded POI, outside any allowed radius.',
            icon: 'mountain',
            isFeatured: false,
            isBuiltin: false,
            displayWeight: 30,
            lifecycleState: 'ACTIVE'
        } as typeof pointsOfInterest.$inferInsert);

        // Same coordinates as the "near" POI, but not ACTIVE — must never appear.
        poiInactiveSlug = `hos145-t005-poi-inactive-${ts}`;
        await db.insert(pointsOfInterest).values({
            slug: poiInactiveSlug,
            lat: -32.4832,
            long: -58.2403,
            type: 'PARK',
            description: 'Inactive seeded POI, must be excluded.',
            icon: 'tree',
            isFeatured: false,
            isBuiltin: false,
            displayWeight: 50,
            lifecycleState: 'ARCHIVED'
        } as typeof pointsOfInterest.$inferInsert);
    });

    afterAll(async () => {
        await testDb.clean();
        await testDb.teardown();
    });

    it('returns nearby ACTIVE POIs nearest-first with a numeric distanceKm', async () => {
        const res = await app.request(`${base}/${slugWithCoords}/nearby-pois`, {
            headers: { 'user-agent': 'vitest', Accept: 'application/json' }
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('success', true);
        expect(body.data).toHaveProperty('items');
        const items = body.data.items as Array<Record<string, unknown>>;
        expect(Array.isArray(items)).toBe(true);

        const slugs = items.map((item) => item.slug);
        expect(slugs).toContain(poiNearSlug);
        expect(slugs).toContain(poiMidSlug);
        // Outside the default 5km radius / inactive — must never appear.
        expect(slugs).not.toContain(poiFarSlug);
        expect(slugs).not.toContain(poiInactiveSlug);

        const nearIndex = slugs.indexOf(poiNearSlug);
        const midIndex = slugs.indexOf(poiMidSlug);
        expect(nearIndex).toBeLessThan(midIndex);

        for (const item of items) {
            expect(typeof item.distanceKm).toBe('number');
            expect(item.distanceKm as number).toBeGreaterThanOrEqual(0);
        }
    });

    it('returns { items: [] } for an accommodation without coordinates', async () => {
        const res = await app.request(`${base}/${slugWithoutCoords}/nearby-pois`, {
            headers: { 'user-agent': 'vitest', Accept: 'application/json' }
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.items).toEqual([]);
    });

    it('returns 200 { items: [] } for an unknown slug — never 404', async () => {
        const res = await app.request(`${base}/${unknownSlug}/nearby-pois`, {
            headers: { 'user-agent': 'vitest', Accept: 'application/json' }
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.items).toEqual([]);
    });

    it('never leaks the accommodation own coordinates into the response body (AC-4)', async () => {
        const res = await app.request(`${base}/${slugWithCoords}/nearby-pois`, {
            headers: { 'user-agent': 'vitest', Accept: 'application/json' }
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        const raw = JSON.stringify(body);

        expect(raw).not.toContain(accLat);
        expect(raw).not.toContain(accLong);
    });

    describe('radius/limit query params', () => {
        it('honors a narrower radius, excluding POIs beyond it', async () => {
            const res = await app.request(
                `${base}/${slugWithCoords}/nearby-pois?radius=0.5&limit=12`,
                { headers: { 'user-agent': 'vitest', Accept: 'application/json' } }
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            const slugs = (body.data.items as Array<Record<string, unknown>>).map(
                (item) => item.slug
            );
            expect(slugs).toContain(poiNearSlug);
            expect(slugs).not.toContain(poiMidSlug);
        });

        it('honors limit, capping the number of returned items', async () => {
            const res = await app.request(`${base}/${slugWithCoords}/nearby-pois?limit=1`, {
                headers: { 'user-agent': 'vitest', Accept: 'application/json' }
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            const items = body.data.items as Array<Record<string, unknown>>;
            expect(items).toHaveLength(1);
            expect(items[0]?.slug).toBe(poiNearSlug);
        });

        it('rejects radius=0 (below the 0.1 minimum) with 400', async () => {
            const res = await app.request(`${base}/${slugWithCoords}/nearby-pois?radius=0`, {
                headers: { 'user-agent': 'vitest', Accept: 'application/json' }
            });
            expect(res.status).toBe(400);
        });

        it('rejects limit=999 (above the 50 maximum) with 400', async () => {
            const res = await app.request(`${base}/${slugWithCoords}/nearby-pois?limit=999`, {
                headers: { 'user-agent': 'vitest', Accept: 'application/json' }
            });
            expect(res.status).toBe(400);
        });
    });
});
