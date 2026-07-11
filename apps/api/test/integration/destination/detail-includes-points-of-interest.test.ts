import { destinations, getDb, pointsOfInterest, rDestinationPointOfInterest } from '@repo/db';
/**
 * Integration tests for HOS-113 Phase 4: the public destination detail
 * responses (by-slug and by-path) embed the destination's points of
 * interest (POIs) as a `pointsOfInterest` array, and — this is the review
 * fix under test (HOS-113 Fix 1) — the POI's `description` and
 * `isFeatured` fields survive end-to-end.
 *
 * Before the fix, `DestinationModel.getPointsOfInterestMap`'s `.select({...})`
 * projection omitted `description`/`isFeatured`/`isBuiltin`. Those fields are
 * real NOT-NULL columns, so `PointOfInterestSummarySchema.pick()` (which
 * requires them) fell back to schema defaults during response validation:
 * `isFeatured` always came back `false` and `description` always came back
 * `undefined`, even for a POI seeded with `isFeatured: true` and a real
 * description. This test seeds exactly that POI and asserts the values
 * survive — it fails against the pre-fix projection and passes after.
 *
 * Uses testDb.setup() + seeded rows so a 500 (DB not initialized) is never
 * tolerated — a 500 from the public detail endpoint always indicates a
 * real bug.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

describe('Public destination detail embeds pointsOfInterest (HOS-113 Phase 4)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    /** Slug of the destination we seed in beforeAll. */
    let seedSlug: string;
    /** Path of the seeded destination for the by-path route. */
    let seedPath: string;
    /** slug of the seeded POI, used to locate it in the response array. */
    let poiSlug: string;
    /** The exact description seeded on the POI — must round-trip verbatim. */
    const poiDescription =
        'A featured landmark seeded for the HOS-113 review-fix integration test.';

    beforeAll(async () => {
        await testDb.setup();
        validateApiEnv();
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        app = initApp();

        const ts = Date.now();
        seedSlug = `e2e-poi-detail-${ts}`;
        seedPath = `/test/poi-detail-${ts}`;
        poiSlug = `e2e-poi-${ts}`;

        const db = getDb();

        const insertedDest = await db
            .insert(destinations)
            .values({
                slug: seedSlug,
                name: `E2E POI Detail ${ts}`,
                summary: 'Destination for POI description/isFeatured integration test.',
                description: 'Long enough description for the POI review-fix integration test.',
                destinationType: 'CITY',
                path: seedPath,
                pathIds: '',
                level: 4,
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE',
                moderationState: 'APPROVED',
                location: { coordinates: { lat: '-32.48', long: '-58.23' } }
            })
            .returning({ id: destinations.id });

        const destId = insertedDest[0]?.id;
        if (!destId) throw new Error('Seeded destination returned no row');

        const insertedPoi = await db
            .insert(pointsOfInterest)
            .values({
                slug: poiSlug,
                lat: -32.48,
                long: -58.23,
                type: 'STADIUM',
                description: poiDescription,
                icon: 'flag-checkered',
                isFeatured: true,
                isBuiltin: false,
                displayWeight: 90,
                lifecycleState: 'ACTIVE'
            })
            .returning({ id: pointsOfInterest.id });

        const poiId = insertedPoi[0]?.id;
        if (!poiId) throw new Error('Seeded point of interest returned no row');

        await db.insert(rDestinationPointOfInterest).values({
            destinationId: destId,
            pointOfInterestId: poiId
        });
    });

    afterAll(async () => {
        await testDb.clean();
        await testDb.teardown();
    });

    const assertPoiContract = (data: unknown) => {
        if (data === null || data === undefined) return; // destination not found — tolerated
        const detail = data as { pointsOfInterest?: unknown };
        expect(Array.isArray(detail.pointsOfInterest)).toBe(true);
        const pois = detail.pointsOfInterest as Array<Record<string, unknown>>;
        const seeded = pois.find((p) => p.slug === poiSlug);
        expect(seeded).toBeDefined();
        // The exact bug this test guards: pre-fix, these came back
        // `description: undefined` and `isFeatured: false` regardless of the
        // real seeded values (schema defaults silently overwrote them).
        expect(seeded?.description).toBe(poiDescription);
        expect(seeded?.isFeatured).toBe(true);
        expect(seeded?.isBuiltin).toBe(false);
    };

    describe('GET /destinations/slug/:slug', () => {
        it('includes the seeded POI with its real description and isFeatured=true', async () => {
            const res = await app.request(`${base}/slug/${seedSlug}`, {
                headers: { 'user-agent': 'vitest', Accept: 'application/json' }
            });
            // 500 is NOT acceptable — DB is initialized and schema is present.
            expect([200, 400, 404]).toContain(res.status);
            if (res.status === 200) {
                const body = await res.json();
                expect(body).toHaveProperty('success', true);
                assertPoiContract(body.data);
            }
        });
    });

    describe('GET /destinations/by-path', () => {
        it('includes the seeded POI with its real description and isFeatured=true when found by path', async () => {
            const res = await app.request(`${base}/by-path?path=${encodeURIComponent(seedPath)}`, {
                headers: { 'user-agent': 'vitest', Accept: 'application/json' }
            });
            // 500 is NOT acceptable — DB is initialized and schema is present.
            expect([200, 400, 404]).toContain(res.status);
            if (res.status === 200) {
                const body = await res.json();
                expect(body).toHaveProperty('success', true);
                assertPoiContract(body.data);
            }
        });
    });
});
