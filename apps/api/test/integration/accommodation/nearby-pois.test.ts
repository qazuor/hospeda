import { randomUUID } from 'node:crypto';
/**
 * Integration tests for HOS-145 T-005:
 * `GET /api/v1/public/accommodations/:slug/nearby-pois`.
 *
 * Seeds an accommodation with real coordinates plus a handful of points of
 * interest at known distances, then asserts:
 *  - relevance ordering with a numeric `distanceKm` per item (AC-1/AC-6).
 *    HOS-327 replaced the fixed 5km circle + distance ordering with a per-POI
 *    elastic radius (`5km x displayWeight / 50`, clamped to [2, 15], x1.3 when
 *    featured) and a `displayWeight / (1 + km)` score, so this file also
 *    asserts both directions of that change against a real database.
 *  - `{ items: [] }` (never a 404) for a coordinate-less accommodation (AC-2)
 *  - `{ items: [] }` (never a 404) for an unknown slug (AC-2/route contract)
 *  - `{ items: [] }` (never a leak) for a DRAFT accommodation with coords +
 *    nearby POIs — visibility enforcement via the gated read (AC-8, HOS-145
 *    judgment-day #1 fix, 2026-07-14)
 *  - the accommodation's own coordinates never leak into the response body
 *    (AC-4 — the privacy-critical assertion)
 *  - `radius`/`limit` query params are honored and out-of-bounds values are
 *    rejected with 400 (AC-6)
 *
 * NOTE (2026-07-14 judgment-day R-4): the proximity search is centered on the
 * accommodation's OBFUSCATED `approximateLocation` (SPEC-097), not its real
 * coordinate — see `AccommodationService.getNearbyPois`. Distances therefore
 * carry a small (<=~141m) deterministic-per-accommodation offset from the
 * true distance. Every POI fixture below therefore sits far from the boundary
 * it is testing: 60m / 1.9km / 22km against the 0.5km narrow-radius test and
 * the 20km ceiling, and the HOS-327 pair at ~9km / ~3km against elastic radii
 * of 10km / 2.5km. Every margin is at least twice the obfuscation, so
 * ordering/inclusion assertions stay correct regardless of the offset —
 * assertions here intentionally check ordering, membership, and
 * `typeof distanceKm === 'number'`, never an exact distance value tied to the
 * real coordinate.
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
    let slugDraft: string;
    const unknownSlug = `hos145-t005-unknown-${ts}`;

    let poiNearSlug: string;
    let poiMidSlug: string;
    let poiFarSlug: string;
    let poiInactiveSlug: string;
    // HOS-327 elastic-radius pair: a heavy POI far outside the old fixed 5km
    // circle, and a weak POI comfortably inside it.
    let poiHeavyFarSlug: string;
    let poiWeakMidSlug: string;

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

        // DRAFT + coords + nearby POIs — must NOT leak proximity data to an
        // anonymous actor (HOS-145 judgment-day #1: visibility bypass fix).
        // Uses the SAME coordinates as `slugWithCoords` so a would-be leak
        // would surface the exact same near/mid POIs if the visibility gate
        // were not enforced.
        slugDraft = `hos145-t005-acc-draft-${ts}`;
        await db.insert(accommodations).values({
            slug: slugDraft,
            name: 'HOS-145 T-005 Accommodation DRAFT',
            summary: 'DRAFT accommodation seeded with real coordinates — must not leak.',
            type: 'APARTMENT',
            description: 'Accommodation seeded for the HOS-145 T-005 nearby-POIs integration test.',
            ownerId,
            destinationId: destId,
            lifecycleState: 'DRAFT',
            visibility: 'PUBLIC',
            location: { coordinates: { lat: accLat, long: accLong } }
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

        // HOS-327: ~9km away but displayWeight 100 — its elastic radius is
        // 10km, so it MUST appear even though the pre-HOS-327 fixed 5km circle
        // excluded it. (The search center is the 150m-obfuscated coordinate,
        // so the real distance lands in 8.85-9.15km; the margin to 10km is
        // an order of magnitude larger than the obfuscation.)
        poiHeavyFarSlug = `hos327-poi-heavy-far-${ts}`;
        await db.insert(pointsOfInterest).values({
            slug: poiHeavyFarSlug,
            lat: -32.563516,
            long: -58.24,
            type: 'MUSEUM',
            description: 'Heavy far seeded POI — earns a 10km elastic radius.',
            icon: 'bank',
            isFeatured: false,
            isBuiltin: false,
            displayWeight: 100,
            lifecycleState: 'ACTIVE'
        } as typeof pointsOfInterest.$inferInsert);

        // HOS-327: ~3km away but displayWeight 25 — its elastic radius is only
        // 2.5km, so it MUST NOT appear even though the pre-HOS-327 fixed 5km
        // circle included it.
        poiWeakMidSlug = `hos327-poi-weak-mid-${ts}`;
        await db.insert(pointsOfInterest).values({
            slug: poiWeakMidSlug,
            lat: -32.509557,
            long: -58.24,
            type: 'OTHER',
            description: 'Weak mid-distance seeded POI — earns only 2.5km.',
            icon: 'pin',
            isFeatured: false,
            isBuiltin: false,
            displayWeight: 25,
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

    it('returns nearby ACTIVE POIs ranked by relevance with a numeric distanceKm', async () => {
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
        // Beyond every possible elastic radius / inactive — must never appear.
        expect(slugs).not.toContain(poiFarSlug);
        expect(slugs).not.toContain(poiInactiveSlug);

        // Score order (weight^1.5 / (1 + km)): near = 353.6/1.06 ~ 334,
        // heavy-far = 1000/9.9 ~ 101, mid = 253/3.0 ~ 84. So the weight-100
        // POI 9km out now outranks the weight-40 one 2km out, which is the
        // whole point of HOS-327; this assertion only pins near before mid.
        const nearIndex = slugs.indexOf(poiNearSlug);
        const midIndex = slugs.indexOf(poiMidSlug);
        expect(nearIndex).toBeLessThan(midIndex);

        for (const item of items) {
            expect(typeof item.distanceKm).toBe('number');
            expect(item.distanceKm as number).toBeGreaterThanOrEqual(0);
        }
    });

    it('HOS-327: the radius is elastic per POI, not a fixed 5km circle', async () => {
        const res = await app.request(`${base}/${slugWithCoords}/nearby-pois`, {
            headers: { 'user-agent': 'vitest', Accept: 'application/json' }
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        const items = body.data.items as Array<Record<string, unknown>>;
        const slugs = items.map((item) => item.slug);

        // ~9km away, weight 100 -> 10km elastic radius. The pre-HOS-327 fixed
        // 5km circle dropped it; it is exactly the kind of POI the section
        // exists to show.
        expect(slugs).toContain(poiHeavyFarSlug);
        const heavy = items.find((item) => item.slug === poiHeavyFarSlug);
        expect(heavy?.distanceKm as number).toBeGreaterThan(5);

        // ~3km away, weight 25 -> 2.5km elastic radius. The pre-HOS-327 fixed
        // 5km circle kept it.
        expect(slugs).not.toContain(poiWeakMidSlug);
    });

    it('HOS-327: an explicit radius acts as a CEILING on the elastic radius', async () => {
        const res = await app.request(`${base}/${slugWithCoords}/nearby-pois?radius=5`, {
            headers: { 'user-agent': 'vitest', Accept: 'application/json' }
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        const slugs = (body.data.items as Array<Record<string, unknown>>).map((item) => item.slug);

        // The heavy POI's own radius is 10km, but the caller capped at 5km.
        expect(slugs).not.toContain(poiHeavyFarSlug);
        // The cap never WIDENS: the weak POI's own 2.5km still binds at 3km.
        expect(slugs).not.toContain(poiWeakMidSlug);
        expect(slugs).toContain(poiNearSlug);
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

    it('AC-8: returns 200 { items: [] } for a DRAFT accommodation with coords + nearby POIs — never leaks proximity data to an anonymous actor', async () => {
        const res = await app.request(`${base}/${slugDraft}/nearby-pois`, {
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
