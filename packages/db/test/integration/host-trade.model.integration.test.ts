/**
 * Integration tests for HostTradeModel.findForHost (SPEC-241 T-008).
 *
 * Each test wraps DB writes in `withTestTransaction` so they are always
 * rolled back — no TRUNCATE overhead, parallel-safe via MVCC isolation.
 */
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import { HostTradeModel } from '../../src/models/hostTrade/host-trade.model.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { hostTrades } from '../../src/schemas/host-trade/host_trade.dbschema.ts';
import { hostTradeCategories } from '../../src/schemas/host-trade/host-trade-category.dbschema.ts';
import { hostTradeCategoryGroups } from '../../src/schemas/host-trade/host-trade-category-group.dbschema.ts';
import { rHostTradeCategory } from '../../src/schemas/host-trade/r_host_trade_category.dbschema.ts';
import * as hospedaSchema from '../../src/schemas/index.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, getTestDb, getTestPool, testData, withTestTransaction } from './helpers.ts';

beforeAll(() => {
    // Wire the module-level getDb() to the ephemeral test pool so that model
    // methods called WITHOUT an explicit `tx` hit the test DB instead of
    // throwing "Database not initialized".
    setDb(getTestDb());
});

afterAll(async () => {
    await closeTestPool();
});

describe('HostTradeModel.findForHost', () => {
    const model = new HostTradeModel();

    /**
     * Returns the minimal set of fields required to insert a host_trades row.
     * `id` and `slug` are randomised per call to avoid unique-constraint
     * collisions across tests running in parallel.
     */
    function tradeFixture(
        destinationId: string,
        overrides: Partial<typeof hostTrades.$inferInsert> = {}
    ): typeof hostTrades.$inferInsert {
        const uid = crypto.randomUUID().slice(0, 8);
        return {
            id: crypto.randomUUID(),
            slug: `trade-${uid}`,
            name: `Trade ${uid}`,
            category: 'PLOMERIA' as const,
            contact: '+54 999 000 001',
            benefit: '10% descuento',
            destinationId,
            is24h: false,
            isActive: true,
            ...overrides
        };
    }

    it('returns only trades whose destinationId is in the provided list', async () => {
        await withTestTransaction(async (tx) => {
            // Seed two destinations and a user (satisfies nullable FK for createdById)
            const user = testData.user();
            const dest1 = testData.destination();
            const dest2 = testData.destination();
            const dest3 = testData.destination();

            await tx.insert(users).values(user);

            // Insert dest tables — destination requires users for createdById (nullable)
            const { destinations } = await import(
                '../../src/schemas/destination/destination.dbschema.ts'
            );
            await tx.insert(destinations).values(dest1);
            await tx.insert(destinations).values(dest2);
            await tx.insert(destinations).values(dest3);

            const trade1 = tradeFixture(dest1.id, { name: 'AAA' });
            const trade2 = tradeFixture(dest2.id, { name: 'BBB' });
            const tradeOther = tradeFixture(dest3.id, { name: 'CCC' });

            await tx.insert(hostTrades).values(trade1);
            await tx.insert(hostTrades).values(trade2);
            await tx.insert(hostTrades).values(tradeOther);

            const results = await model.findForHost([dest1.id, dest2.id], tx);

            const ids = results.map((r) => r.id);
            expect(ids).toContain(trade1.id);
            expect(ids).toContain(trade2.id);
            expect(ids).not.toContain(tradeOther.id);
        });
    });

    it('excludes rows where isActive = false', async () => {
        await withTestTransaction(async (tx) => {
            const dest = testData.destination();
            const { destinations } = await import(
                '../../src/schemas/destination/destination.dbschema.ts'
            );
            await tx.insert(destinations).values(dest);

            const active = tradeFixture(dest.id, { isActive: true, name: 'Active' });
            const inactive = tradeFixture(dest.id, { isActive: false, name: 'Inactive' });

            await tx.insert(hostTrades).values(active);
            await tx.insert(hostTrades).values(inactive);

            const results = await model.findForHost([dest.id], tx);

            expect(results.map((r) => r.id)).toContain(active.id);
            expect(results.map((r) => r.id)).not.toContain(inactive.id);
        });
    });

    it('excludes soft-deleted rows (deletedAt IS NOT NULL)', async () => {
        await withTestTransaction(async (tx) => {
            const dest = testData.destination();
            const { destinations } = await import(
                '../../src/schemas/destination/destination.dbschema.ts'
            );
            await tx.insert(destinations).values(dest);

            const live = tradeFixture(dest.id, { name: 'Live' });
            const deleted = tradeFixture(dest.id, { name: 'Deleted', deletedAt: new Date() });

            await tx.insert(hostTrades).values(live);
            await tx.insert(hostTrades).values(deleted);

            const results = await model.findForHost([dest.id], tx);

            expect(results.map((r) => r.id)).toContain(live.id);
            expect(results.map((r) => r.id)).not.toContain(deleted.id);
        });
    });

    it('orders results by name ASC only (HOS-919: category no longer drives order)', async () => {
        await withTestTransaction(async (tx) => {
            const dest = testData.destination();
            const { destinations } = await import(
                '../../src/schemas/destination/destination.dbschema.ts'
            );
            await tx.insert(destinations).values(dest);

            // Legacy categories are deliberately in the OPPOSITE order of the
            // names: under the old `category ASC, name ASC` order tradeA
            // (CERRAJERIA) would come first; by name it must come last.
            const tradeA = tradeFixture(dest.id, { category: 'CERRAJERIA', name: 'Zeta' });
            const tradeB = tradeFixture(dest.id, { category: 'PLOMERIA', name: 'Alpha' });
            const tradeC = tradeFixture(dest.id, { category: 'PLOMERIA', name: 'Omega' });

            // Insert out of order to prove the ORDER BY clause works
            await tx.insert(hostTrades).values(tradeC);
            await tx.insert(hostTrades).values(tradeA);
            await tx.insert(hostTrades).values(tradeB);

            const results = await model.findForHost([dest.id], tx);

            expect(results.map((r) => r.id)).toEqual([tradeB.id, tradeC.id, tradeA.id]);
        });
    });

    it('returns [] for an empty destinationIds array without hitting the DB', async () => {
        // No transaction needed — the guard short-circuits before any query
        const results = await model.findForHost([]);
        expect(results).toEqual([]);
    });

    it('returns [] when destinationIds match no rows', async () => {
        await withTestTransaction(async (tx) => {
            const nonExistentId = crypto.randomUUID();
            const results = await model.findForHost([nonExistentId], tx);
            expect(results).toEqual([]);
        });
    });
});

// ---------------------------------------------------------------------------
// HOS-919 T-008 / T-009: category filter, hydration and set replacement
// ---------------------------------------------------------------------------

const uid = () => crypto.randomUUID().slice(0, 8);

const eqCategoryId = (id: string) => eq(hostTradeCategories.id, id);
const eqTradeId = (id: string) => eq(hostTrades.id, id);

type CatRef = { id: string; slug: string };

type Seeded = {
    destinationId: string;
    groupId: string;
    categories: CatRef[];
};

/** Inserts a destination, one group and `count` categories (weights 10, 20, ...). */
async function seedCatalog(tx: DrizzleClient, count: number): Promise<Seeded> {
    const dest = testData.destination();
    await tx.insert(destinations).values(dest);
    const groupId = crypto.randomUUID();
    await tx.insert(hostTradeCategoryGroups).values({
        id: groupId,
        slug: `grp-${uid()}`,
        nameI18n: { es: 'Grupo', en: 'Group', pt: 'Grupo' },
        displayWeight: 10
    });
    const categories = Array.from({ length: count }, (_, index) => ({
        id: crypto.randomUUID(),
        slug: `cat-${uid()}`,
        index
    }));
    await tx.insert(hostTradeCategories).values(
        categories.map((c) => ({
            id: c.id,
            slug: c.slug,
            groupId,
            nameI18n: { es: `Cat ${c.index}`, en: `Cat ${c.index}`, pt: `Cat ${c.index}` },
            displayWeight: (c.index + 1) * 10
        }))
    );
    return {
        destinationId: dest.id,
        groupId,
        categories: categories.map(({ id, slug }) => ({ id, slug }))
    };
}

async function insertTrade(
    tx: DrizzleClient,
    destinationId: string,
    name: string
): Promise<string> {
    const id = crypto.randomUUID();
    await tx.insert(hostTrades).values({
        id,
        slug: `trade-${uid()}`,
        name,
        contact: '+54 999 000 001',
        benefit: '10%',
        destinationId
    });
    return id;
}

async function link(tx: DrizzleClient, hostTradeId: string, categoryIds: string[]): Promise<void> {
    await tx
        .insert(rHostTradeCategory)
        .values(categoryIds.map((categoryId) => ({ hostTradeId, categoryId })));
}

async function linkedIds(tx: DrizzleClient, hostTradeId: string): Promise<string[]> {
    const rows = await tx.select().from(rHostTradeCategory);
    return rows
        .filter((r) => r.hostTradeId === hostTradeId)
        .map((r) => r.categoryId)
        .sort();
}

describe('HostTradeModel categories any-of EXISTS condition', () => {
    const model = new HostTradeModel();

    it('matches a provider holding BOTH requested categories exactly once', async () => {
        await withTestTransaction(async (tx) => {
            const seed = await seedCatalog(tx, 3);
            const [a, b, c] = seed.categories as [CatRef, CatRef, CatRef];
            const both = await insertTrade(tx, seed.destinationId, 'Both');
            const onlyC = await insertTrade(tx, seed.destinationId, 'OnlyC');
            await link(tx, both, [a.id, b.id]);
            await link(tx, onlyC, [c.id]);

            const condition = model.buildCategoriesFilterCondition({
                categorySlugs: [a.slug, b.slug]
            });
            const { items, total } = await model.findAll(
                { destinationId: seed.destinationId },
                { pageSize: 50 },
                [condition],
                tx
            );
            const count = await model.count(
                { destinationId: seed.destinationId },
                { additionalConditions: [condition], tx }
            );

            expect(items.map((t) => t.id)).toEqual([both]);
            expect(total).toBe(1);
            expect(count).toBe(1);
        });
    });

    it('matches any-of across providers and ignores unknown slugs in the list', async () => {
        await withTestTransaction(async (tx) => {
            const seed = await seedCatalog(tx, 2);
            const [a, b] = seed.categories as [CatRef, CatRef];
            const tradeA = await insertTrade(tx, seed.destinationId, 'A');
            const tradeB = await insertTrade(tx, seed.destinationId, 'B');
            await link(tx, tradeA, [a.id]);
            await link(tx, tradeB, [b.id]);

            const condition = model.buildCategoriesFilterCondition({
                categorySlugs: [a.slug, 'no-such-slug', b.slug]
            });
            const { items } = await model.findAll(
                { destinationId: seed.destinationId },
                { pageSize: 50 },
                [condition],
                tx
            );

            expect(items.map((t) => t.id).sort()).toEqual([tradeA, tradeB].sort());
        });
    });

    it('yields an empty result when every slug is unknown', async () => {
        await withTestTransaction(async (tx) => {
            const seed = await seedCatalog(tx, 1);
            const trade = await insertTrade(tx, seed.destinationId, 'T');
            await link(tx, trade, [(seed.categories[0] as CatRef).id]);

            const condition = model.buildCategoriesFilterCondition({
                categorySlugs: ['nope-1', 'nope-2']
            });
            const { items, total } = await model.findAll(
                { destinationId: seed.destinationId },
                { pageSize: 50 },
                [condition],
                tx
            );

            expect(items).toEqual([]);
            expect(total).toBe(0);
        });
    });

    it('matches nothing for an empty slug list (fail closed)', async () => {
        await withTestTransaction(async (tx) => {
            const seed = await seedCatalog(tx, 1);
            const trade = await insertTrade(tx, seed.destinationId, 'T');
            await link(tx, trade, [(seed.categories[0] as CatRef).id]);

            const condition = model.buildCategoriesFilterCondition({ categorySlugs: [] });
            const { items } = await model.findAll(
                { destinationId: seed.destinationId },
                { pageSize: 50 },
                [condition],
                tx
            );

            expect(items).toEqual([]);
        });
    });
});

describe('HostTradeModel.hydrateCategories', () => {
    const model = new HostTradeModel();

    it('returns refs in catalog order (group weight, category weight, slug) per provider', async () => {
        await withTestTransaction(async (tx) => {
            const seed = await seedCatalog(tx, 3);
            const [c1, c2, c3] = seed.categories as [CatRef, CatRef, CatRef];
            // A second group that sorts AFTER the first (weight 90 vs 10).
            const lateGroupId = crypto.randomUUID();
            await tx.insert(hostTradeCategoryGroups).values({
                id: lateGroupId,
                slug: `late-${uid()}`,
                nameI18n: { es: 'Tarde', en: 'Late', pt: 'Tarde' },
                displayWeight: 90
            });
            const lateCat = { id: crypto.randomUUID(), slug: `late-cat-${uid()}` };
            await tx.insert(hostTradeCategories).values({
                ...lateCat,
                groupId: lateGroupId,
                nameI18n: { es: 'Late', en: 'Late', pt: 'Late' },
                displayWeight: 1
            });

            const trade = await insertTrade(tx, seed.destinationId, 'Multi');
            const empty = await insertTrade(tx, seed.destinationId, 'Empty');
            // Linked out of order on purpose.
            await link(tx, trade, [lateCat.id, c3.id, c1.id, c2.id]);

            const map = await model.hydrateCategories({ hostTradeIds: [trade, empty], tx });

            expect(map.get(trade)?.map((c) => c.slug)).toEqual([
                c1.slug,
                c2.slug,
                c3.slug,
                lateCat.slug
            ]);
            expect(map.get(trade)?.[0]).toEqual({
                id: c1.id,
                slug: c1.slug,
                nameI18n: { es: 'Cat 0', en: 'Cat 0', pt: 'Cat 0' },
                groupSlug: expect.stringMatching(/^grp-/)
            });
            expect(map.get(empty)).toEqual([]);
        });
    });

    it('keeps an INACTIVE linked category visible on the provider (AC-3.3)', async () => {
        await withTestTransaction(async (tx) => {
            const seed = await seedCatalog(tx, 1);
            const cat = seed.categories[0] as CatRef;
            await tx
                .update(hostTradeCategories)
                .set({ lifecycleState: 'INACTIVE' })
                .where(eqCategoryId(cat.id));
            const trade = await insertTrade(tx, seed.destinationId, 'T');
            await link(tx, trade, [cat.id]);

            const map = await model.hydrateCategories({ hostTradeIds: [trade], tx });

            expect(map.get(trade)?.map((c) => c.slug)).toEqual([cat.slug]);
        });
    });

    it('returns an empty map without querying for an empty id list', async () => {
        const map = await model.hydrateCategories({ hostTradeIds: [] });
        expect(map.size).toBe(0);
    });

    it('issues ONE query regardless of how many providers it hydrates (no N+1)', async () => {
        const queries: string[] = [];
        const countingDb = drizzle({
            client: getTestPool(),
            schema: { ...hospedaSchema },
            logger: { logQuery: (query: string) => void queries.push(query) }
        }) as unknown as DrizzleClient;

        class Rollback extends Error {}
        try {
            await countingDb.transaction(async (tx) => {
                const txClient = tx as unknown as DrizzleClient;
                const seed = await seedCatalog(txClient, 4);
                const ids: string[] = [];
                for (let i = 0; i < 20; i++) {
                    const id = await insertTrade(txClient, seed.destinationId, `T${i}`);
                    await link(
                        txClient,
                        id,
                        seed.categories.slice(0, 2 + (i % 3)).map((c) => c.id)
                    );
                    ids.push(id);
                }

                queries.length = 0;
                const map20 = await model.hydrateCategories({ hostTradeIds: ids, tx: txClient });
                const queriesFor20 = queries.length;

                queries.length = 0;
                await model.hydrateCategories({ hostTradeIds: ids.slice(0, 2), tx: txClient });
                const queriesFor2 = queries.length;

                expect(map20.size).toBe(20);
                expect(queriesFor20).toBe(1);
                expect(queriesFor2).toBe(queriesFor20);
                throw new Rollback();
            });
        } catch (error) {
            if (!(error instanceof Rollback)) throw error;
        }
    });
});

describe('HostTradeModel.replaceCategories', () => {
    const model = new HostTradeModel();

    it('replacing [a,b] with [b,c] leaves exactly {b,c}', async () => {
        await withTestTransaction(async (tx) => {
            const seed = await seedCatalog(tx, 3);
            const [a, b, c] = seed.categories as [CatRef, CatRef, CatRef];
            const trade = await insertTrade(tx, seed.destinationId, 'T');
            await link(tx, trade, [a.id, b.id]);

            const result = await model.replaceCategories({
                hostTradeId: trade,
                categoryIds: [b.id, c.id],
                tx
            });

            expect(await linkedIds(tx, trade)).toEqual([b.id, c.id].sort());
            expect(result).toEqual({ added: [c.id], removed: [a.id] });
        });
    });

    it('is a no-op when the set is unchanged (order and duplicates ignored)', async () => {
        await withTestTransaction(async (tx) => {
            const seed = await seedCatalog(tx, 2);
            const [a, b] = seed.categories as [CatRef, CatRef];
            const trade = await insertTrade(tx, seed.destinationId, 'T');
            await link(tx, trade, [a.id, b.id]);

            const result = await model.replaceCategories({
                hostTradeId: trade,
                categoryIds: [b.id, a.id, b.id],
                tx
            });

            expect(result).toEqual({ added: [], removed: [] });
            expect(await linkedIds(tx, trade)).toEqual([a.id, b.id].sort());
        });
    });

    it('does not touch the links of another provider', async () => {
        await withTestTransaction(async (tx) => {
            const seed = await seedCatalog(tx, 2);
            const [a, b] = seed.categories as [CatRef, CatRef];
            const mine = await insertTrade(tx, seed.destinationId, 'Mine');
            const other = await insertTrade(tx, seed.destinationId, 'Other');
            await link(tx, other, [a.id]);

            await model.replaceCategories({ hostTradeId: mine, categoryIds: [b.id], tx });

            expect(await linkedIds(tx, other)).toEqual([a.id]);
            expect(await linkedIds(tx, mine)).toEqual([b.id]);
        });
    });

    it('rolls back to the OLD set when the insert fails (atomic delete + insert)', async () => {
        await withTestTransaction(async (tx) => {
            const seed = await seedCatalog(tx, 2);
            const [a, b] = seed.categories as [CatRef, CatRef];
            const trade = await insertTrade(tx, seed.destinationId, 'T');
            await link(tx, trade, [a.id, b.id]);

            // A savepoint stands in for the service's transaction: the failed
            // insert must undo the delete that ran before it in the same unit.
            await expect(
                tx.transaction(async (inner) => {
                    await model.replaceCategories({
                        hostTradeId: trade,
                        categoryIds: [crypto.randomUUID()],
                        tx: inner as unknown as DrizzleClient
                    });
                })
            ).rejects.toThrow();

            expect(await linkedIds(tx, trade)).toEqual([a.id, b.id].sort());
        });
    });
});

describe('r_host_trade_category delete rules', () => {
    it('FK RESTRICT blocks hard-deleting a category that is still linked', async () => {
        await withTestTransaction(async (tx) => {
            const seed = await seedCatalog(tx, 1);
            const cat = seed.categories[0] as CatRef;
            const trade = await insertTrade(tx, seed.destinationId, 'T');
            await link(tx, trade, [cat.id]);

            await expect(
                tx.transaction(async (inner) => {
                    await inner.delete(hostTradeCategories).where(eqCategoryId(cat.id));
                })
            ).rejects.toThrow();

            expect(await linkedIds(tx, trade)).toEqual([cat.id]);
        });
    });

    it('deleting a host trade cascades its links', async () => {
        await withTestTransaction(async (tx) => {
            const seed = await seedCatalog(tx, 2);
            const trade = await insertTrade(tx, seed.destinationId, 'T');
            await link(
                tx,
                trade,
                seed.categories.map((c) => c.id)
            );

            await tx.delete(hostTrades).where(eqTradeId(trade));

            expect(await linkedIds(tx, trade)).toEqual([]);
        });
    });
});
