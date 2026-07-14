/**
 * Integration tests for `PointOfInterestModel.findWithinRadius` (HOS-145
 * T-002) — the DB-layer geo query behind "POIs near a point" search, reused
 * later by the accommodation "What's nearby" section and HOS-146/147.
 *
 * Each test wraps DB writes in `withTestTransaction` so they are always
 * rolled back — no TRUNCATE overhead, parallel-safe via MVCC isolation.
 * Mirrors `host-trade.model.integration.test.ts`'s harness exactly.
 *
 * Coordinates are anchored around Concepción del Uruguay, Entre Ríos
 * (lat -32.4833, long -58.2333) so distances are realistic for the Litoral
 * region this platform targets. Fixture POIs are placed at known
 * north-south offsets from the center (same longitude), so the expected
 * Haversine distance reduces to `EARTH_RADIUS_KM * deltaLatRadians` — easy
 * to hand-verify against the ~0.5km assertion tolerance.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../../src/client.ts';
import { PointOfInterestModel } from '../../../src/models/destination/point-of-interest.model.ts';
import { pointsOfInterest } from '../../../src/schemas/destination/point-of-interest.dbschema.ts';
import { closeTestPool, getTestDb, withTestTransaction } from '../helpers.ts';

const DB_AVAILABLE = Boolean(process.env.HOSPEDA_TEST_DATABASE_URL);

beforeAll(() => {
    // Wire the module-level getDb() to the ephemeral test pool so that model
    // methods called WITHOUT an explicit `tx` hit the test DB instead of
    // throwing "Database not initialized".
    if (DB_AVAILABLE) {
        setDb(getTestDb());
    }
});

afterAll(async () => {
    if (DB_AVAILABLE) {
        await closeTestPool();
    }
});

// ---------------------------------------------------------------------------
// Geo fixture — Concepción del Uruguay center + known north-south offsets.
// ---------------------------------------------------------------------------

const CENTER_LAT = -32.4833;
const CENTER_LONG = -58.2333;

/** Latitude offset (degrees) for a target great-circle distance (km), holding longitude fixed. */
function latOffsetForKm(km: number): number {
    // Inverse of EARTH_RADIUS_KM * deltaLatRadians = km (see utils/geo.ts EARTH_RADIUS_KM = 6371).
    const EARTH_RADIUS_KM = 6371;
    const deltaLatRadians = km / EARTH_RADIUS_KM;
    return deltaLatRadians * (180 / Math.PI);
}

const LAT_0KM = CENTER_LAT;
const LAT_1KM = CENTER_LAT - latOffsetForKm(1);
const LAT_3KM = CENTER_LAT - latOffsetForKm(3);
const LAT_8KM = CENTER_LAT - latOffsetForKm(8);

/**
 * Minimal valid `points_of_interest` row (slug + type are the only
 * required, no-default columns). Mirrors the local factory in
 * `poi-category-primary-unique.integration.test.ts` (no shared factory
 * exists yet for this table).
 */
function poiFixture(
    overrides: Partial<typeof pointsOfInterest.$inferInsert> = {}
): typeof pointsOfInterest.$inferInsert {
    return {
        id: crypto.randomUUID(),
        slug: `test-poi-${crypto.randomUUID().slice(0, 8)}`,
        type: 'OTHER' as const,
        lifecycleState: 'ACTIVE' as const,
        ...overrides
    } satisfies typeof pointsOfInterest.$inferInsert;
}

describe('PointOfInterestModel.findWithinRadius', () => {
    const model = new PointOfInterestModel();

    it.skipIf(!DB_AVAILABLE)('returns in-range POIs and excludes out-of-range ones', async () => {
        await withTestTransaction(async (tx) => {
            const near = poiFixture({ lat: LAT_3KM, long: CENTER_LONG });
            const far = poiFixture({ lat: LAT_8KM, long: CENTER_LONG });
            await tx.insert(pointsOfInterest).values([near, far]);

            const results = await model.findWithinRadius(
                { lat: CENTER_LAT, long: CENTER_LONG, radiusKm: 5, limit: 20 },
                tx
            );

            const ids = results.map((r) => r.id);
            expect(ids).toContain(near.id);
            expect(ids).not.toContain(far.id);
        });
    });

    it.skipIf(!DB_AVAILABLE)('excludes POIs with null lat or null long', async () => {
        await withTestTransaction(async (tx) => {
            const nullLat = poiFixture({ lat: null, long: CENTER_LONG });
            const nullLong = poiFixture({ lat: LAT_1KM, long: null });
            const valid = poiFixture({ lat: LAT_1KM, long: CENTER_LONG });
            await tx.insert(pointsOfInterest).values([nullLat, nullLong, valid]);

            const results = await model.findWithinRadius(
                { lat: CENTER_LAT, long: CENTER_LONG, radiusKm: 5, limit: 20 },
                tx
            );

            const ids = results.map((r) => r.id);
            expect(ids).not.toContain(nullLat.id);
            expect(ids).not.toContain(nullLong.id);
            expect(ids).toContain(valid.id);
        });
    });

    it.skipIf(!DB_AVAILABLE)(
        'excludes non-ACTIVE (DRAFT/ARCHIVED) and soft-deleted POIs',
        async () => {
            await withTestTransaction(async (tx) => {
                const draft = poiFixture({
                    lat: LAT_1KM,
                    long: CENTER_LONG,
                    lifecycleState: 'DRAFT' as const
                });
                const archived = poiFixture({
                    lat: LAT_1KM,
                    long: CENTER_LONG,
                    lifecycleState: 'ARCHIVED' as const
                });
                const softDeleted = poiFixture({
                    lat: LAT_1KM,
                    long: CENTER_LONG,
                    deletedAt: new Date()
                });
                const active = poiFixture({ lat: LAT_1KM, long: CENTER_LONG });
                await tx.insert(pointsOfInterest).values([draft, archived, softDeleted, active]);

                const results = await model.findWithinRadius(
                    { lat: CENTER_LAT, long: CENTER_LONG, radiusKm: 5, limit: 20 },
                    tx
                );

                const ids = results.map((r) => r.id);
                expect(ids).not.toContain(draft.id);
                expect(ids).not.toContain(archived.id);
                expect(ids).not.toContain(softDeleted.id);
                expect(ids).toContain(active.id);
            });
        }
    );

    it.skipIf(!DB_AVAILABLE)('orders results nearest-first (ascending distanceKm)', async () => {
        await withTestTransaction(async (tx) => {
            const poi0 = poiFixture({ lat: LAT_0KM, long: CENTER_LONG });
            const poi1 = poiFixture({ lat: LAT_1KM, long: CENTER_LONG });
            const poi3 = poiFixture({ lat: LAT_3KM, long: CENTER_LONG });
            // Insert out of distance order to prove ORDER BY, not insertion order.
            await tx.insert(pointsOfInterest).values([poi3, poi0, poi1]);

            const results = await model.findWithinRadius(
                { lat: CENTER_LAT, long: CENTER_LONG, radiusKm: 5, limit: 20 },
                tx
            );

            const ids = results.map((r) => r.id);
            expect(ids).toEqual([poi0.id, poi1.id, poi3.id]);

            const distances = results.map((r) => r.distanceKm);
            expect(distances).toEqual([...distances].sort((a, b) => a - b));
        });
    });

    it.skipIf(!DB_AVAILABLE)('honors the limit parameter', async () => {
        await withTestTransaction(async (tx) => {
            const poi0 = poiFixture({ lat: LAT_0KM, long: CENTER_LONG });
            const poi1 = poiFixture({ lat: LAT_1KM, long: CENTER_LONG });
            const poi3 = poiFixture({ lat: LAT_3KM, long: CENTER_LONG });
            await tx.insert(pointsOfInterest).values([poi0, poi1, poi3]);

            const results = await model.findWithinRadius(
                { lat: CENTER_LAT, long: CENTER_LONG, radiusKm: 5, limit: 1 },
                tx
            );

            expect(results).toHaveLength(1);
            expect(results[0]?.id).toBe(poi0.id);
        });
    });

    it.skipIf(!DB_AVAILABLE)(
        'computes distanceKm as a number matching the expected Haversine distance within tolerance',
        async () => {
            await withTestTransaction(async (tx) => {
                const poi1 = poiFixture({ lat: LAT_1KM, long: CENTER_LONG });
                const poi3 = poiFixture({ lat: LAT_3KM, long: CENTER_LONG });
                await tx.insert(pointsOfInterest).values([poi1, poi3]);

                const results = await model.findWithinRadius(
                    { lat: CENTER_LAT, long: CENTER_LONG, radiusKm: 5, limit: 20 },
                    tx
                );

                const found1 = results.find((r) => r.id === poi1.id);
                const found3 = results.find((r) => r.id === poi3.id);

                expect(found1).toBeDefined();
                expect(found3).toBeDefined();
                expect(typeof found1?.distanceKm).toBe('number');
                expect(typeof found3?.distanceKm).toBe('number');
                expect(found1?.distanceKm).toBeGreaterThan(1 - 0.5);
                expect(found1?.distanceKm).toBeLessThan(1 + 0.5);
                expect(found3?.distanceKm).toBeGreaterThan(3 - 0.5);
                expect(found3?.distanceKm).toBeLessThan(3 + 0.5);
            });
        }
    );
});
