/**
 * HOS-919 review fixes 3, 4 and 6 against a REAL database.
 *
 * - Fix 3: a category whose group is soft-deleted can be neither restored nor
 *   assigned to a provider.
 * - Fix 4: deleting a category locks its row, so a concurrent link insert
 *   waits instead of slipping past the in-use check.
 * - Fix 6: the admin keyword search matches keywords, not JSON punctuation.
 *
 * @module host-trade-category-integrity.integration.test
 */
import {
    type DrizzleClient,
    destinations,
    eq,
    HostTradeCategoryModel,
    hostTradeCategories,
    hostTradeCategoryGroups,
    hostTrades,
    inArray,
    rHostTradeCategory,
    schema,
    users
} from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { drizzle } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HostTradeCategoryService } from '../../../src/services/host-trade-category/host-trade-category.service';
import { HostTradeService } from '../../../src/services/hostTrade/host-trade.service';
import type { Actor, ServiceContext } from '../../../src/types';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    getServiceTestDb,
    getServiceTestPool,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();
const RUN = crypto.randomUUID().slice(0, 8);

const actor: Actor = {
    id: '00000000-0000-4000-a000-000000000921',
    roles: [RoleEnum.SUPER_ADMIN],
    permissions: [
        PermissionEnum.ACCESS_PANEL_ADMIN,
        PermissionEnum.HOST_TRADE_CATEGORY_VIEW,
        PermissionEnum.HOST_TRADE_CATEGORY_DELETE,
        PermissionEnum.HOST_TRADE_CATEGORY_RESTORE,
        PermissionEnum.HOST_TRADE_CREATE
    ]
};

/** Code of the error a service call throws (inside a joined transaction) or returns. */
async function settleCode(
    call: Promise<{ error?: { code?: string } }>
): Promise<string | undefined> {
    try {
        return (await call).error?.code;
    } catch (error) {
        return (error as { code?: string }).code;
    }
}

async function insertGroup(tx: DrizzleClient, input: { slug: string; deleted?: boolean }) {
    const id = crypto.randomUUID();
    await tx.insert(hostTradeCategoryGroups).values({
        id,
        slug: `g-${RUN}-${input.slug}`,
        nameI18n: { es: input.slug, en: input.slug, pt: input.slug },
        displayWeight: 10,
        deletedAt: input.deleted ? new Date('2026-01-01T00:00:00Z') : null
    });
    return id;
}

async function insertCategory(
    tx: DrizzleClient,
    input: { groupId: string; slug: string; keywords?: string[]; deleted?: boolean }
) {
    const id = crypto.randomUUID();
    await tx.insert(hostTradeCategories).values({
        id,
        slug: `c-${RUN}-${input.slug}`,
        groupId: input.groupId,
        nameI18n: { es: input.slug, en: input.slug, pt: input.slug },
        keywordsI18n: { es: input.keywords ?? [], en: [], pt: [] },
        displayWeight: 10,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        deletedAt: input.deleted ? new Date('2026-01-01T00:00:00Z') : null
    } as typeof hostTradeCategories.$inferInsert);
    return id;
}

async function insertDestination(tx: DrizzleClient): Promise<string> {
    const id = crypto.randomUUID();
    await tx.insert(destinations).values({
        id,
        slug: `ht-int-dest-${RUN}-${id.slice(0, 6)}`,
        name: 'Integrity Test Destination',
        destinationType: 'CITY',
        level: 4,
        path: `/ht-int/${id}`,
        summary: 'Integrity test destination summary',
        description: 'Integrity test destination description',
        location: {
            state: 'Entre Rios',
            country: 'Argentina',
            coordinates: { lat: '-32.48', long: '-58.23' }
        },
        media: {
            featuredImage: {
                moderationState: 'APPROVED',
                url: 'https://example.com/ht-int-destination.jpg'
            }
        },
        lifecycleState: 'ACTIVE'
    } as typeof destinations.$inferInsert);
    return id;
}

describe.skipIf(!dbAvailable)('Catalog integrity — real DB (HOS-919 review)', () => {
    const categoryModel = new HostTradeCategoryModel();

    beforeAll(async () => {
        await getServiceTestDb()
            .insert(users)
            .values({
                id: actor.id,
                email: `ht-int-${RUN}@example.com`,
                displayName: 'Integrity Test Admin',
                emailVerified: true,
                lifecycleState: 'ACTIVE'
            } as typeof users.$inferInsert);
    });

    afterAll(async () => {
        await getServiceTestDb().delete(users).where(eq(users.id, actor.id));
        await closeServiceTestPool();
    });

    describe('group soft-deleted (fix 3)', () => {
        it('refuses to restore a category whose group is deleted', async () => {
            await withServiceTestTransaction(async (tx) => {
                const group = await insertGroup(tx, { slug: 'dead-restore', deleted: true });
                const category = await insertCategory(tx, {
                    groupId: group,
                    slug: 'dead-restore',
                    deleted: true
                });
                const service = new HostTradeCategoryService({ logger: createLoggerMock() });

                const code = await settleCode(
                    service.restore(actor, category, { tx, hookState: {} } as ServiceContext)
                );

                expect(code).toBe(ServiceErrorCode.VALIDATION_ERROR);
                const [row] = await tx
                    .select()
                    .from(hostTradeCategories)
                    .where(eq(hostTradeCategories.id, category));
                expect(row?.deletedAt).not.toBeNull();
            });
        });

        it('refuses to assign a category whose group is deleted', async () => {
            await withServiceTestTransaction(async (tx) => {
                const group = await insertGroup(tx, { slug: 'dead-assign', deleted: true });
                const category = await insertCategory(tx, { groupId: group, slug: 'dead-assign' });
                const destinationId = await insertDestination(tx);

                const code = await settleCode(
                    new HostTradeService({ logger: createLoggerMock() }).create(
                        actor,
                        {
                            name: 'Provider',
                            contact: '+54 9 3442 222222',
                            benefit: '10% de descuento',
                            destinationId,
                            is24h: false,
                            isActive: true,
                            categoryIds: [category]
                        },
                        { tx, hookState: {} } as ServiceContext
                    )
                );

                expect(code).toBe(ServiceErrorCode.VALIDATION_ERROR);
                expect(await categoryModel.findIdsInDeletedGroups([category], tx)).toEqual([
                    category
                ]);
            });
        });
    });

    describe('delete lock (fix 4)', () => {
        const committed = {
            groupId: '',
            categoryId: '',
            destinationId: '',
            providerId: ''
        };

        afterAll(async () => {
            if (!dbAvailable || !committed.groupId) return;
            const db = getServiceTestDb();
            await db
                .delete(rHostTradeCategory)
                .where(inArray(rHostTradeCategory.hostTradeId, [committed.providerId]));
            await db.delete(hostTrades).where(eq(hostTrades.id, committed.providerId));
            await db
                .delete(hostTradeCategories)
                .where(eq(hostTradeCategories.id, committed.categoryId));
            await db
                .delete(hostTradeCategoryGroups)
                .where(eq(hostTradeCategoryGroups.id, committed.groupId));
            await db.delete(destinations).where(eq(destinations.id, committed.destinationId));
        });

        it('makes a concurrent link insert wait while the delete transaction is open', async () => {
            const db = getServiceTestDb();
            committed.groupId = await insertGroup(db, { slug: 'lock' });
            committed.categoryId = await insertCategory(db, {
                groupId: committed.groupId,
                slug: 'lock'
            });
            committed.destinationId = await insertDestination(db);
            committed.providerId = crypto.randomUUID();
            await db.insert(hostTrades).values({
                id: committed.providerId,
                slug: `ht-int-${RUN}-lock`,
                name: 'Lock provider',
                contact: '+54 9 3442 000000',
                benefit: '10% de descuento',
                destinationId: committed.destinationId
            } as typeof hostTrades.$inferInsert);

            const pool = getServiceTestPool();
            const deleter = await pool.connect();
            const linker = await pool.connect();
            try {
                await deleter.query('BEGIN');
                const deleterTx = drizzle({ client: deleter, schema }) as unknown as DrizzleClient;
                expect(await categoryModel.lockForUpdate(committed.categoryId, deleterTx)).toBe(
                    true
                );

                await linker.query('BEGIN');
                await linker.query("SET LOCAL lock_timeout = '400ms'");
                await expect(
                    linker.query(
                        'INSERT INTO r_host_trade_category (host_trade_id, category_id) VALUES ($1, $2)',
                        [committed.providerId, committed.categoryId]
                    )
                ).rejects.toMatchObject({ code: '55P03' });
            } finally {
                await linker.query('ROLLBACK');
                await deleter.query('ROLLBACK');
                linker.release();
                deleter.release();
            }
        });
    });

    describe('keyword search (fix 6)', () => {
        it('does not match every row with keywords when searching a JSON punctuation character', async () => {
            await withServiceTestTransaction(async (tx) => {
                const group = await insertGroup(tx, { slug: 'kw' });
                const withKeywords = await insertCategory(tx, {
                    groupId: group,
                    slug: 'kw-with',
                    keywords: ['gasista', 'cañería']
                });
                await insertCategory(tx, { groupId: group, slug: 'kw-none' });
                const service = new HostTradeCategoryService({ logger: createLoggerMock() });
                const search = async (term: string) => {
                    const out = await service.adminList(
                        actor,
                        { search: term, groupId: group, page: 1, pageSize: 20 },
                        { tx, hookState: {} } as ServiceContext
                    );
                    return (out.data?.items ?? []).map((item) => item.id);
                };

                expect(await search('"')).toEqual([]);
                expect(await search(',')).toEqual([]);
                expect(await search('[')).toEqual([]);
                expect(await search('gasist')).toEqual([withKeywords]);
                expect(await search('caneria')).toEqual([withKeywords]);
            });
        });
    });
});
