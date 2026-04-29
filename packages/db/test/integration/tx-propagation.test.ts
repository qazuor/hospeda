/**
 * SPEC-061 — core transaction propagation suite.
 *
 * Validates the underlying Drizzle + PostgreSQL transaction mechanism that
 * the rest of the project relies on:
 *
 *   1. `tx.query.users.findMany` sees uncommitted rows within the same tx.
 *   2. `withTransaction` rolls back on error.
 *   3. Aggregations (count via length) include uncommitted rows within tx.
 *   4. `tx.select()` returns uncommitted rows within tx.
 *   5. Insert + findFirst within tx; rollback removes the row.
 *   6. Soft-delete + restore semantics propagate through tx and rollback.
 *   7. Concurrent REPEATABLE READ transactions do not see each other.
 *   8. UNIQUE constraint violation surfaces as PG error code 23505.
 *   9. FOREIGN KEY violation surfaces as PG error code 23503.
 *  10. Update propagates within tx and reverts on rollback.
 *
 * Tests are intentionally raw-Drizzle level; model-class propagation tests
 * (`model-tx-propagation.test.ts`) belong in Phase B once SPEC-058/060 land
 * and the `getDb()` boundary is fully replaced.
 */
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { tags, users } from '../../src/schemas/index.ts';
import {
    closeTestPool,
    getTestDb,
    testData,
    withCleanSlate,
    withTestTransaction
} from './helpers.ts';

/**
 * Extracts a PostgreSQL error code from a thrown error. Drizzle wraps the
 * underlying pg.DatabaseError in a `DrizzleQueryError` whose `cause` points
 * at the original error; tests should not have to know which layer surfaced.
 */
function extractPgErrorCode(error: unknown): string | undefined {
    const direct = (error as { code?: string }).code;
    if (direct) return direct;
    const cause = (error as { cause?: { code?: string } }).cause;
    return cause?.code;
}

afterAll(async () => {
    await closeTestPool();
});

describe('SPEC-061 — Transaction Propagation (real PostgreSQL)', () => {
    // ── 1. tx.query relational API sees uncommitted data within the same tx ─
    describe('Drizzle relational query API with tx', () => {
        it('findMany sees uncommitted data within the same tx; gone after rollback', async () => {
            const userData = testData.user();

            await withTestTransaction(async (tx) => {
                await tx.insert(users).values(userData);

                const found = await tx.query.users.findMany({
                    where: eq(users.id, userData.id)
                });

                expect(found).toHaveLength(1);
                expect(found[0]?.email).toBe(userData.email);
            });

            // Use unique ID to avoid coupling with parallel committed rows.
            const db = getTestDb();
            const afterRollback = await db.query.users.findMany({
                where: eq(users.id, userData.id)
            });
            expect(afterRollback).toHaveLength(0);
        });
    });

    // ── 2. withTransaction rollback on error ────────────────────────────────
    describe('Transaction rollback on error', () => {
        it('rolls back the entire tx when the callback throws', async () => {
            const db = getTestDb();
            const userData = testData.user();

            await expect(
                db.transaction(async (tx) => {
                    await tx.insert(users).values(userData);
                    throw new Error('Intentional rollback');
                })
            ).rejects.toThrow('Intentional rollback');

            const found = await db.query.users.findMany({
                where: eq(users.id, userData.id)
            });
            expect(found).toHaveLength(0);
        });
    });

    // ── 3. count includes uncommitted rows within tx ────────────────────────
    describe('count() with tx', () => {
        it('count of inserted rows reflects uncommitted state', async () => {
            await withTestTransaction(async (tx) => {
                const before = await tx.select().from(users);
                const countBefore = before.length;

                await tx.insert(users).values(testData.user());
                await tx.insert(users).values(testData.user());
                await tx.insert(users).values(testData.user());

                const after = await tx.select().from(users);
                expect(after.length).toBe(countBefore + 3);
            });
        });
    });

    // ── 4. findAll-equivalent select() with tx ──────────────────────────────
    describe('select() with tx', () => {
        it('returns uncommitted rows within the same tx', async () => {
            await withTestTransaction(async (tx) => {
                const u1 = testData.user();
                const u2 = testData.user();
                await tx.insert(users).values(u1);
                await tx.insert(users).values(u2);

                const found1 = await tx.select().from(users).where(eq(users.id, u1.id));
                expect(found1).toHaveLength(1);
                expect(found1[0]?.email).toBe(u1.email);

                const found2 = await tx.select().from(users).where(eq(users.id, u2.id));
                expect(found2).toHaveLength(1);
            });
        });
    });

    // ── 5. create + findById equivalent within tx ───────────────────────────
    describe('insert + findFirst with tx', () => {
        it('inserted row visible via findFirst within the same tx; absent after rollback', async () => {
            const userData = testData.user();

            await withTestTransaction(async (tx) => {
                await tx.insert(users).values(userData);

                const found = await tx.query.users.findFirst({
                    where: eq(users.id, userData.id)
                });
                expect(found).toBeDefined();
                expect(found?.id).toBe(userData.id);
            });

            const db = getTestDb();
            const afterRollback = await db.query.users.findFirst({
                where: eq(users.id, userData.id)
            });
            expect(afterRollback).toBeUndefined();
        });
    });

    // ── 6. softDelete + restore with tx ─────────────────────────────────────
    // Uses `tags` rather than `users` because the production
    // `delete_entity_bookmarks` trigger (manual migration 0014) fires on user
    // updates and contains a pre-existing enum-vs-text comparison bug
    // unrelated to SPEC-061. `tags` has no such trigger and exercises the
    // exact same softDelete+restore semantics.
    describe('soft delete + restore with tx', () => {
        it('softDelete sets deletedAt, restore clears it, rollback reverts both', async () => {
            const tagData = testData.tag();

            await withTestTransaction(async (tx) => {
                await tx.insert(tags).values(tagData);

                await tx.update(tags).set({ deletedAt: new Date() }).where(eq(tags.id, tagData.id));

                const afterDelete = await tx.query.tags.findFirst({
                    where: eq(tags.id, tagData.id)
                });
                expect(afterDelete).toBeDefined();
                expect(afterDelete?.deletedAt).not.toBeNull();

                await tx.update(tags).set({ deletedAt: null }).where(eq(tags.id, tagData.id));

                const afterRestore = await tx.query.tags.findFirst({
                    where: eq(tags.id, tagData.id)
                });
                expect(afterRestore).toBeDefined();
                expect(afterRestore?.deletedAt).toBeNull();
            });

            const db = getTestDb();
            const afterRollback = await db.query.tags.findFirst({
                where: eq(tags.id, tagData.id)
            });
            expect(afterRollback).toBeUndefined();
        });
    });

    // ── 7. concurrent REPEATABLE READ tx isolation ──────────────────────────
    describe('Concurrent tx isolation (REPEATABLE READ)', () => {
        it('two concurrent transactions each see only their own writes', async () => {
            await withCleanSlate(async (db) => {
                const userA = testData.user({ displayName: 'User A' });
                const userB = testData.user({ displayName: 'User B' });

                // REPEATABLE READ takes a snapshot at tx start, making the
                // assertion deterministic regardless of commit timing.
                const txConfig = { isolationLevel: 'repeatable read' as const };

                const [resultA, resultB] = await Promise.allSettled([
                    db.transaction(async (txA) => {
                        await txA.insert(users).values(userA);
                        await new Promise((r) => setTimeout(r, 100));
                        const seenByA = await txA.query.users.findMany();
                        return seenByA.map((u) => u.displayName);
                    }, txConfig),
                    db.transaction(async (txB) => {
                        await txB.insert(users).values(userB);
                        await new Promise((r) => setTimeout(r, 100));
                        const seenByB = await txB.query.users.findMany();
                        return seenByB.map((u) => u.displayName);
                    }, txConfig)
                ]);

                expect(resultA.status).toBe('fulfilled');
                if (resultA.status === 'fulfilled') {
                    expect(resultA.value).toContain('User A');
                    expect(resultA.value).not.toContain('User B');
                }

                expect(resultB.status).toBe('fulfilled');
                if (resultB.status === 'fulfilled') {
                    expect(resultB.value).toContain('User B');
                    expect(resultB.value).not.toContain('User A');
                }
            });
        });
    });

    // ── 8 + 9. constraint enforcement ───────────────────────────────────────
    describe('Constraint enforcement', () => {
        it('rejects duplicate UNIQUE (email) with PG error code 23505', async () => {
            await withTestTransaction(async (tx) => {
                const email = `unique-${crypto.randomUUID()}@test.com`;
                await tx.insert(users).values(testData.user({ email }));

                try {
                    await tx.insert(users).values(testData.user({ email }));
                    expect.fail('Should have thrown unique constraint error');
                } catch (error: unknown) {
                    expect(extractPgErrorCode(error)).toBe('23505');
                }
            });
        });

        it('rejects invalid FK reference with PG error code 23503', async () => {
            await withTestTransaction(async (tx) => {
                const ghostId = crypto.randomUUID();
                try {
                    await tx.insert(users).values(testData.user({ createdById: ghostId }));
                    expect.fail('Should have thrown FK constraint error');
                } catch (error: unknown) {
                    expect(extractPgErrorCode(error)).toBe('23503');
                }
            });
        });
    });

    // ── 10. update with tx ──────────────────────────────────────────────────
    describe('update() with tx', () => {
        it('update is visible within tx; full row reverted after rollback', async () => {
            const original = testData.user();
            const updatedEmail = `updated-${crypto.randomUUID()}@test.com`;

            await withTestTransaction(async (tx) => {
                await tx.insert(users).values(original);

                await tx
                    .update(users)
                    .set({ email: updatedEmail })
                    .where(eq(users.id, original.id));

                const found = await tx.query.users.findFirst({
                    where: eq(users.id, original.id)
                });
                expect(found?.email).toBe(updatedEmail);
            });

            const db = getTestDb();
            const afterRollback = await db.query.users.findFirst({
                where: eq(users.id, original.id)
            });
            expect(afterRollback).toBeUndefined();
        });
    });
});
