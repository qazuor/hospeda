/**
 * SPEC-061 Phase B — model transaction propagation suite.
 *
 * Validates that the BaseModel-based model layer (SPEC-058 + SPEC-060) honours
 * the optional `tx?: DrizzleClient` parameter on every CRUD method:
 *
 *   - The standard `findById`, `findOne`, `create`, `update`, `softDelete`,
 *     `restore`, `count`, and `findAll` methods all participate in a caller
 *     transaction when `tx` is supplied, and roll back together when the
 *     transaction is rolled back.
 *   - Subclass overrides that introduce custom signatures (UserModel.findAll
 *     with `q` text search, count with `q`) still thread `tx` correctly.
 *   - `findWithRelations` overrides (DestinationModel) load related entities
 *     inside the same transaction.
 *   - Cross-model writes inside a single `db.transaction(...)` are atomic.
 *
 * Phase A (`tx-propagation.test.ts`) covered the raw Drizzle layer; this file
 * covers the BaseModel boundary so future refactors that change how the model
 * grabs its client cannot silently break tx propagation.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import { DestinationModel } from '../../src/models/destination/destination.model.ts';
import { TagModel } from '../../src/models/tag/tag.model.ts';
import { UserModel } from '../../src/models/user/user.model.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { tags } from '../../src/schemas/tag/tag.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { closeTestPool, getTestDb, testData, withTestTransaction } from './helpers.ts';

beforeAll(() => {
    // Wire @repo/db's runtime client to the SPEC-061 test pool so that
    // model methods called WITHOUT an explicit `tx` (i.e., the post-rollback
    // assertions) hit the ephemeral test DB instead of throwing
    // "Database not initialized".
    setDb(getTestDb());
});

afterAll(async () => {
    await closeTestPool();
});

describe('SPEC-061 Phase B — Model transaction propagation', () => {
    // ── BaseModel: standard CRUD threads tx ─────────────────────────────────
    describe('BaseModel CRUD with tx (TagModel)', () => {
        const tagModel = new TagModel();

        it('findById with tx sees uncommitted writes', async () => {
            const data = testData.tag();

            await withTestTransaction(async (tx) => {
                await tx.insert(tags).values(data);

                const found = await tagModel.findById(data.id, tx);
                expect(found).toBeDefined();
                expect(found?.slug).toBe(data.slug);
            });

            // Outside the rollback the row must not exist.
            const after = await tagModel.findById(data.id);
            expect(after).toBeNull();
        });

        it('findOne with tx sees uncommitted writes', async () => {
            const data = testData.tag();

            await withTestTransaction(async (tx) => {
                await tx.insert(tags).values(data);

                const found = await tagModel.findOne({ slug: data.slug }, tx);
                expect(found?.id).toBe(data.id);
            });
        });

        it('create + update + softDelete + restore all participate in tx', async () => {
            const data = testData.tag();

            await withTestTransaction(async (tx) => {
                const created = await tagModel.create(data, tx);
                expect(created.id).toBe(data.id);

                await tagModel.update({ id: data.id }, { name: 'Renamed Tag' }, tx);
                const afterUpdate = await tagModel.findById(data.id, tx);
                expect(afterUpdate?.name).toBe('Renamed Tag');

                const softCount = await tagModel.softDelete({ id: data.id }, tx);
                expect(softCount).toBe(1);

                const afterSoftDelete = await tagModel.findById(data.id, tx);
                expect(afterSoftDelete?.deletedAt).not.toBeNull();

                const restoreCount = await tagModel.restore({ id: data.id }, tx);
                expect(restoreCount).toBe(1);

                const afterRestore = await tagModel.findById(data.id, tx);
                expect(afterRestore?.deletedAt).toBeNull();
            });

            // Whole chain is gone after rollback.
            const after = await tagModel.findById(data.id);
            expect(after).toBeNull();
        });

        it('count with tx counts uncommitted rows', async () => {
            await withTestTransaction(async (tx) => {
                const before = await tagModel.count({}, { tx });

                await tx.insert(tags).values(testData.tag());
                await tx.insert(tags).values(testData.tag());

                const after = await tagModel.count({}, { tx });
                expect(after).toBe(before + 2);
            });
        });

        it('findAll with tx returns uncommitted rows', async () => {
            const a = testData.tag({ name: 'TX_TAG_A' });
            const b = testData.tag({ name: 'TX_TAG_B' });

            await withTestTransaction(async (tx) => {
                await tx.insert(tags).values(a);
                await tx.insert(tags).values(b);

                const inTx = await tagModel.findAll({ id: a.id }, undefined, undefined, tx);
                expect(inTx.items).toHaveLength(1);
                expect(inTx.items[0]?.id).toBe(a.id);
            });
        });
    });

    // ── Subclass override (UserModel.findAll with text search) ─────────────
    // Skipped: UserModel.findAll triggers the production
    // `delete_entity_bookmarks` trigger on update paths in some flows.
    // For Phase B we exercise the read-only override (no soft-delete) so we
    // avoid the unrelated enum-vs-text bug in manual migration 0014.
    describe('UserModel custom findAll/count override threads tx', () => {
        const userModel = new UserModel();

        it('findAll with q text search uses tx and sees uncommitted users', async () => {
            // Unique marker keeps the assertion isolated from any committed
            // rows added by other parallel tests/migrations.
            const marker = `tx-prop-${crypto.randomUUID().slice(0, 12)}`;
            const data = testData.user({ displayName: `User ${marker}` });

            await withTestTransaction(async (tx) => {
                await tx.insert(users).values(data);

                const result = await userModel.findAll(
                    { q: marker },
                    { page: 1, pageSize: 20 },
                    undefined,
                    tx
                );
                expect(result.total).toBe(1);
                expect(result.items[0]?.id).toBe(data.id);
            });

            // After rollback the user must not surface via the same query.
            const after = await userModel.findAll({ q: marker }, { page: 1, pageSize: 20 });
            expect(after.total).toBe(0);
        });

        it('count with q text search uses tx', async () => {
            const marker = `cnt-${crypto.randomUUID().slice(0, 12)}`;

            await withTestTransaction(async (tx) => {
                await tx.insert(users).values(testData.user({ displayName: `A ${marker}` }));
                await tx.insert(users).values(testData.user({ displayName: `B ${marker}` }));

                const total = await userModel.count({ q: marker }, { tx });
                expect(total).toBe(2);
            });

            const after = await userModel.count({ q: marker });
            expect(after).toBe(0);
        });
    });

    // ── findWithRelations override threads tx (DestinationModel) ───────────
    describe('findWithRelations override threads tx (DestinationModel)', () => {
        const destinationModel = new DestinationModel();

        it('reads a destination + its relations from inside a tx', async () => {
            const data = testData.destination();

            await withTestTransaction(async (tx) => {
                await tx.insert(destinations).values(data);

                // Even with no `with` keys requested the override must use the
                // tx client (it falls back to findOne) and see the row.
                // Pick concrete relations declared on destinationsRelations
                // that don't go through junction tables (which Drizzle's
                // relational query API can't resolve without explicit
                // back-references on both sides).
                const result = await destinationModel.findWithRelations(
                    { id: data.id },
                    { accommodations: true, reviews: true },
                    tx
                );

                expect(result).toBeDefined();
                expect(result?.id).toBe(data.id);
                // Relations are empty because we didn't insert dependent rows
                // — but the existence of the result confirms the tx client
                // resolved the correct row.
            });

            const db = getTestDb();
            const after = await db
                .select({ id: destinations.id })
                .from(destinations)
                .where(eq(destinations.id, data.id));
            expect(after).toHaveLength(0);
        });
    });

    // ── Cross-model writes inside one tx are atomic ─────────────────────────
    describe('Cross-model atomicity', () => {
        const userModel = new UserModel();
        const tagModel = new TagModel();

        it('rolls back writes from multiple models when the outer tx fails', async () => {
            const userData = testData.user();
            const tagData = testData.tag();
            const db = getTestDb();

            await expect(
                db.transaction(async (tx) => {
                    await userModel.create(userData, tx);
                    await tagModel.create(tagData, tx);
                    throw new Error('cross-model intentional rollback');
                })
            ).rejects.toThrow('cross-model intentional rollback');

            // Both writes must be absent post-rollback.
            const userAfter = await userModel.findById(userData.id);
            const tagAfter = await tagModel.findById(tagData.id);
            expect(userAfter).toBeNull();
            expect(tagAfter).toBeNull();
        });
    });
});
