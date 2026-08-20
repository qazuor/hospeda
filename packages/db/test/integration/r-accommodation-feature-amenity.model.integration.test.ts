/**
 * Regression test for HOS-598 — `GET /api/v1/public/features/accommodation/{id}`
 * responded 500 `DATABASE_ERROR` on every call.
 *
 * Root cause: `RAccommodationFeatureModel.getTableName()` returned the wrong
 * string (`'rAccommodationFeatures'`, plural) while the Drizzle relational
 * query builder only ever exposes `db.query.<exportName>`, and the schema
 * module exports the junction table as `rAccommodationFeature` (singular —
 * see `packages/db/src/schemas/accommodation/r_accommodation_feature.dbschema.ts`).
 * `BaseModelImpl.findAllWithRelations` looks the table up via
 * `db.query[this.getTableName()]`, so the mismatch threw
 * `Invalid table configuration for: rAccommodationFeatures` before a single
 * row was ever read — independent of the requested id, exactly as observed
 * in production (a real accommodation id and a made-up UUID both 500'd).
 *
 * `RAccommodationAmenityModel` carried the exact same defect
 * (`'rAccommodationAmenities'` vs the singular `rAccommodationAmenity`
 * export) — not yet reachable from a public route at the time of the fix,
 * but exercised here so a future caller of
 * `AmenityService.getAmenitiesForAccommodation` doesn't rediscover the bug
 * in production.
 *
 * This suite deliberately runs against the REAL combined Drizzle schema
 * (via `getTestDb()` / `withTestTransaction`, `packages/db/test/integration/helpers.ts`)
 * rather than the mocked `@repo/db` used by `apps/api`'s default test setup
 * — the bug only reproduces when `db.query` is built from the actual schema
 * module, which a mocked model instance never exercises (see
 * `packages/db/test/models/r_accommodation_feature.model.test.ts` /
 * `r_accommodation_amenity.model.test.ts`, both of which mock `getDb()` and
 * therefore stayed green while this bug was live in production).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import { RAccommodationAmenityModel } from '../../src/models/accommodation/rAccommodationAmenity.model.ts';
import { RAccommodationFeatureModel } from '../../src/models/accommodation/rAccommodationFeature.model.ts';
import { accommodations } from '../../src/schemas/accommodation/accommodation.dbschema.ts';
import { amenities } from '../../src/schemas/accommodation/amenity.dbschema.ts';
import { features } from '../../src/schemas/accommodation/feature.dbschema.ts';
import { rAccommodationAmenity } from '../../src/schemas/accommodation/r_accommodation_amenity.dbschema.ts';
import { rAccommodationFeature } from '../../src/schemas/accommodation/r_accommodation_feature.dbschema.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, getTestDb, testData, withTestTransaction } from './helpers.ts';

/** Minimal accommodation row satisfying all NOT NULL constraints. */
function accommodationFixture(
    ownerId: string,
    destinationId: string
): typeof accommodations.$inferInsert {
    const uid = crypto.randomUUID().slice(0, 8);
    return {
        id: crypto.randomUUID(),
        slug: `hos598-acc-${uid}`,
        name: 'HOS-598 Regression Test Accommodation',
        summary: 'Short summary',
        type: 'HOTEL' as const,
        description: 'Test description for the HOS-598 relation-model regression test.',
        ownerId,
        destinationId
    };
}

/** Minimal feature catalog row (SPEC-266 — no `name` column, `slug` only). */
function featureFixture(): typeof features.$inferInsert {
    const uid = crypto.randomUUID().slice(0, 8);
    return {
        id: crypto.randomUUID(),
        slug: `hos598-feature-${uid}`,
        lifecycleState: 'ACTIVE' as const
    };
}

/** Minimal amenity catalog row (SPEC-266 — no `name` column, `slug` only). */
function amenityFixture(): typeof amenities.$inferInsert {
    const uid = crypto.randomUUID().slice(0, 8);
    return {
        id: crypto.randomUUID(),
        slug: `hos598-amenity-${uid}`,
        type: 'CONNECTIVITY' as const,
        lifecycleState: 'ACTIVE' as const
    };
}

/** Inserts owner + destination + accommodation, returning their rows. */
async function seedAccommodation(tx: DrizzleClient) {
    const ownerPayload = testData.user({ role: 'HOST' });
    const [owner] = await tx.insert(users).values(ownerPayload).returning();
    if (!owner) throw new Error('Failed to insert owner');

    const destinationPayload = testData.destination({ ownerId: owner.id });
    const [destination] = await tx.insert(destinations).values(destinationPayload).returning();
    if (!destination) throw new Error('Failed to insert destination');

    const [accommodation] = await tx
        .insert(accommodations)
        .values(accommodationFixture(owner.id, destination.id))
        .returning();
    if (!accommodation) throw new Error('Failed to insert accommodation');

    return { owner, destination, accommodation };
}

beforeAll(() => {
    setDb(getTestDb());
});

afterAll(async () => {
    await closeTestPool();
});

describe('RAccommodationFeatureModel.findAllWithRelations (HOS-598)', () => {
    it('does NOT throw "Invalid table configuration" for a REAL accommodation id', async () => {
        await withTestTransaction(async (tx) => {
            const { accommodation } = await seedAccommodation(tx);
            const [feature] = await tx.insert(features).values(featureFixture()).returning();
            if (!feature) throw new Error('Failed to insert feature');
            await tx.insert(rAccommodationFeature).values({
                accommodationId: accommodation.id,
                featureId: feature.id
            });

            const model = new RAccommodationFeatureModel();

            const { items, total } = await model.findAllWithRelations(
                { feature: true },
                { accommodationId: accommodation.id },
                { page: 1, pageSize: 100 },
                undefined,
                tx
            );

            expect(total).toBe(1);
            expect(items).toHaveLength(1);
            expect((items[0] as unknown as { feature: { id: string } }).feature.id).toBe(
                feature.id
            );
        });
    });

    it('does NOT throw "Invalid table configuration" for a made-up UUID either — matches the reported "fails independent of input" behavior', async () => {
        await withTestTransaction(async (tx) => {
            const model = new RAccommodationFeatureModel();

            const { items, total } = await model.findAllWithRelations(
                { feature: true },
                { accommodationId: crypto.randomUUID() },
                { page: 1, pageSize: 100 },
                undefined,
                tx
            );

            expect(total).toBe(0);
            expect(items).toHaveLength(0);
        });
    });
});

describe('RAccommodationAmenityModel.findAllWithRelations (HOS-598 sibling defect)', () => {
    it('does NOT throw "Invalid table configuration" for a REAL accommodation id', async () => {
        await withTestTransaction(async (tx) => {
            const { accommodation } = await seedAccommodation(tx);
            const [amenity] = await tx.insert(amenities).values(amenityFixture()).returning();
            if (!amenity) throw new Error('Failed to insert amenity');
            await tx.insert(rAccommodationAmenity).values({
                accommodationId: accommodation.id,
                amenityId: amenity.id
            });

            const model = new RAccommodationAmenityModel();

            const { items, total } = await model.findAllWithRelations(
                { amenity: true },
                { accommodationId: accommodation.id },
                { page: 1, pageSize: 100 },
                undefined,
                tx
            );

            expect(total).toBe(1);
            expect(items).toHaveLength(1);
            expect((items[0] as unknown as { amenity: { id: string } }).amenity.id).toBe(
                amenity.id
            );
        });
    });
});
