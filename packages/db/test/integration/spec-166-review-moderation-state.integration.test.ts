/**
 * Integration tests: moderation columns on `accommodation_reviews` and
 * `destination_reviews` (SPEC-166 T-009).
 *
 * Assertions:
 * 1. `moderation_state` column exists in both tables and is NOT NULL.
 * 2. The `accommodation_reviews_moderationState_idx` and
 *    `destination_reviews_moderationState_idx` indexes exist.
 * 3. The per-entity DEFAULT is correct:
 *    - `accommodation_reviews` → 'APPROVED'
 *    - `destination_reviews`   → 'PENDING'
 * 4. Explicit APPROVED/PENDING/REJECTED values round-trip correctly.
 * 5. An invalid `moderation_state` value is rejected by the DB enum.
 *
 * Uses the SPEC-061 rollback-isolated infrastructure (`withTestTransaction`).
 * Each test creates the minimal parent rows it needs inside the transaction and
 * verifies only the moderation-related columns. Pre-existing rows are NOT
 * covered here (the backfill UPDATE in the migration handles those; see
 * 0003_chemical_sharon_carter.sql).
 */
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { accommodations } from '../../src/schemas/accommodation/accommodation.dbschema.ts';
import { accommodationReviews } from '../../src/schemas/accommodation/accommodation_review.dbschema.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { destinationReviews } from '../../src/schemas/destination/destination_review.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { closeTestPool, getTestPool, testData, withTestTransaction } from './helpers.ts';

// ---------------------------------------------------------------------------
// Minimal rating fixtures (satisfies NOT NULL jsonb columns)
// ---------------------------------------------------------------------------

const ACCOMMODATION_RATING = {
    cleanliness: 5,
    hospitality: 5,
    services: 5,
    accuracy: 5,
    communication: 5,
    location: 5
};

const DESTINATION_RATING = {
    overall: 5
};

// ---------------------------------------------------------------------------
// Schema introspection helpers (use raw pg pool — no Drizzle ORM needed)
// ---------------------------------------------------------------------------

/**
 * Returns the column default expression for a given table/column from
 * `information_schema.columns`, or null if the column does not exist.
 */
async function getColumnDefault(tableName: string, columnName: string): Promise<string | null> {
    const pool = getTestPool();
    const res = await pool.query<{ column_default: string | null }>(
        `SELECT column_default
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = $1
            AND column_name  = $2`,
        [tableName, columnName]
    );
    return res.rows[0]?.column_default ?? null;
}

/**
 * Returns whether a given table/column exists with `is_nullable = 'NO'`
 * (i.e., the column is NOT NULL).
 */
async function isColumnNotNull(tableName: string, columnName: string): Promise<boolean> {
    const pool = getTestPool();
    const res = await pool.query<{ is_nullable: string }>(
        `SELECT is_nullable
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = $1
            AND column_name  = $2`,
        [tableName, columnName]
    );
    if (res.rows.length === 0) return false;
    return res.rows[0].is_nullable === 'NO';
}

/**
 * Returns whether a named index exists in the public schema.
 */
async function indexExists(indexName: string): Promise<boolean> {
    const pool = getTestPool();
    const res = await pool.query<{ cnt: string }>(
        `SELECT COUNT(*) AS cnt
           FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname   = $1`,
        [indexName]
    );
    return Number(res.rows[0]?.cnt ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SPEC-166 — review moderation_state columns', () => {
    afterAll(async () => {
        await closeTestPool();
    });

    // -----------------------------------------------------------------------
    // Schema introspection: column exists + is NOT NULL + has correct default
    // -----------------------------------------------------------------------

    describe('accommodation_reviews schema', () => {
        it('has moderation_state column that is NOT NULL', async () => {
            const notNull = await isColumnNotNull('accommodation_reviews', 'moderation_state');
            expect(notNull).toBe(true);
        });

        it('has moderation_state default of APPROVED', async () => {
            const def = await getColumnDefault('accommodation_reviews', 'moderation_state');
            // PostgreSQL stores enum defaults as: 'APPROVED'::moderation_status_enum
            expect(def).toContain('APPROVED');
        });

        it('has accommodation_reviews_moderationState_idx index', async () => {
            const exists = await indexExists('accommodation_reviews_moderationState_idx');
            expect(exists).toBe(true);
        });
    });

    describe('destination_reviews schema', () => {
        it('has moderation_state column that is NOT NULL', async () => {
            const notNull = await isColumnNotNull('destination_reviews', 'moderation_state');
            expect(notNull).toBe(true);
        });

        it('has moderation_state default of PENDING', async () => {
            const def = await getColumnDefault('destination_reviews', 'moderation_state');
            // PostgreSQL stores enum defaults as: 'PENDING'::moderation_status_enum
            expect(def).toContain('PENDING');
        });

        it('has destination_reviews_moderationState_idx index', async () => {
            const exists = await indexExists('destination_reviews_moderationState_idx');
            expect(exists).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Round-trip: accommodation_reviews
    // -----------------------------------------------------------------------

    describe('accommodation_reviews round-trip', () => {
        it('inserts with default APPROVED when moderationState is omitted', async () => {
            await withTestTransaction(async (tx) => {
                const user = testData.user();
                const dest = testData.destination();
                await tx.insert(users).values(user);
                await tx.insert(destinations).values(dest);

                const accommodation = {
                    id: crypto.randomUUID(),
                    slug: `acc-${crypto.randomUUID().slice(0, 8)}`,
                    name: 'Test Accommodation',
                    summary: 'A test summary',
                    type: 'HOTEL' as const,
                    description: 'A test description',
                    ownerId: user.id,
                    destinationId: dest.id
                };
                await tx.insert(accommodations).values(accommodation);

                // Insert WITHOUT moderationState — DB default should apply.
                const reviewId = crypto.randomUUID();
                await tx.insert(accommodationReviews).values({
                    id: reviewId,
                    accommodationId: accommodation.id,
                    userId: user.id,
                    rating: ACCOMMODATION_RATING
                });

                const [row] = await tx
                    .select({ moderationState: accommodationReviews.moderationState })
                    .from(accommodationReviews)
                    .where(sql`${accommodationReviews.id} = ${reviewId}`);

                expect(row?.moderationState).toBe('APPROVED');
            });
        });

        it('persists an explicit PENDING state', async () => {
            await withTestTransaction(async (tx) => {
                const user = testData.user();
                const dest = testData.destination();
                await tx.insert(users).values(user);
                await tx.insert(destinations).values(dest);

                const accommodation = {
                    id: crypto.randomUUID(),
                    slug: `acc-${crypto.randomUUID().slice(0, 8)}`,
                    name: 'Test Accommodation',
                    summary: 'A test summary',
                    type: 'HOTEL' as const,
                    description: 'A test description',
                    ownerId: user.id,
                    destinationId: dest.id
                };
                await tx.insert(accommodations).values(accommodation);

                const reviewId = crypto.randomUUID();
                await tx.insert(accommodationReviews).values({
                    id: reviewId,
                    accommodationId: accommodation.id,
                    userId: user.id,
                    rating: ACCOMMODATION_RATING,
                    moderationState: 'PENDING'
                });

                const [row] = await tx
                    .select({ moderationState: accommodationReviews.moderationState })
                    .from(accommodationReviews)
                    .where(sql`${accommodationReviews.id} = ${reviewId}`);

                expect(row?.moderationState).toBe('PENDING');
            });
        });

        it('rejects an invalid moderation_state value at the DB level', async () => {
            await expect(
                withTestTransaction(async (tx) => {
                    const user = testData.user();
                    const dest = testData.destination();
                    await tx.insert(users).values(user);
                    await tx.insert(destinations).values(dest);

                    const accommodation = {
                        id: crypto.randomUUID(),
                        slug: `acc-${crypto.randomUUID().slice(0, 8)}`,
                        name: 'Test Accommodation',
                        summary: 'A test summary',
                        type: 'HOTEL' as const,
                        description: 'A test description',
                        ownerId: user.id,
                        destinationId: dest.id
                    };
                    await tx.insert(accommodations).values(accommodation);

                    await tx.insert(accommodationReviews).values({
                        id: crypto.randomUUID(),
                        accommodationId: accommodation.id,
                        userId: user.id,
                        rating: ACCOMMODATION_RATING,
                        moderationState: 'INVALID_VALUE' as never
                    });
                })
            ).rejects.toThrow();
        });
    });

    // -----------------------------------------------------------------------
    // Round-trip: destination_reviews
    // -----------------------------------------------------------------------

    describe('destination_reviews round-trip', () => {
        it('inserts with default PENDING when moderationState is omitted', async () => {
            await withTestTransaction(async (tx) => {
                const user = testData.user();
                const dest = testData.destination();
                await tx.insert(users).values(user);
                await tx.insert(destinations).values(dest);

                const reviewId = crypto.randomUUID();
                await tx.insert(destinationReviews).values({
                    id: reviewId,
                    userId: user.id,
                    destinationId: dest.id,
                    rating: DESTINATION_RATING
                });

                const [row] = await tx
                    .select({ moderationState: destinationReviews.moderationState })
                    .from(destinationReviews)
                    .where(sql`${destinationReviews.id} = ${reviewId}`);

                expect(row?.moderationState).toBe('PENDING');
            });
        });

        it('persists an explicit APPROVED state', async () => {
            await withTestTransaction(async (tx) => {
                const user = testData.user();
                const dest = testData.destination();
                await tx.insert(users).values(user);
                await tx.insert(destinations).values(dest);

                const reviewId = crypto.randomUUID();
                await tx.insert(destinationReviews).values({
                    id: reviewId,
                    userId: user.id,
                    destinationId: dest.id,
                    rating: DESTINATION_RATING,
                    moderationState: 'APPROVED'
                });

                const [row] = await tx
                    .select({ moderationState: destinationReviews.moderationState })
                    .from(destinationReviews)
                    .where(sql`${destinationReviews.id} = ${reviewId}`);

                expect(row?.moderationState).toBe('APPROVED');
            });
        });

        it('persists an explicit REJECTED state', async () => {
            await withTestTransaction(async (tx) => {
                const user = testData.user();
                const dest = testData.destination();
                await tx.insert(users).values(user);
                await tx.insert(destinations).values(dest);

                const reviewId = crypto.randomUUID();
                await tx.insert(destinationReviews).values({
                    id: reviewId,
                    userId: user.id,
                    destinationId: dest.id,
                    rating: DESTINATION_RATING,
                    moderationState: 'REJECTED'
                });

                const [row] = await tx
                    .select({ moderationState: destinationReviews.moderationState })
                    .from(destinationReviews)
                    .where(sql`${destinationReviews.id} = ${reviewId}`);

                expect(row?.moderationState).toBe('REJECTED');
            });
        });

        it('rejects an invalid moderation_state value at the DB level', async () => {
            await expect(
                withTestTransaction(async (tx) => {
                    const user = testData.user();
                    const dest = testData.destination();
                    await tx.insert(users).values(user);
                    await tx.insert(destinations).values(dest);

                    await tx.insert(destinationReviews).values({
                        id: crypto.randomUUID(),
                        userId: user.id,
                        destinationId: dest.id,
                        rating: DESTINATION_RATING,
                        moderationState: 'INVALID_VALUE' as never
                    });
                })
            ).rejects.toThrow();
        });
    });
});
