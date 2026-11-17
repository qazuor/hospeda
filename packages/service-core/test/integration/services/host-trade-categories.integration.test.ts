/**
 * HOS-919 T-048 — provider trade categories against a REAL database.
 *
 * Mocked unit tests assert that a query was built. What this suite proves is
 * what only Postgres can answer: the any-of `EXISTS` filter returns a provider
 * once, hydration is ONE query in catalog order, the replacement of a category
 * set rolls back with the provider row, the FK `RESTRICT` holds when the
 * service is bypassed, and an approved lead provisions a listing from slugs.
 *
 * Most tests run inside a rolled-back transaction. Two need real commits (the
 * atomic replacement opens its own transaction) and clean up after themselves,
 * every row carrying a unique run tag.
 *
 * ACs: AC-2.1, AC-2.2, AC-3.4, AC-4.2, AC-5.2, AC-5.4.
 *
 * @module host-trade-categories.integration.test
 */
import {
    allianceLeads,
    type DrizzleClient,
    destinations,
    eq,
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
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { provisionServiceProviderListing } from '../../../src/services/alliance-lead/alliance-lead.provisioning';
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

const adminActor: Actor = {
    id: '00000000-0000-4000-a000-000000000919',
    roles: [RoleEnum.SUPER_ADMIN],
    permissions: [
        PermissionEnum.HOST_TRADE_CATEGORY_VIEW,
        PermissionEnum.HOST_TRADE_CATEGORY_DELETE,
        PermissionEnum.HOST_TRADE_UPDATE,
        PermissionEnum.HOST_TRADE_VIEW_ALL
    ]
};

interface SeededCategory {
    readonly id: string;
    readonly slug: string;
}

/** Inserts a group and returns its id. `weight` orders groups in hydration. */
async function insertGroup(tx: DrizzleClient, input: { slug: string; weight: number }) {
    const id = crypto.randomUUID();
    await tx.insert(hostTradeCategoryGroups).values({
        id,
        slug: `g-${RUN}-${input.slug}`,
        nameI18n: { es: input.slug, en: input.slug, pt: input.slug },
        displayWeight: input.weight
    });
    return id;
}

/** Inserts a category under `groupId`. */
async function insertCategory(
    tx: DrizzleClient,
    input: {
        groupId: string;
        slug: string;
        weight?: number;
        state?: LifecycleStatusEnum;
        deleted?: boolean;
    }
): Promise<SeededCategory> {
    const id = crypto.randomUUID();
    const slug = `c-${RUN}-${input.slug}`;
    await tx.insert(hostTradeCategories).values({
        id,
        slug,
        groupId: input.groupId,
        nameI18n: { es: input.slug, en: input.slug, pt: input.slug },
        displayWeight: input.weight ?? 50,
        lifecycleState: input.state ?? LifecycleStatusEnum.ACTIVE,
        deletedAt: input.deleted ? new Date('2026-01-01T00:00:00Z') : null
    });
    return { id, slug };
}

/** Inserts a destination and returns its id. */
async function insertDestination(tx: DrizzleClient): Promise<string> {
    const id = crypto.randomUUID();
    await tx.insert(destinations).values({
        id,
        slug: `ht-cat-dest-${RUN}-${id.slice(0, 6)}`,
        name: 'Category Test Destination',
        destinationType: 'CITY',
        level: 4,
        path: `/ht-cat/${id}`,
        summary: 'Category test destination summary',
        description: 'Category test destination description',
        location: {
            state: 'Entre Rios',
            country: 'Argentina',
            coordinates: { lat: '-32.48', long: '-58.23' }
        },
        media: {
            featuredImage: {
                moderationState: 'APPROVED',
                url: 'https://example.com/ht-cat-destination.jpg'
            }
        },
        lifecycleState: 'ACTIVE'
    } as typeof destinations.$inferInsert);
    return id;
}

/** Inserts a provider and links it to `categoryIds`. */
async function insertProvider(
    tx: DrizzleClient,
    input: {
        destinationId: string;
        name: string;
        categoryIds?: readonly string[];
        deleted?: boolean;
    }
): Promise<string> {
    const id = crypto.randomUUID();
    await tx.insert(hostTrades).values({
        id,
        slug: `ht-cat-${RUN}-${id.slice(0, 8)}`,
        name: input.name,
        contact: '+54 9 3442 000000',
        benefit: '10% de descuento',
        destinationId: input.destinationId,
        deletedAt: input.deleted ? new Date('2026-01-01T00:00:00Z') : null
    } as typeof hostTrades.$inferInsert);
    for (const categoryId of input.categoryIds ?? []) {
        await tx.insert(rHostTradeCategory).values({ hostTradeId: id, categoryId });
    }
    return id;
}

/** Returns a thrown value from a service call, or the `error` of its output. */
async function settleError(call: Promise<{ error?: { code?: string } }>) {
    try {
        const out = await call;
        return out.error ?? null;
    } catch (error) {
        return error as { code?: string; message?: string };
    }
}

describe.skipIf(!dbAvailable)('Provider trade categories — real DB (HOS-919 T-048)', () => {
    const hostTradeModel = new HostTradeModel();
    const categoryModel = new HostTradeCategoryModel();

    beforeAll(async () => {
        // The actor id lands in created_by/updated_by/deleted_by FKs, so it must be a real user.
        await getServiceTestDb()
            .insert(users)
            .values({
                id: adminActor.id,
                email: `ht-cat-admin-${RUN}@example.com`,
                displayName: 'Category Test Admin',
                emailVerified: true,
                lifecycleState: 'ACTIVE'
            } as typeof users.$inferInsert);
    });

    afterAll(async () => {
        await getServiceTestDb().delete(users).where(eq(users.id, adminActor.id));
        await closeServiceTestPool();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('any-of filter (AC-5.2)', () => {
        it('returns a provider once when it holds two of the requested categories', async () => {
            await withServiceTestTransaction(async (tx) => {
                const group = await insertGroup(tx, { slug: 'f1', weight: 10 });
                const plumbing = await insertCategory(tx, { groupId: group, slug: 'plumbing' });
                const electric = await insertCategory(tx, { groupId: group, slug: 'electric' });
                const garden = await insertCategory(tx, { groupId: group, slug: 'garden' });
                const destination = await insertDestination(tx);

                const both = await insertProvider(tx, {
                    destinationId: destination,
                    name: 'A both',
                    categoryIds: [plumbing.id, electric.id]
                });
                const onlyGarden = await insertProvider(tx, {
                    destinationId: destination,
                    name: 'B garden',
                    categoryIds: [garden.id]
                });
                await insertProvider(tx, { destinationId: destination, name: 'C none' });

                const rows = await hostTradeModel.findForHost([destination], tx, [
                    plumbing.slug,
                    electric.slug
                ]);

                expect(rows.map((row) => row.id)).toEqual([both]);

                const anyOf = await hostTradeModel.findForHost([destination], tx, [
                    electric.slug,
                    garden.slug
                ]);
                expect(anyOf.map((row) => row.id).sort()).toEqual([both, onlyGarden].sort());
            });
        });

        it('ignores unknown slugs next to known ones and yields nothing for only unknown ones', async () => {
            await withServiceTestTransaction(async (tx) => {
                const group = await insertGroup(tx, { slug: 'f2', weight: 10 });
                const known = await insertCategory(tx, { groupId: group, slug: 'known' });
                const destination = await insertDestination(tx);
                const provider = await insertProvider(tx, {
                    destinationId: destination,
                    name: 'Known',
                    categoryIds: [known.id]
                });

                const mixed = await hostTradeModel.findForHost([destination], tx, [
                    `c-${RUN}-ghost`,
                    known.slug
                ]);
                expect(mixed.map((row) => row.id)).toEqual([provider]);

                const unknown = await hostTradeModel.findForHost([destination], tx, [
                    `c-${RUN}-ghost`,
                    `c-${RUN}-phantom`
                ]);
                expect(unknown).toEqual([]);

                const noFilter = await hostTradeModel.findForHost([destination], tx, []);
                expect(noFilter.map((row) => row.id)).toEqual([provider]);
            });
        });
    });

    describe('hydration (AC-3.3)', () => {
        it('orders by group weight, category weight and slug, keeps inactive and skips deleted', async () => {
            await withServiceTestTransaction(async (tx) => {
                const late = await insertGroup(tx, { slug: 'late', weight: 90 });
                const early = await insertGroup(tx, { slug: 'early', weight: 10 });
                const lateCat = await insertCategory(tx, {
                    groupId: late,
                    slug: 'a-late',
                    weight: 1
                });
                const earlyB = await insertCategory(tx, {
                    groupId: early,
                    slug: 'b-early',
                    weight: 5
                });
                const earlyA = await insertCategory(tx, {
                    groupId: early,
                    slug: 'a-early',
                    weight: 5
                });
                const earlyFirst = await insertCategory(tx, {
                    groupId: early,
                    slug: 'z-first',
                    weight: 1
                });
                const inactive = await insertCategory(tx, {
                    groupId: early,
                    slug: 'inactive',
                    weight: 99,
                    state: LifecycleStatusEnum.INACTIVE
                });
                const deleted = await insertCategory(tx, {
                    groupId: early,
                    slug: 'deleted',
                    weight: 1,
                    deleted: true
                });
                const destination = await insertDestination(tx);
                const provider = await insertProvider(tx, {
                    destinationId: destination,
                    name: 'Hydrated',
                    categoryIds: [
                        lateCat.id,
                        earlyB.id,
                        earlyA.id,
                        earlyFirst.id,
                        inactive.id,
                        deleted.id
                    ]
                });
                const empty = await insertProvider(tx, {
                    destinationId: destination,
                    name: 'Empty'
                });

                const map = await hostTradeModel.hydrateCategories({
                    hostTradeIds: [provider, empty],
                    tx
                });

                expect(map.get(provider)?.map((ref) => ref.slug)).toEqual([
                    earlyFirst.slug,
                    earlyA.slug,
                    earlyB.slug,
                    inactive.slug,
                    lateCat.slug
                ]);
                expect(map.get(empty)).toEqual([]);
            });
        });

        it('hydrates any number of providers with exactly one query (no N+1)', async () => {
            const pool = getServiceTestPool();
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const tx = drizzle({ client, schema }) as unknown as DrizzleClient;
                const group = await insertGroup(tx, { slug: 'f3', weight: 10 });
                const cat = await insertCategory(tx, { groupId: group, slug: 'nplus1' });
                const destination = await insertDestination(tx);
                const ids: string[] = [];
                for (let i = 0; i < 6; i++) {
                    ids.push(
                        await insertProvider(tx, {
                            destinationId: destination,
                            name: `P${i}`,
                            categoryIds: [cat.id]
                        })
                    );
                }

                const spy = vi.spyOn(client, 'query');
                const many = await hostTradeModel.hydrateCategories({ hostTradeIds: ids, tx });
                const manyCalls = spy.mock.calls.length;
                spy.mockClear();
                await hostTradeModel.hydrateCategories({ hostTradeIds: ids.slice(0, 1), tx });
                const oneCalls = spy.mock.calls.length;

                expect(many.size).toBe(6);
                expect(manyCalls).toBe(1);
                expect(oneCalls).toBe(1);
            } finally {
                vi.restoreAllMocks();
                await client.query('ROLLBACK');
                client.release();
            }
        });
    });

    describe('atomic replacement (AC-4.2)', () => {
        const committed = {
            categoryIds: [] as string[],
            groupIds: [] as string[],
            providerIds: [] as string[],
            destinationIds: [] as string[]
        };

        afterAll(async () => {
            if (!dbAvailable) return;
            const db = getServiceTestDb();
            if (committed.providerIds.length > 0) {
                await db
                    .delete(rHostTradeCategory)
                    .where(inArray(rHostTradeCategory.hostTradeId, committed.providerIds));
                await db.delete(hostTrades).where(inArray(hostTrades.id, committed.providerIds));
            }
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

        it('keeps the old set and the old row when the category write fails, and applies both when it succeeds', async () => {
            const db = getServiceTestDb();
            const group = await insertGroup(db, { slug: 'atomic', weight: 10 });
            committed.groupIds.push(group);
            const first = await insertCategory(db, { groupId: group, slug: 'first' });
            const second = await insertCategory(db, { groupId: group, slug: 'second' });
            committed.categoryIds.push(first.id, second.id);
            const destination = await insertDestination(db);
            committed.destinationIds.push(destination);
            const provider = await insertProvider(db, {
                destinationId: destination,
                name: 'Before',
                categoryIds: [first.id]
            });
            committed.providerIds.push(provider);

            const service = new HostTradeService({ logger: createLoggerMock() });
            const readState = async () => {
                const [row] = await db.select().from(hostTrades).where(eq(hostTrades.id, provider));
                const links = await db
                    .select()
                    .from(rHostTradeCategory)
                    .where(eq(rHostTradeCategory.hostTradeId, provider));
                return { name: row?.name, linked: links.map((l) => l.categoryId) };
            };

            // The real replacement runs (delete + insert), THEN the write fails.
            const original = HostTradeModel.prototype.replaceCategories;
            vi.spyOn(HostTradeModel.prototype, 'replaceCategories').mockImplementation(
                async function (this: HostTradeModel, input) {
                    await original.call(this, input);
                    throw new Error('forced failure after the category write');
                }
            );

            const failure = await settleError(
                service.update(adminActor, provider, {
                    name: 'After',
                    categoryIds: [second.id]
                })
            );
            expect(failure).not.toBeNull();
            expect(await readState()).toEqual({ name: 'Before', linked: [first.id] });

            vi.restoreAllMocks();

            const ok = await service.update(adminActor, provider, {
                name: 'After',
                categoryIds: [second.id]
            });
            expect(ok.error).toBeUndefined();
            expect(await readState()).toEqual({ name: 'After', linked: [second.id] });
        });
    });

    describe('delete a category in use (AC-3.4)', () => {
        const categoryService = () => new HostTradeCategoryService({ logger: createLoggerMock() });

        it('answers CATEGORY_IN_USE while a live provider links it, and allows it once only a deleted one does', async () => {
            await withServiceTestTransaction(async (tx) => {
                const group = await insertGroup(tx, { slug: 'del', weight: 10 });
                const used = await insertCategory(tx, { groupId: group, slug: 'used' });
                const destination = await insertDestination(tx);
                const live = await insertProvider(tx, {
                    destinationId: destination,
                    name: 'Live',
                    categoryIds: [used.id]
                });
                const ctx = { tx, hookState: {} } as ServiceContext;

                const blocked = await settleError(
                    categoryService().softDelete(adminActor, used.id, ctx)
                );
                expect(blocked?.code).toBe(ServiceErrorCode.CATEGORY_IN_USE);

                const [stillThere] = await tx
                    .select()
                    .from(hostTradeCategories)
                    .where(eq(hostTradeCategories.id, used.id));
                expect(stillThere?.deletedAt).toBeNull();
                expect(await categoryModel.countLinkedHostTrades(used.id, tx)).toBe(1);

                await tx
                    .update(hostTrades)
                    .set({ deletedAt: new Date('2026-01-01T00:00:00Z') })
                    .where(eq(hostTrades.id, live));

                const allowed = await categoryService().softDelete(adminActor, used.id, ctx);
                expect(allowed.error).toBeUndefined();
                expect(allowed.data?.count).toBe(1);
            });
        });

        it('holds the foreign key RESTRICT when the service is bypassed', async () => {
            await withServiceTestTransaction(async (tx) => {
                const group = await insertGroup(tx, { slug: 'fk', weight: 10 });
                const linked = await insertCategory(tx, { groupId: group, slug: 'linked' });
                const destination = await insertDestination(tx);
                await insertProvider(tx, {
                    destinationId: destination,
                    name: 'Linked',
                    categoryIds: [linked.id]
                });

                const attempt = tx
                    .delete(hostTradeCategories)
                    .where(eq(hostTradeCategories.id, linked.id));

                await expect(attempt).rejects.toSatisfy((error: unknown) => {
                    const text = [error, (error as { cause?: unknown })?.cause]
                        .map((e) => `${(e as { message?: string })?.message ?? ''}`)
                        .join(' ');
                    const code = (error as { cause?: { code?: string } })?.cause?.code;
                    return code === '23503' || /foreign key/i.test(text);
                });
            });
        });
    });

    describe('provisioning from lead slugs (AC-2.1, AC-2.2)', () => {
        /** Inserts a service_provider lead and reads it back as the provisioner expects. */
        async function insertLead(
            tx: DrizzleClient,
            input: { destinationId: string; categorySlugs: string[] }
        ) {
            const id = crypto.randomUUID();
            await tx.insert(allianceLeads).values({
                id,
                kind: 'service_provider',
                contactName: 'Lead Contact',
                email: `lead-${RUN}-${id.slice(0, 6)}@example.com`,
                message: 'Quiero sumarme',
                status: 'approved',
                businessName: `Lead Biz ${RUN} ${id.slice(0, 6)}`,
                destinationId: input.destinationId,
                categorySlugs: input.categorySlugs
            } as typeof allianceLeads.$inferInsert);
            const [lead] = await tx.select().from(allianceLeads).where(eq(allianceLeads.id, id));
            if (!lead) throw new Error('lead not inserted');
            return lead;
        }

        const provision = (tx: DrizzleClient, lead: Awaited<ReturnType<typeof insertLead>>) =>
            provisionServiceProviderListing({
                lead,
                hostTradeModel,
                categoryModel,
                actorId: adminActor.id,
                logger: createLoggerMock(),
                tx
            });

        it('links every category when all are active', async () => {
            await withServiceTestTransaction(async (tx) => {
                const group = await insertGroup(tx, { slug: 'p1', weight: 10 });
                const a = await insertCategory(tx, { groupId: group, slug: 'pa' });
                const b = await insertCategory(tx, { groupId: group, slug: 'pb' });
                const destination = await insertDestination(tx);
                const lead = await insertLead(tx, {
                    destinationId: destination,
                    categorySlugs: [a.slug, b.slug]
                });

                const result = await provision(tx, lead);

                expect(result.provisioned).toBe(true);
                if (!result.provisioned) return;
                const map = await hostTradeModel.hydrateCategories({
                    hostTradeIds: [result.hostTradeId],
                    tx
                });
                expect(
                    map
                        .get(result.hostTradeId)
                        ?.map((ref) => ref.slug)
                        .sort()
                ).toEqual([a.slug, b.slug].sort());
            });
        });

        it('keeps only the still-active categories when some were deactivated or deleted', async () => {
            await withServiceTestTransaction(async (tx) => {
                const group = await insertGroup(tx, { slug: 'p2', weight: 10 });
                const active = await insertCategory(tx, { groupId: group, slug: 'active' });
                const off = await insertCategory(tx, {
                    groupId: group,
                    slug: 'off',
                    state: LifecycleStatusEnum.INACTIVE
                });
                const gone = await insertCategory(tx, {
                    groupId: group,
                    slug: 'gone',
                    deleted: true
                });
                const destination = await insertDestination(tx);
                const lead = await insertLead(tx, {
                    destinationId: destination,
                    categorySlugs: [active.slug, off.slug, gone.slug, `c-${RUN}-ghost`]
                });

                const result = await provision(tx, lead);

                expect(result.provisioned).toBe(true);
                if (!result.provisioned) return;
                const map = await hostTradeModel.hydrateCategories({
                    hostTradeIds: [result.hostTradeId],
                    tx
                });
                expect(map.get(result.hostTradeId)?.map((ref) => ref.slug)).toEqual([active.slug]);
            });
        });

        it('skips the listing, without creating a row, when no chosen category is active', async () => {
            await withServiceTestTransaction(async (tx) => {
                const group = await insertGroup(tx, { slug: 'p3', weight: 10 });
                const off = await insertCategory(tx, {
                    groupId: group,
                    slug: 'off3',
                    state: LifecycleStatusEnum.INACTIVE
                });
                const destination = await insertDestination(tx);
                const lead = await insertLead(tx, {
                    destinationId: destination,
                    categorySlugs: [off.slug]
                });

                const result = await provision(tx, lead);

                expect(result).toEqual({ provisioned: false, reason: 'no-active-category' });
                const rows = await tx
                    .select()
                    .from(hostTrades)
                    .where(eq(hostTrades.destinationId, destination));
                expect(rows).toEqual([]);
            });
        });
    });
});
