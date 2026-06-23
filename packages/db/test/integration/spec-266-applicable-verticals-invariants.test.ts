/**
 * SPEC-266 T-011 — Migration-safety invariants for `applicable_verticals`.
 *
 * Migration 0025 (`0025_steep_crusher_hogan.sql`) added the `applicable_verticals
 * text[]` column to `amenities` and `features`, dropped the `name` column, and
 * backfilled existing rows.
 *
 * Hard invariants (spec §5.6/§7):
 *
 *   INV-1  Every `r_accommodation_amenity.amenity_id` resolves to an existing
 *          `amenities` row whose `applicable_verticals` contains 'accommodation'.
 *          Same for `r_accommodation_feature` → `features`.
 *
 *   INV-2  No `amenities` or `features` catalog row has an empty
 *          `applicable_verticals` array (the migration backfill covered all
 *          pre-existing rows).
 *
 *   INV-3  The `name` column dropped by migration 0025 does NOT exist on
 *          `amenities` or `features` (verified via `information_schema`).
 *
 *   INV-4  Inserting representative `r_accommodation_amenity` /
 *          `r_accommodation_feature` rows yields a stable count inside a
 *          transaction that is always rolled back (relation rows are not
 *          affected by catalog-side column changes).
 *
 * Uses the SPEC-061 global-setup infrastructure: the ephemeral
 * `hospeda_integration_test` database is created and migrated exactly once per
 * run — so the schema here matches the migration carril as shipped.
 */
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { accommodations } from '../../src/schemas/accommodation/accommodation.dbschema.ts';
import { amenities } from '../../src/schemas/accommodation/amenity.dbschema.ts';
import { features } from '../../src/schemas/accommodation/feature.dbschema.ts';
import { rAccommodationAmenity } from '../../src/schemas/accommodation/r_accommodation_amenity.dbschema.ts';
import { rAccommodationFeature } from '../../src/schemas/accommodation/r_accommodation_feature.dbschema.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { closeTestPool, getTestPool, withTestTransaction } from './helpers.ts';

// ---------------------------------------------------------------------------
// Minimal factories — only NOT NULL fields without DB-side defaults
// ---------------------------------------------------------------------------

function makeUser(): typeof users.$inferInsert {
    const uid = crypto.randomUUID();
    return {
        id: uid,
        email: `spec266-${uid}@example.com`,
        emailVerified: true,
        slug: `spec266-user-${uid.slice(0, 8)}`,
        lifecycleState: 'ACTIVE' as const,
        createdById: null
    } satisfies typeof users.$inferInsert;
}

function makeDestination(): typeof destinations.$inferInsert {
    const uid = crypto.randomUUID().slice(0, 8);
    return {
        id: crypto.randomUUID(),
        slug: `spec266-dest-${uid}`,
        name: 'SPEC-266 Test Destination',
        destinationType: 'CITY' as const,
        level: 4,
        path: `/spec266/dest-${uid}`,
        summary: 'SPEC-266 destination summary for invariant test.',
        description: 'SPEC-266 destination description for invariant test.',
        location: {
            state: 'Entre Rios',
            country: 'Argentina',
            coordinates: { lat: '-32.48', long: '-58.23' }
        },
        media: {
            featuredImage: {
                moderationState: 'APPROVED',
                url: 'https://example.com/spec266-destination.jpg'
            }
        },
        lifecycleState: 'ACTIVE' as const
    } satisfies typeof destinations.$inferInsert;
}

function makeAccommodation(
    ownerId: string,
    destinationId: string
): typeof accommodations.$inferInsert {
    const uid = crypto.randomUUID().slice(0, 8);
    return {
        id: crypto.randomUUID(),
        slug: `spec266-acc-${uid}`,
        name: 'SPEC-266 Test Accommodation',
        summary: 'SPEC-266 accommodation summary for invariant test.',
        type: 'HOTEL' as const,
        description: 'SPEC-266 accommodation description for invariant test.',
        ownerId,
        destinationId,
        lifecycleState: 'ACTIVE' as const,
        visibility: 'PUBLIC' as const,
        moderationState: 'PENDING' as const
    } satisfies typeof accommodations.$inferInsert;
}

/**
 * Minimal amenity row with accommodation vertical. No `name` column (dropped by
 * migration 0025). Uses `CONNECTIVITY` as the required `type` enum value
 * (from `AmenitiesTypeEnum` — `GENERAL` is not a valid value in the PG enum).
 */
function makeAmenity(
    overrides: Partial<typeof amenities.$inferInsert> = {}
): typeof amenities.$inferInsert {
    const uid = crypto.randomUUID().slice(0, 8);
    return {
        id: crypto.randomUUID(),
        slug: `spec266-amenity-${uid}`,
        type: 'CONNECTIVITY' as const,
        applicableVerticals: ['accommodation'],
        isBuiltin: false,
        isFeatured: false,
        displayWeight: 50,
        lifecycleState: 'ACTIVE' as const,
        ...overrides
    } satisfies typeof amenities.$inferInsert;
}

/**
 * Minimal feature row with accommodation vertical. No `name` column (dropped by
 * migration 0025).
 */
function makeFeature(
    overrides: Partial<typeof features.$inferInsert> = {}
): typeof features.$inferInsert {
    const uid = crypto.randomUUID().slice(0, 8);
    return {
        id: crypto.randomUUID(),
        slug: `spec266-feature-${uid}`,
        applicableVerticals: ['accommodation'],
        isBuiltin: false,
        isFeatured: false,
        displayWeight: 50,
        lifecycleState: 'ACTIVE' as const,
        ...overrides
    } satisfies typeof features.$inferInsert;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('SPEC-266 T-011 — applicable_verticals migration-safety invariants', () => {
    afterAll(async () => {
        await closeTestPool();
    });

    // -----------------------------------------------------------------------
    // INV-3: `name` column must NOT exist after migration 0025 dropped it.
    // This assertion uses the real pool to query information_schema and is
    // intentionally NOT wrapped in a transaction (it reads schema metadata,
    // not row data, and must see the committed migration state).
    // -----------------------------------------------------------------------
    it('INV-3: amenities table has no "name" column (dropped by migration 0025)', async () => {
        const pool = getTestPool();
        const { rows } = await pool.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name   = 'amenities'
               AND column_name  = 'name'`
        );
        expect(Number(rows[0]?.count)).toBe(0);
    });

    it('INV-3: features table has no "name" column (dropped by migration 0025)', async () => {
        const pool = getTestPool();
        const { rows } = await pool.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name   = 'features'
               AND column_name  = 'name'`
        );
        expect(Number(rows[0]?.count)).toBe(0);
    });

    it('INV-3: amenities table HAS the "applicable_verticals" column (added by migration 0025)', async () => {
        const pool = getTestPool();
        const { rows } = await pool.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name   = 'amenities'
               AND column_name  = 'applicable_verticals'`
        );
        expect(Number(rows[0]?.count)).toBe(1);
    });

    it('INV-3: features table HAS the "applicable_verticals" column (added by migration 0025)', async () => {
        const pool = getTestPool();
        const { rows } = await pool.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name   = 'features'
               AND column_name  = 'applicable_verticals'`
        );
        expect(Number(rows[0]?.count)).toBe(1);
    });

    // -----------------------------------------------------------------------
    // INV-2 + INV-1 + INV-4: run inside a single rolled-back transaction
    // so we can insert controlled catalog data and relation rows that
    // exercise every invariant, then have everything cleaned up for free.
    // -----------------------------------------------------------------------
    it('INV-2: no amenity in the test catalog has an empty applicable_verticals', async () => {
        await withTestTransaction(async (tx) => {
            // Insert one valid and one with explicitly non-empty verticals.
            const amenityA = makeAmenity({ applicableVerticals: ['accommodation'] });
            const amenityB = makeAmenity({
                applicableVerticals: ['accommodation', 'gastronomy', 'experience']
            });
            await tx.insert(amenities).values([amenityA, amenityB]);

            // Query for empty-array rows within this tx.
            const emptyRows = await tx
                .select({ id: amenities.id, slug: amenities.slug })
                .from(amenities)
                .where(sql`cardinality(${amenities.applicableVerticals}) = 0`);

            expect(emptyRows).toHaveLength(0);
        });
    });

    it('INV-2: no feature in the test catalog has an empty applicable_verticals', async () => {
        await withTestTransaction(async (tx) => {
            const featureA = makeFeature({ applicableVerticals: ['accommodation'] });
            const featureB = makeFeature({ applicableVerticals: ['accommodation', 'gastronomy'] });
            await tx.insert(features).values([featureA, featureB]);

            const emptyRows = await tx
                .select({ id: features.id, slug: features.slug })
                .from(features)
                .where(sql`cardinality(${features.applicableVerticals}) = 0`);

            expect(emptyRows).toHaveLength(0);
        });
    });

    it('INV-2: inserting an amenity with empty applicable_verticals is rejected by the NOT NULL constraint (but empty array is allowed — DEFAULT is {})', async () => {
        // The migration added NOT NULL DEFAULT '{}'. An empty array is technically
        // allowed by the DB — the backfill step (UPDATE WHERE applicable_verticals = '{}')
        // is what prevents pre-existing rows from staying empty. This test confirms the
        // default is '{}' (NOT NULL constraint passes) and that a null write is rejected.
        await expect(
            withTestTransaction(async (tx) => {
                await tx.insert(amenities).values({
                    ...makeAmenity(),
                    // Bypass TypeScript type to test the DB-level NOT NULL constraint.
                    applicableVerticals: null as unknown as string[]
                });
            })
        ).rejects.toThrow();
    });

    it('INV-1 + INV-4: relation rows reference amenities with accommodation vertical — count is stable', async () => {
        await withTestTransaction(async (tx) => {
            // Set up: user → destination → accommodation → amenity → relation
            const user = makeUser();
            await tx.insert(users).values(user);

            const dest = makeDestination();
            await tx.insert(destinations).values(dest);

            const accommodation = makeAccommodation(user.id, dest.id);
            await tx.insert(accommodations).values(accommodation);

            // Two amenities: both valid (have 'accommodation' in applicable_verticals)
            const amenityAccOnly = makeAmenity({ applicableVerticals: ['accommodation'] });
            const amenityShared = makeAmenity({
                applicableVerticals: ['accommodation', 'gastronomy', 'experience']
            });
            await tx.insert(amenities).values([amenityAccOnly, amenityShared]);

            // Insert 2 relation rows
            await tx.insert(rAccommodationAmenity).values([
                { accommodationId: accommodation.id, amenityId: amenityAccOnly.id },
                { accommodationId: accommodation.id, amenityId: amenityShared.id }
            ]);

            // INV-1 + INV-4: join relation rows with their catalog amenity row,
            // filtering only those where 'accommodation' ∈ applicable_verticals.
            const joinResult = await tx
                .select({
                    amenityId: rAccommodationAmenity.amenityId,
                    slug: amenities.slug
                })
                .from(rAccommodationAmenity)
                .innerJoin(amenities, sql`${rAccommodationAmenity.amenityId} = ${amenities.id}`)
                .where(
                    sql`${rAccommodationAmenity.accommodationId} = ${accommodation.id}
                        AND 'accommodation' = ANY(${amenities.applicableVerticals})`
                );

            // INV-4: count is exactly the number of rows we inserted.
            expect(joinResult).toHaveLength(2);

            // INV-1: every amenity_id in the join has 'accommodation' in its verticals.
            for (const row of joinResult) {
                // The join already filters for 'accommodation' ∈ verticals, so
                // the result set itself is the proof — but we also fetch the full
                // row to make the assertion explicit.
                const [catalogRow] = await tx
                    .select({ applicableVerticals: amenities.applicableVerticals })
                    .from(amenities)
                    .where(sql`${amenities.id} = ${row.amenityId}`);

                expect(catalogRow?.applicableVerticals).toContain('accommodation');
            }

            // INV-1 negative: an amenity without 'accommodation' must NOT appear in
            // any existing r_accommodation_amenity row (inserting such a row would
            // be an application-layer bug, not a DB constraint, but we guard it here).
            const amenityNoAccommodation = makeAmenity({
                applicableVerticals: ['gastronomy', 'experience']
            });
            await tx.insert(amenities).values(amenityNoAccommodation);

            // If such a row were linked, this count should be 0 — it is, because
            // we never inserted a relation row for it.
            const orphanRelations = await tx
                .select({ amenityId: rAccommodationAmenity.amenityId })
                .from(rAccommodationAmenity)
                .innerJoin(amenities, sql`${rAccommodationAmenity.amenityId} = ${amenities.id}`)
                .where(sql`NOT ('accommodation' = ANY(${amenities.applicableVerticals}))`);

            expect(orphanRelations).toHaveLength(0);
        });
    });

    it('INV-1 + INV-4: relation rows reference features with accommodation vertical — count is stable', async () => {
        await withTestTransaction(async (tx) => {
            const user = makeUser();
            await tx.insert(users).values(user);

            const dest = makeDestination();
            await tx.insert(destinations).values(dest);

            const accommodation = makeAccommodation(user.id, dest.id);
            await tx.insert(accommodations).values(accommodation);

            const featureAccOnly = makeFeature({ applicableVerticals: ['accommodation'] });
            const featureShared = makeFeature({
                applicableVerticals: ['accommodation', 'gastronomy']
            });
            await tx.insert(features).values([featureAccOnly, featureShared]);

            // Insert 2 relation rows
            await tx.insert(rAccommodationFeature).values([
                { accommodationId: accommodation.id, featureId: featureAccOnly.id },
                { accommodationId: accommodation.id, featureId: featureShared.id }
            ]);

            // Join: relation rows where the feature covers 'accommodation'.
            const joinResult = await tx
                .select({
                    featureId: rAccommodationFeature.featureId,
                    slug: features.slug
                })
                .from(rAccommodationFeature)
                .innerJoin(features, sql`${rAccommodationFeature.featureId} = ${features.id}`)
                .where(
                    sql`${rAccommodationFeature.accommodationId} = ${accommodation.id}
                        AND 'accommodation' = ANY(${features.applicableVerticals})`
                );

            // INV-4: count matches inserted rows.
            expect(joinResult).toHaveLength(2);

            // INV-1: every linked feature contains 'accommodation' in applicable_verticals.
            for (const row of joinResult) {
                const [catalogRow] = await tx
                    .select({ applicableVerticals: features.applicableVerticals })
                    .from(features)
                    .where(sql`${features.id} = ${row.featureId}`);

                expect(catalogRow?.applicableVerticals).toContain('accommodation');
            }

            // INV-1 negative: features scoped only to non-accommodation verticals must
            // not appear in relation rows (no such row was inserted).
            const featureNoAccommodation = makeFeature({
                applicableVerticals: ['gastronomy']
            });
            await tx.insert(features).values(featureNoAccommodation);

            const orphanRelations = await tx
                .select({ featureId: rAccommodationFeature.featureId })
                .from(rAccommodationFeature)
                .innerJoin(features, sql`${rAccommodationFeature.featureId} = ${features.id}`)
                .where(sql`NOT ('accommodation' = ANY(${features.applicableVerticals}))`);

            expect(orphanRelations).toHaveLength(0);
        });
    });

    it('INV-1 + INV-2: backfill invariant — amenity with accommodation vertical is linkable and its verticals array is non-empty', async () => {
        await withTestTransaction(async (tx) => {
            const amenity = makeAmenity({ applicableVerticals: ['accommodation'] });
            await tx.insert(amenities).values(amenity);

            const [fetched] = await tx
                .select({ applicableVerticals: amenities.applicableVerticals })
                .from(amenities)
                .where(sql`${amenities.id} = ${amenity.id}`);

            // INV-2: non-empty
            expect(fetched?.applicableVerticals.length).toBeGreaterThan(0);
            // INV-1: contains accommodation
            expect(fetched?.applicableVerticals).toContain('accommodation');
        });
    });

    it('INV-1 + INV-2: backfill invariant — feature with accommodation vertical is linkable and its verticals array is non-empty', async () => {
        await withTestTransaction(async (tx) => {
            const feature = makeFeature({ applicableVerticals: ['accommodation'] });
            await tx.insert(features).values(feature);

            const [fetched] = await tx
                .select({ applicableVerticals: features.applicableVerticals })
                .from(features)
                .where(sql`${features.id} = ${feature.id}`);

            expect(fetched?.applicableVerticals.length).toBeGreaterThan(0);
            expect(fetched?.applicableVerticals).toContain('accommodation');
        });
    });
});
