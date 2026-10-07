/**
 * Regression test: AccommodationModel.searchWithRelations with sortBy=mostSaved
 *
 * Bug (SPEC-213 / fixed in feat/worktree-remove-command):
 *   `buildMostSavedOrderExpr` used Drizzle column-object refs
 *   (`${userBookmarks.entityId}`) inside the correlated subquery. When
 *   composed into `searchWithRelations` via Drizzle's relational API (lateral
 *   joins), those refs got re-aliased to the OUTER table, producing
 *   `WHERE "accommodations"."entity_id" = ...` — a column that does not exist
 *   on `accommodations`. Postgres threw a 500 "column does not exist" error.
 *
 * Fix:
 *   Column refs inside the subquery are now emitted as raw SQL identifiers
 *   (`"user_bookmarks"."entity_id"` etc.) so Drizzle cannot re-alias them.
 *   Same workaround already applied to `buildAmenityIntersectionClause`.
 *
 * Test strategy:
 *   - Uses a rollback-isolated transaction (withTestTransaction) so DB state is
 *     clean per run and the integration-test DB is not polluted.
 *   - Inserts two accommodations owned by the same host in the same destination.
 *     One accommodation gets a user_bookmarks row; the other does not.
 *   - Calls `searchWithRelations({ sorts: [{ field: 'mostSaved', order: 'desc' }] })`
 *     — the exact path the public listing API takes.
 *   - Asserts: (1) the call resolves without throwing, (2) both accommodations
 *     are returned, and (3) the bookmarked accommodation appears before the
 *     un-bookmarked one (ORDER BY count DESC correctness).
 *
 * With the OLD `${userBookmarks.entityId}` code this test throws
 * PG error 42703 "column accommodations.entity_id does not exist".
 * With the fix it passes.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import { accommodations, destinations, userBookmarks, users } from '../../src/schemas/index.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => {
    await closeTestPool();
});

describe('AccommodationModel.searchWithRelations — mostSaved sort (SPEC-213 regression)', () => {
    it('resolves without error when sortBy=mostSaved (bug: Drizzle re-aliasing produced invalid SQL)', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange: owner + destination + one accommodation
            const ownerPayload = testData.user({ role: 'HOST' });
            const [owner] = await tx.insert(users).values(ownerPayload).returning();
            if (!owner) throw new Error('Failed to insert owner');

            const destinationPayload = testData.destination({ ownerId: owner.id });
            const [destination] = await tx
                .insert(destinations)
                .values(destinationPayload)
                .returning();
            if (!destination) throw new Error('Failed to insert destination');

            const uid = crypto.randomUUID().slice(0, 8);
            const [accommodation] = await tx
                .insert(accommodations)
                .values({
                    ownerId: owner.id,
                    destinationId: destination.id,
                    slug: `spec213-mostsaved-${uid}`,
                    name: 'SPEC-213 MostSaved Regression Test',
                    summary: 'Regression test for mostSaved sort bug.',
                    type: 'HOUSE',
                    description: 'Accommodation inserted for the mostSaved sort regression test.',
                    lifecycleState: 'ACTIVE'
                })
                .returning();
            if (!accommodation) throw new Error('Failed to insert accommodation');

            // Act: call the exact method and sort path that triggered the 500.
            // With OLD code: throws "column accommodations.entity_id does not exist".
            // With FIXED code: resolves normally.
            // AccommodationModel takes no constructor args; tx is passed per-call.
            const model = new AccommodationModel();
            const result = await model.searchWithRelations(
                {
                    sorts: [{ field: 'mostSaved', order: 'desc' }],
                    featuredFirst: true,
                    pageSize: 10
                },
                tx
            );

            // Assert: no throw (reaching this line means the SQL was valid)
            expect(result).toBeDefined();
            expect(result.items).toBeDefined();
            expect(Array.isArray(result.items)).toBe(true);

            // The inserted accommodation must appear in the results
            const ids = result.items.map((item) => item.id);
            expect(ids).toContain(accommodation.id);
        });
    });

    it('orders accommodations with more bookmarks first when sortBy=mostSaved desc', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange: a common owner + destination for both accommodations
            const ownerPayload = testData.user({ role: 'HOST' });
            const [owner] = await tx.insert(users).values(ownerPayload).returning();
            if (!owner) throw new Error('Failed to insert owner');

            const destinationPayload = testData.destination({ ownerId: owner.id });
            const [destination] = await tx
                .insert(destinations)
                .values(destinationPayload)
                .returning();
            if (!destination) throw new Error('Failed to insert destination');

            // A separate user to act as the bookmarker
            const bookmarkerPayload = testData.user({ role: 'USER' });
            const [bookmarker] = await tx.insert(users).values(bookmarkerPayload).returning();
            if (!bookmarker) throw new Error('Failed to insert bookmarker');

            const uid = crypto.randomUUID().slice(0, 8);

            // Accommodation A — will receive a bookmark (higher count)
            const [accommodationA] = await tx
                .insert(accommodations)
                .values({
                    ownerId: owner.id,
                    destinationId: destination.id,
                    slug: `spec213-order-a-${uid}`,
                    name: 'SPEC-213 Order A (bookmarked)',
                    summary: 'Accommodation A — bookmarked.',
                    type: 'HOUSE',
                    description: 'Accommodation A for mostSaved ordering regression test.',
                    lifecycleState: 'ACTIVE'
                })
                .returning();
            if (!accommodationA) throw new Error('Failed to insert accommodation A');

            // Accommodation B — no bookmarks (lower count = 0)
            const [accommodationB] = await tx
                .insert(accommodations)
                .values({
                    ownerId: owner.id,
                    destinationId: destination.id,
                    slug: `spec213-order-b-${uid}`,
                    name: 'SPEC-213 Order B (no bookmark)',
                    summary: 'Accommodation B — not bookmarked.',
                    type: 'HOUSE',
                    description: 'Accommodation B for mostSaved ordering regression test.',
                    lifecycleState: 'ACTIVE'
                })
                .returning();
            if (!accommodationB) throw new Error('Failed to insert accommodation B');

            // Insert a bookmark for accommodation A only
            await tx.insert(userBookmarks).values({
                userId: bookmarker.id,
                entityId: accommodationA.id,
                entityType: 'ACCOMMODATION',
                lifecycleState: 'ACTIVE'
            });

            // Act
            const model = new AccommodationModel();
            const result = await model.searchWithRelations(
                {
                    sorts: [{ field: 'mostSaved', order: 'desc' }],
                    pageSize: 50
                },
                tx
            );

            // Assert: both accommodations returned
            const ids = result.items.map((item) => item.id);
            expect(ids).toContain(accommodationA.id);
            expect(ids).toContain(accommodationB.id);

            // Accommodation A (1 bookmark) must sort BEFORE accommodation B (0 bookmarks)
            const indexA = ids.indexOf(accommodationA.id);
            const indexB = ids.indexOf(accommodationB.id);
            expect(indexA).toBeLessThan(indexB);
        });
    });
});
