/**
 * HOS-919 review fixes 1 and 2 against a REAL database.
 *
 * - A real `host_trades` row has `category = NULL` (nothing writes the legacy
 *   column any more): what a single-entity read returns must still parse
 *   through the response schemas the API uses.
 * - Every single-entity read path (`getById`, `getBySlug`, `getOwn`) and the
 *   `create`/`update` return value must carry the provider's real
 *   `categories`, not the schema default `[]`.
 *
 * Every test runs inside a rolled-back transaction.
 *
 * @module host-trade-categories-reads.integration.test
 */
import {
    type DrizzleClient,
    destinations,
    eq,
    hostTradeCategories,
    hostTradeCategoryGroups,
    hostTrades,
    rHostTradeCategory,
    users
} from '@repo/db';
import {
    HostTradeAdminSchema,
    HostTradePublicSchema,
    LifecycleStatusEnum,
    PermissionEnum,
    RoleEnum
} from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HostTradeService } from '../../../src/services/hostTrade/host-trade.service';
import type { Actor, ServiceContext } from '../../../src/types';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();
const RUN = crypto.randomUUID().slice(0, 8);

const actor: Actor = {
    id: '00000000-0000-4000-a000-000000000920',
    roles: [RoleEnum.SUPER_ADMIN],
    permissions: [
        PermissionEnum.HOST_TRADE_VIEW,
        PermissionEnum.HOST_TRADE_VIEW_ALL,
        PermissionEnum.HOST_TRADE_CREATE,
        PermissionEnum.HOST_TRADE_UPDATE,
        PermissionEnum.HOST_TRADE_DELETE
    ]
};

async function insertCategories(tx: DrizzleClient, slugs: readonly string[]) {
    const groupId = crypto.randomUUID();
    await tx.insert(hostTradeCategoryGroups).values({
        id: groupId,
        slug: `g-${RUN}-${slugs[0]}`,
        nameI18n: { es: 'g', en: 'g', pt: 'g' },
        displayWeight: 10
    });
    const out: { id: string; slug: string }[] = [];
    for (const [index, slug] of slugs.entries()) {
        const id = crypto.randomUUID();
        const full = `c-${RUN}-${slug}`;
        await tx.insert(hostTradeCategories).values({
            id,
            slug: full,
            groupId,
            nameI18n: { es: slug, en: slug, pt: slug },
            displayWeight: 10 + index,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        out.push({ id, slug: full });
    }
    return out;
}

async function insertDestination(tx: DrizzleClient): Promise<string> {
    const id = crypto.randomUUID();
    await tx.insert(destinations).values({
        id,
        slug: `ht-reads-dest-${RUN}-${id.slice(0, 6)}`,
        name: 'Reads Test Destination',
        destinationType: 'CITY',
        level: 4,
        path: `/ht-reads/${id}`,
        summary: 'Reads test destination summary',
        description: 'Reads test destination description',
        location: {
            state: 'Entre Rios',
            country: 'Argentina',
            coordinates: { lat: '-32.48', long: '-58.23' }
        },
        media: {
            featuredImage: {
                moderationState: 'APPROVED',
                url: 'https://example.com/ht-reads-destination.jpg'
            }
        },
        lifecycleState: 'ACTIVE'
    } as typeof destinations.$inferInsert);
    return id;
}

async function insertProvider(
    tx: DrizzleClient,
    input: { destinationId: string; categoryIds: readonly string[]; ownerUserId?: string }
) {
    const id = crypto.randomUUID();
    const slug = `ht-reads-${RUN}-${id.slice(0, 8)}`;
    await tx.insert(hostTrades).values({
        id,
        slug,
        name: 'Reads provider',
        contact: '+54 9 3442 000000',
        benefit: '10% de descuento',
        destinationId: input.destinationId,
        ownerUserId: input.ownerUserId ?? null
    } as typeof hostTrades.$inferInsert);
    for (const categoryId of input.categoryIds) {
        await tx.insert(rHostTradeCategory).values({ hostTradeId: id, categoryId });
    }
    return { id, slug };
}

describe.skipIf(!dbAvailable)('HostTradeService single-entity reads — real DB (HOS-919)', () => {
    beforeAll(async () => {
        await getServiceTestDb()
            .insert(users)
            .values({
                id: actor.id,
                email: `ht-reads-${RUN}@example.com`,
                displayName: 'Reads Test Admin',
                emailVerified: true,
                lifecycleState: 'ACTIVE'
            } as typeof users.$inferInsert);
    });

    afterAll(async () => {
        await getServiceTestDb().delete(users).where(eq(users.id, actor.id));
        await closeServiceTestPool();
    });

    const service = () => new HostTradeService({ logger: createLoggerMock() });

    it('getById, getBySlug and getOwn return the real categories and parse a NULL legacy category', async () => {
        await withServiceTestTransaction(async (tx) => {
            const [first, second] = await insertCategories(tx, ['plumbing', 'electric']);
            const destinationId = await insertDestination(tx);
            const provider = await insertProvider(tx, {
                destinationId,
                categoryIds: [first!.id, second!.id],
                ownerUserId: actor.id
            });
            const ctx = { tx, hookState: {} } as ServiceContext;
            const expected = [first!.slug, second!.slug];

            const byId = await service().getById(actor, provider.id, ctx);
            const bySlug = await service().getBySlug(actor, provider.slug, ctx);
            const own = await service().getOwn(actor, ctx);

            expect(byId.error).toBeUndefined();
            expect(byId.data?.categories.map((c) => c.slug)).toEqual(expected);
            expect(bySlug.data?.categories.map((c) => c.slug)).toEqual(expected);
            expect(own.data?.trade?.categories.map((c) => c.slug)).toEqual(expected);

            // The row is a real one: category is NULL and must survive the response schemas.
            expect(byId.data?.category ?? null).toBeNull();
            expect(HostTradeAdminSchema.safeParse(byId.data).success).toBe(true);
            expect(HostTradePublicSchema.safeParse(bySlug.data).success).toBe(true);
        });
    });

    it('create and update return the categories actually stored', async () => {
        await withServiceTestTransaction(async (tx) => {
            const [first, second] = await insertCategories(tx, ['create-a', 'create-b']);
            const destinationId = await insertDestination(tx);
            const ctx = { tx, hookState: {} } as ServiceContext;

            const created = await service().create(
                actor,
                {
                    name: 'Created provider',
                    contact: '+54 9 3442 111111',
                    benefit: '10% de descuento',
                    destinationId,
                    is24h: false,
                    isActive: true,
                    categoryIds: [first!.id, second!.id]
                },
                ctx
            );
            expect(created.error).toBeUndefined();
            expect(created.data?.categories.map((c) => c.slug)).toEqual([
                first!.slug,
                second!.slug
            ]);

            const id = created.data!.id;
            const renamed = await service().update(actor, id, { name: 'Renamed' }, {
                tx,
                hookState: {}
            } as ServiceContext);
            expect(renamed.error).toBeUndefined();
            expect(renamed.data?.categories.map((c) => c.slug)).toEqual([
                first!.slug,
                second!.slug
            ]);

            const replaced = await service().update(actor, id, { categoryIds: [second!.id] }, {
                tx,
                hookState: {}
            } as ServiceContext);
            expect(replaced.data?.categories.map((c) => c.slug)).toEqual([second!.slug]);
        });
    });

    it('revoke and reviewPendingBenefit return the real categories', async () => {
        await withServiceTestTransaction(async (tx) => {
            const [first, second] = await insertCategories(tx, ['rev-a', 'rev-b']);
            const destinationId = await insertDestination(tx);
            const provider = await insertProvider(tx, {
                destinationId,
                categoryIds: [first!.id, second!.id]
            });
            const expected = [first!.slug, second!.slug];
            const ctx = () => ({ tx, hookState: {} }) as ServiceContext;

            const revoked = await service().revoke(
                actor,
                { id: provider.id, reason: 'duplicate listing' },
                ctx()
            );
            const again = await service().revoke(
                actor,
                { id: provider.id, reason: 'duplicate listing' },
                ctx()
            );

            expect(revoked.error).toBeUndefined();
            expect(revoked.data?.trade.categories.map((c) => c.slug)).toEqual(expected);
            expect(again.data?.trade.categories.map((c) => c.slug)).toEqual(expected);

            await tx
                .update(hostTrades)
                .set({ benefitReviewState: 'PENDING', pendingBenefitText: 'new text' })
                .where(eq(hostTrades.id, provider.id));
            const reviewed = await service().reviewPendingBenefit(
                actor,
                { id: provider.id, decision: 'reject' },
                ctx()
            );
            expect(reviewed.error).toBeUndefined();
            expect(reviewed.data?.trade.categories.map((c) => c.slug)).toEqual(expected);
        });
    });
});
