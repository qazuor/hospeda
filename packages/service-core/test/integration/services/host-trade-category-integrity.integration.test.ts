/**
 * HOS-919 review fixes 3, 4 and 6 against a REAL database.
 *
 * - Fix 3: a category whose group is soft-deleted can be neither restored nor
 *   assigned to a provider.
 * - Fix 4: deleting a category locks its row, so a concurrent link insert
 *   waits instead of slipping past the in-use check.
 * - Fix 6: the admin keyword search matches keywords, not JSON punctuation.
 * - HOS-2366: a delete + restore keeps the lifecycle state an admin set
 *   (an INACTIVE category or group does not come back ACTIVE).
 *
 * @module host-trade-category-integrity.integration.test
 */
import {
    allianceLeads,
    type DrizzleClient,
    destinations,
    eq,
    HostTradeCategoryGroupModel,
    HostTradeCategoryModel,
    HostTradeModel,
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
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { provisionServiceProviderListing } from '../../../src/services/alliance-lead/alliance-lead.provisioning';
import { HostTradeCategoryService } from '../../../src/services/host-trade-category/host-trade-category.service';
import { HostTradeCategoryGroupService } from '../../../src/services/host-trade-category/host-trade-category-group.service';
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
        PermissionEnum.HOST_TRADE_CATEGORY_UPDATE,
        PermissionEnum.HOST_TRADE_CREATE
    ]
};

/** The `ServiceError` a call throws (inside a joined transaction) or returns, if any. */
async function settleError(
    call: Promise<{ error?: { code?: string; details?: unknown } }>
): Promise<{ code?: string; details?: unknown } | undefined> {
    try {
        return (await call).error;
    } catch (error) {
        return error as { code?: string; details?: unknown };
    }
}

/** Collects every `code` found along an error's `cause`/`originalError` chain. */
function errorChainCodes(error: unknown): string[] {
    const codes: string[] = [];
    let current: unknown = error;
    for (let depth = 0; depth < 6 && current && typeof current === 'object'; depth++) {
        const node = current as { code?: unknown; cause?: unknown; originalError?: unknown };
        if (typeof node.code === 'string') codes.push(node.code);
        current = node.cause ?? node.originalError;
    }
    return codes;
}

async function insertGroup(
    tx: DrizzleClient,
    input: { slug: string; deleted?: boolean; lifecycleState?: LifecycleStatusEnum }
) {
    const id = crypto.randomUUID();
    await tx.insert(hostTradeCategoryGroups).values({
        id,
        slug: `g-${RUN}-${input.slug}`,
        nameI18n: { es: input.slug, en: input.slug, pt: input.slug },
        displayWeight: 10,
        lifecycleState: input.lifecycleState ?? LifecycleStatusEnum.ACTIVE,
        deletedAt: input.deleted ? new Date('2026-01-01T00:00:00Z') : null
    });
    return id;
}

async function insertCategory(
    tx: DrizzleClient,
    input: {
        groupId: string;
        slug: string;
        keywords?: string[];
        deleted?: boolean;
        lifecycleState?: LifecycleStatusEnum;
    }
) {
    const id = crypto.randomUUID();
    await tx.insert(hostTradeCategories).values({
        id,
        slug: `c-${RUN}-${input.slug}`,
        groupId: input.groupId,
        nameI18n: { es: input.slug, en: input.slug, pt: input.slug },
        keywordsI18n: { es: input.keywords ?? [], en: [], pt: [] },
        displayWeight: 10,
        lifecycleState: input.lifecycleState ?? LifecycleStatusEnum.ACTIVE,
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

                const error = await settleError(
                    service.restore(actor, category, { tx, hookState: {} } as ServiceContext)
                );

                expect(error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
                expect(error?.details).toMatchObject({ field: 'groupId', groupId: group });
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

                const error = await settleError(
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

                expect(error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
                expect(error?.details).toMatchObject({
                    field: 'categoryIds',
                    reason: 'UNKNOWN_CATEGORY',
                    categoryIds: [category]
                });
                expect(await categoryModel.findIdsInDeletedGroups([category], tx)).toEqual([
                    category
                ]);
            });
        });
    });

    describe('restore keeps the lifecycle state (HOS-2366)', () => {
        it('an INACTIVE category comes back INACTIVE after soft delete + restore', async () => {
            await withServiceTestTransaction(async (tx) => {
                const group = await insertGroup(tx, { slug: 'keep-cat' });
                const category = await insertCategory(tx, {
                    groupId: group,
                    slug: 'keep-cat',
                    lifecycleState: LifecycleStatusEnum.INACTIVE
                });
                const service = new HostTradeCategoryService({ logger: createLoggerMock() });
                const ctx = { tx, hookState: {} } as ServiceContext;

                const deleted = await service.softDelete(actor, category, ctx);
                const restored = await service.restore(actor, category, ctx);

                expect(deleted.error).toBeUndefined();
                expect(restored.error).toBeUndefined();
                expect(restored.data).toEqual({ count: 1 });
                const [row] = await tx
                    .select()
                    .from(hostTradeCategories)
                    .where(eq(hostTradeCategories.id, category));
                expect(row?.deletedAt).toBeNull();
                expect(row?.slug).toBe(`c-${RUN}-keep-cat`);
                expect(row?.lifecycleState).toBe(LifecycleStatusEnum.INACTIVE);
            });
        });

        it('an INACTIVE group comes back INACTIVE after soft delete + restore', async () => {
            await withServiceTestTransaction(async (tx) => {
                const group = await insertGroup(tx, {
                    slug: 'keep-group',
                    lifecycleState: LifecycleStatusEnum.INACTIVE
                });
                const service = new HostTradeCategoryGroupService({
                    logger: createLoggerMock()
                });
                const ctx = { tx, hookState: {} } as ServiceContext;

                const deleted = await service.softDelete(actor, group, ctx);
                const restored = await service.restore(actor, group, ctx);

                expect(deleted.error).toBeUndefined();
                expect(restored.error).toBeUndefined();
                expect(restored.data).toEqual({ count: 1 });
                const [row] = await tx
                    .select()
                    .from(hostTradeCategoryGroups)
                    .where(eq(hostTradeCategoryGroups.id, group));
                expect(row?.deletedAt).toBeNull();
                expect(row?.lifecycleState).toBe(LifecycleStatusEnum.INACTIVE);
            });
        });
    });

    describe('lead provisioning (re-review 1)', () => {
        const provision = async (tx: DrizzleClient, categorySlug: string) => {
            const destinationId = await insertDestination(tx);
            const id = crypto.randomUUID();
            await tx.insert(allianceLeads).values({
                id,
                kind: 'service_provider',
                contactName: 'Lead Contact',
                email: `lead-${RUN}-${id.slice(0, 6)}@example.com`,
                message: 'Quiero sumarme',
                status: 'approved',
                businessName: `Lead Biz ${RUN} ${id.slice(0, 6)}`,
                destinationId,
                categorySlugs: [categorySlug]
            } as typeof allianceLeads.$inferInsert);
            const [lead] = await tx.select().from(allianceLeads).where(eq(allianceLeads.id, id));
            if (!lead) throw new Error('lead not inserted');
            return provisionServiceProviderListing({
                lead,
                hostTradeModel: new HostTradeModel(),
                categoryModel,
                actorId: actor.id,
                logger: createLoggerMock(),
                tx
            });
        };

        it('does not link a category whose group is soft-deleted', async () => {
            await withServiceTestTransaction(async (tx) => {
                const group = await insertGroup(tx, { slug: 'prov-dead', deleted: true });
                await insertCategory(tx, { groupId: group, slug: 'prov-dead' });

                const result = await provision(tx, `c-${RUN}-prov-dead`);

                expect(result).toEqual({ provisioned: false, reason: 'no-active-category' });
            });
        });

        it('links an ordinary active category', async () => {
            await withServiceTestTransaction(async (tx) => {
                const group = await insertGroup(tx, { slug: 'prov-ok' });
                await insertCategory(tx, { groupId: group, slug: 'prov-ok' });

                const result = await provision(tx, `c-${RUN}-prov-ok`);

                expect(result).toMatchObject({ provisioned: true });
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

        it('serializes the category delete with a provider write that holds the FOR SHARE read', async () => {
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
            const writer = await pool.connect();
            const deleter = await pool.connect();
            try {
                // A provider write validates its ids with FOR SHARE and keeps the lock.
                await writer.query('BEGIN');
                const writerTx = drizzle({ client: writer, schema }) as unknown as DrizzleClient;
                const loaded = await categoryModel.findByIdsForShare(
                    [committed.categoryId],
                    writerTx
                );
                expect(loaded.map((row) => row.id)).toEqual([committed.categoryId]);

                // The category delete (FOR UPDATE) cannot overtake it: it must wait.
                await deleter.query('BEGIN');
                await deleter.query("SET LOCAL lock_timeout = '400ms'");
                const deleterTx = drizzle({ client: deleter, schema }) as unknown as DrizzleClient;
                const failure = await categoryModel
                    .lockForUpdate(committed.categoryId, deleterTx)
                    .then(() => null)
                    .catch((error: unknown) => error);
                expect(failure).not.toBeNull();
                expect(errorChainCodes(failure)).toContain('55P03');
            } finally {
                await deleter.query('ROLLBACK');
                await writer.query('ROLLBACK');
                deleter.release();
                writer.release();
            }
        });
    });

    describe('service-level locking, committed data (re-review 4)', () => {
        const committed = {
            groupIds: [] as string[],
            categoryIds: [] as string[],
            destinationIds: [] as string[]
        };

        afterAll(async () => {
            if (!dbAvailable) return;
            const db = getServiceTestDb();
            if (committed.categoryIds.length > 0) {
                await db
                    .delete(hostTradeCategories)
                    .where(inArray(hostTradeCategories.id, committed.categoryIds));
            }
            if (committed.groupIds.length > 0) {
                await db
                    .delete(hostTradeCategoryGroups)
                    .where(inArray(hostTradeCategoryGroups.id, committed.groupIds));
            }
            if (committed.destinationIds.length > 0) {
                await db
                    .delete(destinations)
                    .where(inArray(destinations.id, committed.destinationIds));
            }
        });

        it('category softDelete with NO ctx locks, counts and deletes on ONE transaction; a later provider write is refused FOR SHARE with the id in details', async () => {
            const db = getServiceTestDb();
            const groupId = await insertGroup(db, { slug: 'svc-lock' });
            const categoryId = await insertCategory(db, { groupId, slug: 'svc-lock' });
            const destinationId = await insertDestination(db);
            committed.groupIds.push(groupId);
            committed.categoryIds.push(categoryId);
            committed.destinationIds.push(destinationId);

            const model = new HostTradeCategoryModel();
            const lockSpy = vi.spyOn(model, 'lockForUpdate');
            const countSpy = vi.spyOn(model, 'countLinkedHostTrades');
            const deleteSpy = vi.spyOn(model, 'softDelete');
            const service = new HostTradeCategoryService({ logger: createLoggerMock() }, model);

            const deleted = await service.softDelete(actor, categoryId);

            expect(deleted.error).toBeUndefined();
            const lockTx = lockSpy.mock.calls[0]?.[1];
            expect(lockTx).toBeDefined();
            expect(countSpy.mock.calls[0]?.[1]).toBe(lockTx);
            expect(deleteSpy.mock.calls[0]?.[2]).toBe(lockTx);

            // The delete is committed. A provider write now must be refused, and it must
            // validate with the FOR SHARE read on its own transaction.
            const shareModel = new HostTradeCategoryModel();
            const shareSpy = vi.spyOn(shareModel, 'findByIdsForShare');
            const result = await new HostTradeService(
                { logger: createLoggerMock() },
                undefined,
                undefined,
                null,
                undefined,
                shareModel
            ).create(actor, {
                name: 'After delete',
                contact: '+54 9 3442 333333',
                benefit: '10% de descuento',
                destinationId,
                is24h: false,
                isActive: true,
                categoryIds: [categoryId]
            });

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.details).toMatchObject({
                field: 'categoryIds',
                reason: 'UNKNOWN_CATEGORY',
                categoryIds: [categoryId]
            });
            expect(shareSpy).toHaveBeenCalledTimes(1);
            expect(shareSpy.mock.calls[0]?.[0]).toEqual([categoryId]);
            expect(shareSpy.mock.calls[0]?.[1]).toBeDefined();
        });

        it('group softDelete with NO ctx locks, counts and deletes on ONE transaction', async () => {
            const db = getServiceTestDb();
            const groupId = await insertGroup(db, { slug: 'svc-group-lock' });
            committed.groupIds.push(groupId);

            const model = new HostTradeCategoryGroupModel();
            const lockSpy = vi.spyOn(model, 'lockForUpdate');
            const countSpy = vi.spyOn(model, 'countActiveChildren');
            const deleteSpy = vi.spyOn(model, 'softDelete');
            const service = new HostTradeCategoryGroupService(
                { logger: createLoggerMock() },
                model
            );

            const deleted = await service.softDelete(actor, groupId);

            expect(deleted.error).toBeUndefined();
            const lockTx = lockSpy.mock.calls[0]?.[1];
            expect(lockTx).toBeDefined();
            expect(countSpy.mock.calls[0]?.[1]).toBe(lockTx);
            expect(deleteSpy.mock.calls[0]?.[2]).toBe(lockTx);
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
