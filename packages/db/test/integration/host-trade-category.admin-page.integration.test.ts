/**
 * Integration tests for `findAdminPage` on the provider trade catalog models
 * (HOS-2340 AC-3.1 to AC-3.5, R3, R5).
 *
 * Each test wraps its writes in `withTestTransaction`, so everything is rolled
 * back. Queries are always scoped to the ids a test created, because the
 * catalog tables may hold unrelated rows.
 *
 * Gated on the ephemeral database that `pnpm test:integration` provisions.
 */
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import { HostTradeCategoryModel } from '../../src/models/hostTrade/host-trade-category.model.ts';
import { HostTradeCategoryGroupModel } from '../../src/models/hostTrade/host-trade-category-group.model.ts';
import { hostTradeCategories } from '../../src/schemas/host-trade/host-trade-category.dbschema.ts';
import { hostTradeCategoryGroups } from '../../src/schemas/host-trade/host-trade-category-group.dbschema.ts';
import { closeTestPool, getTestDb, withTestTransaction } from './helpers.ts';

const DB_AVAILABLE = Boolean(process.env.HOSPEDA_TEST_DATABASE_URL);

beforeAll(() => {
    if (DB_AVAILABLE) setDb(getTestDb());
});

afterAll(async () => {
    if (DB_AVAILABLE) await closeTestPool();
});

const groupModel = new HostTradeCategoryGroupModel();
const categoryModel = new HostTradeCategoryModel();

const uid = () => crypto.randomUUID().slice(0, 8);

function group(
    overrides: Partial<typeof hostTradeCategoryGroups.$inferInsert> = {}
): typeof hostTradeCategoryGroups.$inferInsert & { id: string } {
    const id = crypto.randomUUID();
    return {
        id,
        slug: `grp-${uid()}`,
        nameI18n: { es: `Grupo ${uid()}`, en: 'Group', pt: 'Grupo' },
        ...overrides
    };
}

function category(
    groupId: string,
    es: string,
    overrides: Partial<typeof hostTradeCategories.$inferInsert> = {}
): typeof hostTradeCategories.$inferInsert & { id: string } {
    return {
        id: crypto.randomUUID(),
        slug: `cat-${uid()}`,
        groupId,
        nameI18n: { es, en: es, pt: es },
        ...overrides
    };
}

describe.skipIf(!DB_AVAILABLE)('HostTradeCategoryModel.findAdminPage', () => {
    it('orders by group weight, category weight, accent-insensitive Spanish name, then id (AC-3.1, R3)', async () => {
        await withTestTransaction(async (tx) => {
            const late = group({ displayWeight: 20 });
            const early = group({ displayWeight: 10 });
            await tx.insert(hostTradeCategoryGroups).values([late, early]);

            const rows = [
                category(late.id, 'Aaa en grupo tardio', { displayWeight: 1 }),
                category(early.id, 'Vidriería', { displayWeight: 10 }),
                category(early.id, 'Plomería', { displayWeight: 10 }),
                category(early.id, 'Albañilería', { displayWeight: 10 }),
                category(early.id, 'Cerrajería', { displayWeight: 5 })
            ];
            await tx.insert(hostTradeCategories).values(rows);

            const { items, total } = await categoryModel.findAdminPage({
                where: { groupId: [late.id, early.id] },
                page: 1,
                pageSize: 50,
                tx
            });

            expect(items.map((item) => item.nameI18n.es)).toEqual([
                'Cerrajería',
                'Albañilería',
                'Plomería',
                'Vidriería',
                'Aaa en grupo tardio'
            ]);
            expect(total).toBe(5);
        });
    });

    it('does not interleave the categories of two groups sharing a weight (AC-3.1)', async () => {
        await withTestTransaction(async (tx) => {
            const beta = group({ displayWeight: 50, nameI18n: { es: 'Beta', en: 'b', pt: 'b' } });
            const alfa = group({ displayWeight: 50, nameI18n: { es: 'Álfa', en: 'a', pt: 'a' } });
            await tx.insert(hostTradeCategoryGroups).values([beta, alfa]);
            // Category weights alternate, so a missing group tie-break would interleave them.
            await tx
                .insert(hostTradeCategories)
                .values([
                    category(beta.id, 'B1', { displayWeight: 1 }),
                    category(alfa.id, 'A2', { displayWeight: 2 }),
                    category(beta.id, 'B3', { displayWeight: 3 }),
                    category(alfa.id, 'A4', { displayWeight: 4 })
                ]);

            const { items } = await categoryModel.findAdminPage({
                where: { groupId: [beta.id, alfa.id] },
                page: 1,
                pageSize: 50,
                tx
            });

            expect(items.map((item) => item.nameI18n.es)).toEqual(['A2', 'A4', 'B1', 'B3']);
        });
    });

    it('pages 60 rows without duplicates or gaps and is repeatable (AC-3.3)', async () => {
        await withTestTransaction(async (tx) => {
            const g = group();
            await tx.insert(hostTradeCategoryGroups).values(g);
            // Same weight AND same name: only the id tie-break can order them.
            const rows = Array.from({ length: 60 }, () =>
                category(g.id, 'Igual', { displayWeight: 10 })
            );
            await tx.insert(hostTradeCategories).values(rows);

            const read = async (page: number) =>
                (
                    await categoryModel.findAdminPage({
                        where: { groupId: g.id },
                        page,
                        pageSize: 50,
                        tx
                    })
                ).items.map((item) => item.id);

            const first = await read(1);
            const second = await read(2);

            expect(first).toHaveLength(50);
            expect(second).toHaveLength(10);
            expect(new Set([...first, ...second]).size).toBe(60);
            expect([...first, ...second]).toEqual(rows.map((r) => r.id).sort());
            expect(await read(1)).toEqual(first);
        });
    });

    it('honours deletedAt filters and lists a live category under a deleted group (AC-3.5, R5)', async () => {
        await withTestTransaction(async (tx) => {
            const live = group();
            const deleted = group({ deletedAt: new Date() });
            await tx.insert(hostTradeCategoryGroups).values([live, deleted]);

            const liveCat = category(live.id, 'Viva');
            const deletedCat = category(live.id, 'Borrada', { deletedAt: new Date() });
            const underDeletedGroup = category(deleted.id, 'Bajo grupo borrado');
            await tx.insert(hostTradeCategories).values([liveCat, deletedCat, underDeletedGroup]);
            const groupIds = [live.id, deleted.id];

            const withoutDeleted = await categoryModel.findAdminPage({
                where: { groupId: groupIds, deletedAt: null },
                page: 1,
                pageSize: 50,
                tx
            });
            const withDeleted = await categoryModel.findAdminPage({
                where: { groupId: groupIds },
                page: 1,
                pageSize: 50,
                tx
            });

            expect(withoutDeleted.items.map((i) => i.id).sort()).toEqual(
                [liveCat.id, underDeletedGroup.id].sort()
            );
            expect(withoutDeleted.total).toBe(2);
            expect(withDeleted.items).toHaveLength(3);
            expect(withDeleted.total).toBe(3);
        });
    });

    it('applies extra SQL conditions and counts the filtered rows (AC-3.5)', async () => {
        await withTestTransaction(async (tx) => {
            const g = group();
            await tx.insert(hostTradeCategoryGroups).values(g);
            const target = category(g.id, 'Objetivo');
            await tx.insert(hostTradeCategories).values([target, category(g.id, 'Otra')]);

            const result = await categoryModel.findAdminPage({
                where: { groupId: g.id },
                additionalConditions: [sql`${hostTradeCategories.id} = ${target.id}`],
                page: 1,
                pageSize: 50,
                tx
            });

            expect(result.items.map((i) => i.id)).toEqual([target.id]);
            expect(result.total).toBe(1);
        });
    });
});

describe.skipIf(!DB_AVAILABLE)('HostTradeCategoryGroupModel.findAdminPage', () => {
    it('orders by display weight, accent-insensitive Spanish name, then id (AC-3.2)', async () => {
        await withTestTransaction(async (tx) => {
            const rows = [
                group({ displayWeight: 20, nameI18n: { es: 'Aaa', en: 'a', pt: 'a' } }),
                group({ displayWeight: 10, nameI18n: { es: 'Zeta', en: 'z', pt: 'z' } }),
                group({ displayWeight: 10, nameI18n: { es: 'Álamo', en: 'a', pt: 'a' } }),
                group({ displayWeight: 10, nameI18n: { es: 'Mesa', en: 'm', pt: 'm' } })
            ];
            await tx.insert(hostTradeCategoryGroups).values(rows);

            const { items, total } = await groupModel.findAdminPage({
                where: { id: rows.map((r) => r.id) },
                page: 1,
                pageSize: 50,
                tx
            });

            expect(items.map((item) => item.nameI18n.es)).toEqual(['Álamo', 'Mesa', 'Zeta', 'Aaa']);
            expect(total).toBe(4);
        });
    });

    it('includes soft-deleted groups only when the where map does not exclude them (AC-3.5)', async () => {
        await withTestTransaction(async (tx) => {
            const live = group();
            const deleted = group({ deletedAt: new Date() });
            await tx.insert(hostTradeCategoryGroups).values([live, deleted]);
            const ids = [live.id, deleted.id];

            const excluded = await groupModel.findAdminPage({
                where: { id: ids, deletedAt: null },
                page: 1,
                pageSize: 50,
                tx
            });
            const included = await groupModel.findAdminPage({
                where: { id: ids },
                page: 1,
                pageSize: 50,
                tx
            });

            expect(excluded.items.map((i) => i.id)).toEqual([live.id]);
            expect(excluded.total).toBe(1);
            expect(included.total).toBe(2);
        });
    });
});
