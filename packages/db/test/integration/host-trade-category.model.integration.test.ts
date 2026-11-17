/**
 * Integration tests for HostTradeCategoryGroupModel and HostTradeCategoryModel
 * (HOS-919 T-007).
 *
 * Each test wraps its writes in `withTestTransaction`, so everything is rolled
 * back. Results are always narrowed to the slugs a test created because the
 * catalog tables may hold unrelated rows.
 *
 * Gated on the ephemeral database that `pnpm test:integration` provisions.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import { HostTradeCategoryModel } from '../../src/models/hostTrade/host-trade-category.model.ts';
import { HostTradeCategoryGroupModel } from '../../src/models/hostTrade/host-trade-category-group.model.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { hostTrades } from '../../src/schemas/host-trade/host_trade.dbschema.ts';
import { hostTradeCategories } from '../../src/schemas/host-trade/host-trade-category.dbschema.ts';
import { hostTradeCategoryGroups } from '../../src/schemas/host-trade/host-trade-category-group.dbschema.ts';
import { rHostTradeCategory } from '../../src/schemas/host-trade/r_host_trade_category.dbschema.ts';
import { closeTestPool, getTestDb, testData, withTestTransaction } from './helpers.ts';

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

function groupFixture(
    overrides: Partial<typeof hostTradeCategoryGroups.$inferInsert> = {}
): typeof hostTradeCategoryGroups.$inferInsert {
    const id = uid();
    return {
        id: crypto.randomUUID(),
        slug: `grp-${id}`,
        nameI18n: { es: `Grupo ${id}`, en: `Group ${id}`, pt: `Grupo ${id}` },
        ...overrides
    };
}

function categoryFixture(
    groupId: string,
    overrides: Partial<typeof hostTradeCategories.$inferInsert> = {}
): typeof hostTradeCategories.$inferInsert {
    const id = uid();
    return {
        id: crypto.randomUUID(),
        slug: `cat-${id}`,
        groupId,
        nameI18n: { es: `Categoria ${id}`, en: `Category ${id}`, pt: `Categoria ${id}` },
        ...overrides
    };
}

describe.skipIf(!DB_AVAILABLE)('HostTradeCategoryModel.findPublicCatalog', () => {
    it('excludes inactive and soft-deleted rows at BOTH levels', async () => {
        await withTestTransaction(async (tx) => {
            const live = groupFixture();
            const inactiveGroup = groupFixture({ lifecycleState: 'INACTIVE' });
            const deletedGroup = groupFixture({ deletedAt: new Date() });
            await tx.insert(hostTradeCategoryGroups).values([live, inactiveGroup, deletedGroup]);

            const okCat = categoryFixture(live.id as string);
            const inactiveCat = categoryFixture(live.id as string, { lifecycleState: 'INACTIVE' });
            const deletedCat = categoryFixture(live.id as string, { deletedAt: new Date() });
            const underInactiveGroup = categoryFixture(inactiveGroup.id as string);
            const underDeletedGroup = categoryFixture(deletedGroup.id as string);
            await tx
                .insert(hostTradeCategories)
                .values([okCat, inactiveCat, deletedCat, underInactiveGroup, underDeletedGroup]);

            const catalog = await categoryModel.findPublicCatalog(tx);
            const mine = catalog.groups.filter((g) =>
                [live.slug, inactiveGroup.slug, deletedGroup.slug].includes(g.slug)
            );

            expect(mine.map((g) => g.slug)).toEqual([live.slug]);
            expect(mine[0]?.categories.map((c) => c.slug)).toEqual([okCat.slug]);
        });
    });

    it('omits an active group that has no active category', async () => {
        await withTestTransaction(async (tx) => {
            const empty = groupFixture();
            await tx.insert(hostTradeCategoryGroups).values(empty);

            const catalog = await categoryModel.findPublicCatalog(tx);

            expect(catalog.groups.map((g) => g.slug)).not.toContain(empty.slug);
        });
    });

    it('orders groups by displayWeight, then categories by displayWeight, then name', async () => {
        await withTestTransaction(async (tx) => {
            const heavy = groupFixture({ displayWeight: 90 });
            const light = groupFixture({ displayWeight: 10 });
            await tx.insert(hostTradeCategoryGroups).values([heavy, light]);

            const lightB = categoryFixture(light.id as string, {
                displayWeight: 20,
                nameI18n: { es: 'Beta', en: 'Beta', pt: 'Beta' }
            });
            const lightA = categoryFixture(light.id as string, {
                displayWeight: 20,
                nameI18n: { es: 'Alfa', en: 'Alfa', pt: 'Alfa' }
            });
            const lightFirst = categoryFixture(light.id as string, {
                displayWeight: 5,
                nameI18n: { es: 'Zeta', en: 'Zeta', pt: 'Zeta' }
            });
            const heavyOnly = categoryFixture(heavy.id as string);
            // Inserted deliberately out of order to prove the ORDER BY.
            await tx.insert(hostTradeCategories).values([heavyOnly, lightB, lightFirst, lightA]);

            const catalog = await categoryModel.findPublicCatalog(tx);
            const mine = catalog.groups.filter((g) => [heavy.slug, light.slug].includes(g.slug));

            expect(mine.map((g) => g.slug)).toEqual([light.slug, heavy.slug]);
            expect(mine[0]?.categories.map((c) => c.slug)).toEqual([
                lightFirst.slug,
                lightA.slug,
                lightB.slug
            ]);
        });
    });

    it('returns the public shape with keywords defaulted to {}', async () => {
        await withTestTransaction(async (tx) => {
            const group = groupFixture();
            await tx.insert(hostTradeCategoryGroups).values(group);
            const withKeywords = categoryFixture(group.id as string, {
                keywordsI18n: { es: ['pozo'] }
            });
            const withoutKeywords = categoryFixture(group.id as string, { displayWeight: 99 });
            await tx.insert(hostTradeCategories).values([withKeywords, withoutKeywords]);

            const catalog = await categoryModel.findPublicCatalog(tx);
            const mine = catalog.groups.find((g) => g.slug === group.slug);

            expect(mine?.categories[0]).toEqual({
                id: withKeywords.id,
                slug: withKeywords.slug,
                nameI18n: withKeywords.nameI18n,
                displayWeight: 50,
                keywordsI18n: { es: ['pozo'] }
            });
            expect(mine?.categories[1]?.keywordsI18n).toEqual({});
        });
    });
});

describe.skipIf(!DB_AVAILABLE)('HostTradeCategoryModel.findActiveBySlugs', () => {
    it('returns only active, non-deleted rows and ignores unknown slugs', async () => {
        await withTestTransaction(async (tx) => {
            const group = groupFixture();
            await tx.insert(hostTradeCategoryGroups).values(group);
            const active = categoryFixture(group.id as string);
            const inactive = categoryFixture(group.id as string, { lifecycleState: 'INACTIVE' });
            const deleted = categoryFixture(group.id as string, { deletedAt: new Date() });
            await tx.insert(hostTradeCategories).values([active, inactive, deleted]);

            const result = await categoryModel.findActiveBySlugs(
                [active.slug, inactive.slug, deleted.slug, 'no-such-slug'],
                tx
            );

            expect(result.map((c) => c.slug)).toEqual([active.slug]);
        });
    });

    it('returns [] for an empty slug list without querying', async () => {
        expect(await categoryModel.findActiveBySlugs([])).toEqual([]);
    });
});

describe.skipIf(!DB_AVAILABLE)('HostTradeCategoryModel.findByIds', () => {
    it('returns the rows for the given ids, including inactive ones, skipping unknown ids', async () => {
        await withTestTransaction(async (tx) => {
            const group = groupFixture();
            await tx.insert(hostTradeCategoryGroups).values(group);
            const a = categoryFixture(group.id as string);
            const b = categoryFixture(group.id as string, { lifecycleState: 'INACTIVE' });
            await tx.insert(hostTradeCategories).values([a, b]);

            const result = await categoryModel.findByIds(
                [a.id as string, b.id as string, crypto.randomUUID()],
                tx
            );

            expect(result.map((c) => c.id).sort()).toEqual([a.id, b.id].sort());
        });
    });
});

describe.skipIf(!DB_AVAILABLE)('HostTradeCategoryModel.countLinkedHostTrades', () => {
    it('counts non-deleted host trades only', async () => {
        await withTestTransaction(async (tx) => {
            const dest = testData.destination();
            await tx.insert(destinations).values(dest);
            const group = groupFixture();
            await tx.insert(hostTradeCategoryGroups).values(group);
            const category = categoryFixture(group.id as string);
            await tx.insert(hostTradeCategories).values(category);

            const tradeBase = (name: string) => ({
                id: crypto.randomUUID(),
                slug: `trade-${uid()}`,
                name,
                contact: '+54 999 000 001',
                benefit: '10%',
                destinationId: dest.id
            });
            const live = tradeBase('Live');
            const deleted = { ...tradeBase('Deleted'), deletedAt: new Date() };
            await tx.insert(hostTrades).values([live, deleted]);
            await tx.insert(rHostTradeCategory).values([
                { hostTradeId: live.id, categoryId: category.id as string },
                { hostTradeId: deleted.id, categoryId: category.id as string }
            ]);

            expect(await categoryModel.countLinkedHostTrades(category.id as string, tx)).toBe(1);
        });
    });

    it('is 0 for a category with no links', async () => {
        await withTestTransaction(async (tx) => {
            const group = groupFixture();
            await tx.insert(hostTradeCategoryGroups).values(group);
            const category = categoryFixture(group.id as string);
            await tx.insert(hostTradeCategories).values(category);

            expect(await categoryModel.countLinkedHostTrades(category.id as string, tx)).toBe(0);
        });
    });
});

describe.skipIf(!DB_AVAILABLE)('HostTradeCategoryGroupModel.countActiveChildren', () => {
    it('counts non-deleted categories, whatever their lifecycle state', async () => {
        await withTestTransaction(async (tx) => {
            const group = groupFixture();
            await tx.insert(hostTradeCategoryGroups).values(group);
            await tx
                .insert(hostTradeCategories)
                .values([
                    categoryFixture(group.id as string),
                    categoryFixture(group.id as string, { lifecycleState: 'INACTIVE' }),
                    categoryFixture(group.id as string, { deletedAt: new Date() })
                ]);

            expect(await groupModel.countActiveChildren(group.id as string, tx)).toBe(2);
        });
    });

    it('is 0 for a group with no categories', async () => {
        await withTestTransaction(async (tx) => {
            const group = groupFixture();
            await tx.insert(hostTradeCategoryGroups).values(group);

            expect(await groupModel.countActiveChildren(group.id as string, tx)).toBe(0);
        });
    });
});
