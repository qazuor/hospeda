import {
    emailOutbox,
    eq,
    getDb,
    planCatalogModel,
    planVersions,
    providerLinks,
    subscriptions,
    users
} from '@repo/db';
import { createPlanCatalogInverse } from '@repo/verticals';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { listRetiredPlanVersions } from '../../../src/services/billing/plan-migration/plan-migration-retired-versions.service.js';
import { cancelActiveSubscription } from '../../../src/services/billing/subscription/cancel-active-subscription.service.js';
import { cancelPendingAttempt } from '../../../src/services/billing/subscription/cancel-pending-attempt.service.js';
import { applyS12ToPrincipal } from '../../../src/services/billing/subscription/service-end-s12.js';
import type { Actor } from '../../../src/types/index.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { orphanPorts } from './support/addon-orphan-fixtures.js';
import { unusedComplementPolicy } from './support/cancel-active-fixtures.js';
import { startCyclePriceCustomer } from './support/cycle-price-fixtures.js';
import {
    cleanupPlanMigrationCases,
    createPlanMigrationCase,
    createPriceIncreaseCase,
    migrationClock
} from './support/plan-migration-fixtures.js';

const db = getServiceTestDb();
const pendingClock = { now: () => new Date('2026-10-08T20:00:00.000Z') };
const s12Clock = { now: () => new Date('2030-01-01T00:00:00.000Z') };
const beforeCancelNotice = { beforeCancel: async () => 'SENT' as const };
const verticals = createPlanCatalogInverse({ reader: planCatalogModel });
const extraCustomers: Array<{ subscriptionId: string; userId: string }> = [];

/** Start one more real customer on an option and remember it for cleanup by id. */
async function startExtraCustomer(billingOptionId: string) {
    const started = await startCyclePriceCustomer(billingOptionId);
    const [row] = await db
        .select({ userId: subscriptions.userId })
        .from(subscriptions)
        .where(eq(subscriptions.id, started.subscriptionId));
    if (!row?.userId) throw new Error('Extra customer subscription missing');
    extraCustomers.push({ subscriptionId: started.subscriptionId, userId: row.userId });
    return { ...started, userId: row.userId };
}

/** Ask the listing and keep only the items of the versions this test seeded. */
async function listedItems(actor: Actor, ids: readonly string[]) {
    const list = await listRetiredPlanVersions({ actor, verticals });
    return list.items.filter((item) => ids.includes(item.id));
}

/** End an active card subscription through S11 and cut its service through S12. */
async function endActiveSubscription(args: {
    readonly actor: Actor;
    readonly subscriptionId: string;
    readonly provider: Parameters<typeof cancelActiveSubscription>[1]['provider'];
}) {
    await cancelActiveSubscription(
        { actor: args.actor, subscriptionId: args.subscriptionId },
        {
            provider: args.provider,
            clock: migrationClock,
            beforeCancelNotice,
            complements: unusedComplementPolicy,
            coverageNotices: { emitCoverageChanged: async () => undefined }
        }
    );
    await db.transaction(async (tx) =>
        applyS12ToPrincipal(
            { tx, subscriptionId: args.subscriptionId, now: s12Clock.now() },
            { orphanhood: orphanPorts(tx).ports, clock: s12Clock }
        )
    );
}

afterEach(async () => {
    for (const customer of extraCustomers.splice(0)) {
        await db.delete(emailOutbox).where(eq(emailOutbox.recipientUserId, customer.userId));
        await db
            .delete(providerLinks)
            .where(eq(providerLinks.subscriptionId, customer.subscriptionId));
        await db.delete(subscriptions).where(eq(subscriptions.id, customer.subscriptionId));
        await db.delete(users).where(eq(users.id, customer.userId));
    }
    await cleanupPlanMigrationCases();
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B12:11 AC:B12:10 la cola del retiro se ve',
    () => {
        it('la ve con 3 y, cuando la deja la última, deja de contar como viva sin que nadie escriba un estado en la versión', async () => {
            const seeded = await createPlanMigrationCase();
            const [beforeVersion] = await db
                .select()
                .from(planVersions)
                .where(eq(planVersions.id, seeded.planVersionId));
            if (!beforeVersion) throw new Error('Retired source version missing');
            // Two customers start through startSubscription; with the fixture
            // predecessor they leave three live rows anchored to the retired version.
            const first = await startExtraCustomer(seeded.predecessorBillingOptionId);
            await startExtraCustomer(seeded.predecessorBillingOptionId);
            const ids = [seeded.planVersionId];
            expect(await listedItems(seeded.actor, ids)).toEqual([
                {
                    id: seeded.planVersionId,
                    planId: seeded.planId,
                    name: 'Succession plan',
                    vertical: 'accommodation',
                    // The source is the first version created for its plan.
                    versionNumber: 1,
                    liveSubscriptionCount: 3
                }
            ]);

            // S11 only schedules the end: CANCEL_SCHEDULED is still live.
            await cancelActiveSubscription(
                {
                    actor: { id: seeded.user.id, roles: [], permissions: [] },
                    subscriptionId: seeded.predecessor.id
                },
                {
                    provider: seeded.provider,
                    clock: migrationClock,
                    beforeCancelNotice,
                    complements: unusedComplementPolicy,
                    coverageNotices: { emitCoverageChanged: async () => undefined }
                }
            );
            expect((await listedItems(seeded.actor, ids))[0]?.liveSubscriptionCount).toBe(3);
            await db.transaction(async (tx) =>
                applyS12ToPrincipal(
                    { tx, subscriptionId: seeded.predecessor.id, now: s12Clock.now() },
                    { orphanhood: orphanPorts(tx).ports, clock: s12Clock }
                )
            );
            expect((await listedItems(seeded.actor, ids))[0]?.liveSubscriptionCount).toBe(2);

            await cancelPendingAttempt(
                { subscriptionId: first.subscriptionId, userId: first.userId },
                { provider: first.provider, clock: pendingClock, beforeCancelNotice }
            );
            expect((await listedItems(seeded.actor, ids))[0]?.liveSubscriptionCount).toBe(1);

            const [afterVersion] = await db
                .select()
                .from(planVersions)
                .where(eq(planVersions.id, seeded.planVersionId));
            expect(afterVersion).toEqual(beforeVersion);
        });

        it('cuando la deja la última, deja de contar como viva y sale del listado', async () => {
            const seeded = await createPlanMigrationCase();
            const first = await startExtraCustomer(seeded.predecessorBillingOptionId);
            const second = await startExtraCustomer(seeded.predecessorBillingOptionId);
            const ids = [seeded.planVersionId];
            expect((await listedItems(seeded.actor, ids))[0]?.liveSubscriptionCount).toBe(3);

            await cancelPendingAttempt(
                { subscriptionId: first.subscriptionId, userId: first.userId },
                { provider: first.provider, clock: pendingClock, beforeCancelNotice }
            );
            await cancelPendingAttempt(
                { subscriptionId: second.subscriptionId, userId: second.userId },
                { provider: second.provider, clock: pendingClock, beforeCancelNotice }
            );
            await endActiveSubscription({
                actor: { id: seeded.user.id, roles: [], permissions: [] },
                subscriptionId: seeded.predecessor.id,
                provider: seeded.provider
            });

            expect(await listedItems(seeded.actor, ids)).toEqual([]);
        });

        it('una versión no vigente de un plan con aumento figura y su destino vigente y vendible con un cliente no', async () => {
            const seeded = await createPriceIncreaseCase();
            // One real customer on the current, sellable destination of the same plan.
            await startExtraCustomer(seeded.increaseTargetOption.id);
            expect(await listedItems(seeded.actor, [seeded.planVersionId])).toEqual([
                {
                    id: seeded.planVersionId,
                    planId: seeded.planId,
                    name: 'Succession plan',
                    vertical: 'accommodation',
                    // The source is the first version created for its plan.
                    versionNumber: 1,
                    liveSubscriptionCount: 1
                }
            ]);
            expect(
                await listedItems(seeded.actor, [
                    seeded.increaseTarget.id,
                    seeded.targetPlanVersionId
                ])
            ).toEqual([]);
        });

        it('sin BILLING_MIGRATE_PLAN rechaza ADMINISTRATIVE_ACTION_FORBIDDEN antes de cualquier lectura', async () => {
            const seeded = await createPlanMigrationCase();
            const client = getDb();
            const selectSpy = vi.spyOn(client, 'select');
            const planPolicy = vi.fn(verticals.planPolicy);
            try {
                await expect(
                    listRetiredPlanVersions({
                        actor: { ...seeded.actor, permissions: [] },
                        verticals: { planPolicy }
                    })
                ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
                expect(selectSpy).toHaveBeenCalledTimes(0);
                expect(planPolicy).toHaveBeenCalledTimes(0);
            } finally {
                selectSpy.mockRestore();
            }
        });
    }
);
