import {
    and,
    billingOptions,
    emailOutbox,
    eq,
    idempotencyKeys,
    inArray,
    payments,
    planMigrationSubscriptions,
    providerLinks,
    reconciliationMarkPayments,
    reconciliationMarks,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { exitPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-exit.js';
import { activateSubscription } from '../../../src/services/billing/subscription/activate-subscription.service.js';
import { cancelActiveSubscription } from '../../../src/services/billing/subscription/cancel-active-subscription.service.js';
import { cancelDirectSubscription } from '../../../src/services/billing/subscription/cancel-direct-subscription.service.js';
import { cancelPausedSubscription } from '../../../src/services/billing/subscription/cancel-paused-subscription.service.js';
import { cancelSuccessionPredecessor } from '../../../src/services/billing/subscription/cancel-succession-predecessor.service.js';
import { pauseSubscription } from '../../../src/services/billing/subscription/pause-subscription.service.js';
import { requestPlanChange } from '../../../src/services/billing/subscription/request-plan-change.service.js';
import { queueDowngrade } from '../../../src/services/billing/subscription/request-plan-change-support.js';
import { createSuccessionCloser } from '../../../src/services/billing/subscription/succession-closer.service.js';
import { suspendForArrears } from '../../../src/services/billing/subscription/suspend-for-arrears.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';
import { seedAdditionalPlanChangeTarget } from './support/plan-change-fixtures.js';
import {
    cleanupAnnouncedExitCases,
    createAnnouncedExitCase
} from './support/plan-migration-exit-fixtures.js';
import { seedScheduledChange } from './support/scheduled-change-fixtures.js';
import { noTouristVip } from './support/tourist-vip.js';

const clock = { now: () => new Date('2026-10-11T13:00:00.000Z') };
const beforeCancelNotice = { beforeCancel: async () => 'SENT' as const };
const complements = {
    addonPolicy: async () => {
        throw new Error('Unexpected addon policy');
    },
    listing: async () => {
        throw new Error('Unexpected listing policy');
    }
};
const orphanhood = complements;
const coverageNotices = { emitCoverageChanged: async () => undefined };

const ownedSubscriptions: string[] = [];
const creditRows: string[] = [];
const closedSuccessors: Array<{ id: string; predecessorId: string; userId: string }> = [];

const db = () => getServiceTestDb();

/**
 * Seeds one announced exit case and records every subscription it created, so
 * cleanup can remove the dependants other parallel files may have attached.
 */
async function trackedExitCase(
    args: Parameters<typeof createAnnouncedExitCase>[0] = {}
): ReturnType<typeof createAnnouncedExitCase> {
    const created = await createAnnouncedExitCase(args);
    ownedSubscriptions.push(created.seeded.predecessor.id);
    for (const customer of [
        created.pendingCustomer,
        created.unresolvedCustomer,
        ...created.additionalCustomers
    ]) {
        if (customer) ownedSubscriptions.push(customer.subscriptionId);
    }
    return created;
}

/**
 * Removes children that reference this file's subscriptions or payments first:
 * a parallel sweep can hang a reconciliation mark (and its payment links) on a
 * row this file owns, and the FK blocks deleting the parent otherwise.
 */
async function retireOwnDependants(subscriptionIds: readonly string[]): Promise<void> {
    if (subscriptionIds.length === 0) return;
    const marks = await db()
        .select({ id: reconciliationMarks.id })
        .from(reconciliationMarks)
        .where(inArray(reconciliationMarks.subscriptionId, subscriptionIds));
    const paymentRows = await db()
        .select({ id: payments.id })
        .from(payments)
        .where(inArray(payments.subscriptionId, subscriptionIds));
    const markIds = marks.map((row) => row.id);
    const paymentIds = paymentRows.map((row) => row.id);
    if (markIds.length)
        await db()
            .delete(reconciliationMarkPayments)
            .where(inArray(reconciliationMarkPayments.markId, markIds));
    if (paymentIds.length)
        await db()
            .delete(reconciliationMarkPayments)
            .where(inArray(reconciliationMarkPayments.paymentId, paymentIds));
    await db()
        .delete(reconciliationMarks)
        .where(inArray(reconciliationMarks.subscriptionId, subscriptionIds));
}

afterEach(async () => {
    await retireOwnDependants(ownedSubscriptions.splice(0));
    for (const successor of closedSuccessors.splice(0)) {
        await getServiceTestDb()
            .delete(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, successor.userId));
        await getServiceTestDb()
            .update(subscriptions)
            .set({ succeededById: null })
            .where(eq(subscriptions.id, successor.predecessorId));
        await getServiceTestDb()
            .delete(providerLinks)
            .where(eq(providerLinks.subscriptionId, successor.id));
        await getServiceTestDb()
            .delete(idempotencyKeys)
            .where(eq(idempotencyKeys.subjectId, successor.id));
        await getServiceTestDb().delete(subscriptions).where(eq(subscriptions.id, successor.id));
    }
    if (creditRows.length)
        await getServiceTestDb()
            .update(subscriptions)
            .set({ succeedsId: null })
            .where(inArray(subscriptions.id, creditRows.splice(0)));
    await cleanupAnnouncedExitCases();
});
afterAll(closeServiceTestPool);

async function scope(subscriptionId: string) {
    const [row] = await getServiceTestDb()
        .select()
        .from(planMigrationSubscriptions)
        .where(eq(planMigrationSubscriptions.subscriptionId, subscriptionId));
    if (!row) throw new Error('Migration scope row missing');
    return row;
}

async function expectExit(subscriptionId: string, reason: 'SE_DIO_DE_BAJA' | 'CAMBIO_DE_PLAN') {
    const row = await scope(subscriptionId);
    expect({
        status: row.status,
        outReason: row.outReason,
        appliedAt: row.appliedAt,
        updatedAt: row.updatedAt
    }).toEqual({
        status: 'FUERA',
        outReason: reason,
        appliedAt: null,
        updatedAt: expect.any(Date)
    });
}

describe.skipIf(!isServiceTestDbAvailable())(
    '§3.7.8 si el cliente se da de baja por su cuenta durante el aviso, sale de la migración',
    () => {
        it('cancelActiveSubscription exits a PENDIENTE row in the S11 transaction', async () => {
            const { seeded } = await trackedExitCase();
            const result = await cancelActiveSubscription(
                {
                    actor: { id: seeded.user.id, roles: [], permissions: [] },
                    subscriptionId: seeded.predecessor.id
                },
                {
                    provider: seeded.provider,
                    clock,
                    beforeCancelNotice,
                    complements,
                    coverageNotices
                }
            );
            expect(result.outcome).toBe('SCHEDULED');
            expect(
                await getServiceTestDb()
                    .select({ status: subscriptions.status })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, seeded.predecessor.id))
            ).toEqual([{ status: 'CANCEL_SCHEDULED' }]);
            await expectExit(seeded.predecessor.id, 'SE_DIO_DE_BAJA');
        });

        it('cancelDirectSubscription retains the customer reason across the terminal trigger', async () => {
            const { seeded } = await trackedExitCase();
            await seeded.fake.pause({ authorizationId: seeded.started.authorizationId });
            const suspended = await suspendForArrears(
                {
                    subscriptionId: seeded.predecessor.id,
                    event: 'PROVIDER_PAUSE_OBSERVED',
                    occurrenceId: crypto.randomUUID()
                },
                { provider: seeded.provider, clock, beforeCancelNotice, coverageNotices }
            );
            expect(suspended.outcome).toBe('SUSPENDED');
            const result = await cancelDirectSubscription(
                {
                    actor: { id: seeded.user.id, roles: [], permissions: [] },
                    subscriptionId: seeded.predecessor.id
                },
                {
                    provider: seeded.provider,
                    clock,
                    beforeCancelNotice,
                    coverageNotices,
                    orphanhood
                }
            );
            expect(result.outcome).toBe('CANCELLED');
            expect(
                await getServiceTestDb()
                    .select({ status: subscriptions.status })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, seeded.predecessor.id))
            ).toEqual([{ status: 'CANCELLED' }]);
            await expectExit(seeded.predecessor.id, 'SE_DIO_DE_BAJA');
        });

        it('cancelPausedSubscription exits after a real customer pause', async () => {
            const { seeded } = await trackedExitCase();
            const paused = await pauseSubscription(
                { subscriptionId: seeded.predecessor.id, requestedMonths: 2 },
                {
                    provider: seeded.provider,
                    clock,
                    planPolicy: async () => ({
                        graceDays: 10,
                        allowsPause: true,
                        current: true,
                        sellable: true
                    }),
                    complements,
                    coverageNotices
                }
            );
            expect(paused.outcome).toBe('PAUSED');
            const result = await cancelPausedSubscription(
                {
                    actor: { id: seeded.user.id, roles: [], permissions: [] },
                    subscriptionId: seeded.predecessor.id
                },
                {
                    provider: seeded.provider,
                    clock,
                    beforeCancelNotice,
                    coverageNotices,
                    orphanhood,
                    complements
                }
            );
            expect(result.outcome).toBe('CANCELLED');
            await expectExit(seeded.predecessor.id, 'SE_DIO_DE_BAJA');
        });

        it('credited paused cancellation exits when S22 schedules the end', async () => {
            const { seeded, pendingCustomer } = await trackedExitCase({
                addPendingCustomer: true
            });
            if (!pendingCustomer) throw new Error('Credit predecessor missing');
            // Seeded succession credit facts; the pause and cancellation remain real acts.
            await getServiceTestDb()
                .update(subscriptions)
                .set({
                    succeedsId: pendingCustomer.subscriptionId,
                    firstChargeAt: new Date('2026-12-01T00:00:00.000Z'),
                    authorizationWindowEndsAt: new Date('2026-10-19T00:00:00.000Z')
                })
                .where(eq(subscriptions.id, seeded.predecessor.id));
            creditRows.push(seeded.predecessor.id);
            const paused = await pauseSubscription(
                { subscriptionId: seeded.predecessor.id, requestedMonths: 2 },
                {
                    provider: seeded.provider,
                    clock,
                    planPolicy: async () => ({
                        graceDays: 10,
                        allowsPause: true,
                        current: true,
                        sellable: true
                    }),
                    complements,
                    coverageNotices
                }
            );
            expect(paused.outcome).toBe('PAUSED');
            const result = await cancelPausedSubscription(
                {
                    actor: { id: seeded.user.id, roles: [], permissions: [] },
                    subscriptionId: seeded.predecessor.id
                },
                {
                    provider: seeded.provider,
                    clock,
                    beforeCancelNotice,
                    coverageNotices,
                    orphanhood,
                    complements
                }
            );
            expect(result.outcome).toBe('SCHEDULED');
            await expectExit(seeded.predecessor.id, 'SE_DIO_DE_BAJA');
        });

        it('an APLICADA row stays intact when its owner cancels', async () => {
            const { seeded } = await trackedExitCase();
            // Seeded APLICADA: S37, its only writer, belongs to HOS-1614.
            await getServiceTestDb()
                .update(planMigrationSubscriptions)
                .set({ status: 'APLICADA', appliedAt: clock.now() })
                .where(eq(planMigrationSubscriptions.subscriptionId, seeded.predecessor.id));
            const applied = await scope(seeded.predecessor.id);
            const result = await cancelActiveSubscription(
                {
                    actor: { id: seeded.user.id, roles: [], permissions: [] },
                    subscriptionId: seeded.predecessor.id
                },
                {
                    provider: seeded.provider,
                    clock,
                    beforeCancelNotice,
                    complements,
                    coverageNotices
                }
            );
            expect(result.outcome).toBe('SCHEDULED');
            expect(await scope(seeded.predecessor.id)).toEqual(applied);
        });

        it('an owner cancellation also exits PARA_RESOLVER', async () => {
            const { seeded } = await trackedExitCase({ unresolved: true });
            expect((await scope(seeded.predecessor.id)).status).toBe('PARA_RESOLVER');
            const result = await cancelActiveSubscription(
                {
                    actor: { id: seeded.user.id, roles: [], permissions: [] },
                    subscriptionId: seeded.predecessor.id
                },
                {
                    provider: seeded.provider,
                    clock,
                    beforeCancelNotice,
                    complements,
                    coverageNotices
                }
            );
            expect(result.outcome).toBe('SCHEDULED');
            await expectExit(seeded.predecessor.id, 'SE_DIO_DE_BAJA');
        });
    }
);

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B12:6 AC:B12:6 quien cambia de plan en el medio sale con «cambió de plan»',
    () => {
        it('an accepted downgrade exits while a rejected act leaves PENDIENTE', async () => {
            const { seeded } = await trackedExitCase();
            seeded.verticals.setChangeDirection({
                fromPlanVersionId: seeded.planVersionId,
                toPlanVersionId: seeded.targetPlanVersionId,
                direction: 'DOWN'
            });
            const rejected = await requestPlanChange(
                { ...seeded.input, billingOptionId: seeded.predecessorBillingOptionId },
                seeded.ports
            );
            expect(rejected).toEqual({ path: 'REJECTED', reason: 'NO_CHANGE' });
            expect((await scope(seeded.predecessor.id)).status).toBe('PENDIENTE');
            const [monthly] = await getServiceTestDb()
                .select({ id: billingOptions.id })
                .from(billingOptions)
                .where(
                    and(
                        eq(billingOptions.planVersionId, seeded.targetPlanVersionId),
                        eq(billingOptions.cycle, 'monthly')
                    )
                )
                .limit(1);
            if (!monthly) throw new Error('Migration monthly option missing');
            const accepted = await requestPlanChange(
                { ...seeded.input, billingOptionId: monthly.id },
                {
                    ...seeded.ports,
                    changeDirection: seeded.verticals.changeDirection.bind(seeded.verticals)
                }
            );
            expect(accepted.path).toBe('DOWNGRADE');
            await expectExit(seeded.predecessor.id, 'CAMBIO_DE_PLAN');
        });

        it('an accepted upgrade exits before the predecessor reaches a terminal state', async () => {
            const { seeded } = await trackedExitCase();
            const accepted = await requestPlanChange(seeded.input, {
                ...seeded.ports,
                changeDirection: seeded.verticals.changeDirection.bind(seeded.verticals),
                planPolicy: seeded.verticals.planPolicy.bind(seeded.verticals)
            });
            expect(accepted.path).toBe('SUCCESSION');
            await expectExit(seeded.predecessor.id, 'CAMBIO_DE_PLAN');
            if (accepted.path !== 'SUCCESSION') throw new Error('Successor missing');
            closedSuccessors.push({
                id: accepted.subscriptionId,
                predecessorId: seeded.predecessor.id,
                userId: seeded.user.id
            });
            ownedSubscriptions.push(accepted.subscriptionId);
            const [link] = await getServiceTestDb()
                .select({ providerId: providerLinks.providerId })
                .from(providerLinks)
                .where(eq(providerLinks.subscriptionId, accepted.subscriptionId));
            if (!link) throw new Error('Successor authorization missing');
            await seeded.fake.approve({ authorizationId: link.providerId });
            const successionCloser = createSuccessionCloser({ clock });
            const activated = await activateSubscription(accepted.subscriptionId, {
                provider: seeded.provider,
                clock,
                beforeCancelNotice,
                touristVipInheritance: noTouristVip,
                successionCloser,
                changeDirection: seeded.verticals.changeDirection.bind(seeded.verticals)
            });
            expect(activated.activated).toBe(true);
            const closed = await cancelSuccessionPredecessor(
                { successorSubscriptionId: accepted.subscriptionId },
                {
                    provider: seeded.provider,
                    clock,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                    successionCloser,
                    coverageNotices
                }
            );
            expect(closed.outcome).toBe('CANCELLED');
            expect(
                await getServiceTestDb()
                    .select({ status: subscriptions.status })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, seeded.predecessor.id))
            ).toEqual([{ status: 'CANCELLED' }]);
            await expectExit(seeded.predecessor.id, 'CAMBIO_DE_PLAN');
        });

        it('replacing an accepted downgrade preserves its original exit reason', async () => {
            const { seeded } = await trackedExitCase();
            const [monthly] = await getServiceTestDb()
                .select({ id: billingOptions.id })
                .from(billingOptions)
                .where(
                    and(
                        eq(billingOptions.planVersionId, seeded.targetPlanVersionId),
                        eq(billingOptions.cycle, 'monthly')
                    )
                )
                .limit(1);
            if (!monthly) throw new Error('Migration monthly option missing');
            seeded.verticals.setChangeDirection({
                fromPlanVersionId: seeded.planVersionId,
                toPlanVersionId: seeded.targetPlanVersionId,
                direction: 'DOWN'
            });
            const ports = {
                ...seeded.ports,
                changeDirection: seeded.verticals.changeDirection.bind(seeded.verticals)
            };
            expect(
                (await requestPlanChange({ ...seeded.input, billingOptionId: monthly.id }, ports))
                    .path
            ).toBe('DOWNGRADE');
            const exited = await scope(seeded.predecessor.id);
            const replacement = await seedAdditionalPlanChangeTarget({
                planVersionId: seeded.planVersionId,
                rankOffset: 3
            });
            seeded.verticals.setChangeDirection({
                fromPlanVersionId: seeded.planVersionId,
                toPlanVersionId: replacement.planVersionId,
                direction: 'DOWN'
            });
            const result = await requestPlanChange(
                { ...seeded.input, billingOptionId: replacement.billingOptionId },
                ports
            );
            expect(result.path).toBe('DOWNGRADE');
            expect(await scope(seeded.predecessor.id)).toEqual(exited);
        });

        it('PARA_RESOLVER exits and a seeded APLICADA row remains untouched', async () => {
            const { seeded } = await trackedExitCase({ unresolved: true });
            const before = await scope(seeded.predecessor.id);
            expect(before.status).toBe('PARA_RESOLVER');
            await getServiceTestDb().transaction((tx) =>
                exitPlanMigration({
                    tx,
                    subscriptionId: seeded.predecessor.id,
                    reason: 'CAMBIO_DE_PLAN'
                })
            );
            await expectExit(seeded.predecessor.id, 'CAMBIO_DE_PLAN');
            // Seeded APLICADA: S37, its only writer, belongs to HOS-1614.
            await getServiceTestDb()
                .update(planMigrationSubscriptions)
                .set({ status: 'APLICADA', outReason: null, appliedAt: clock.now() })
                .where(eq(planMigrationSubscriptions.subscriptionId, seeded.predecessor.id));
            const applied = await scope(seeded.predecessor.id);
            const result = await getServiceTestDb().transaction((tx) =>
                exitPlanMigration({
                    tx,
                    subscriptionId: seeded.predecessor.id,
                    reason: 'SE_DIO_DE_BAJA'
                })
            );
            expect(result).toEqual({ exited: 0 });
            expect(await scope(seeded.predecessor.id)).toEqual(applied);
        });

        it('a rejected transaction rolls back its exit', async () => {
            const { seeded } = await trackedExitCase();
            const before = await scope(seeded.predecessor.id);
            const rollback = new Error('reject customer act');
            await expect(
                getServiceTestDb().transaction(async (tx) => {
                    await exitPlanMigration({
                        tx,
                        subscriptionId: seeded.predecessor.id,
                        reason: 'CAMBIO_DE_PLAN'
                    });
                    throw rollback;
                })
            ).rejects.toBe(rollback);
            expect(await scope(seeded.predecessor.id)).toEqual(before);
        });
        it('a duplicate queued change aborts without exiting PENDIENTE', async () => {
            const { seeded } = await trackedExitCase();
            await seedScheduledChange({
                subscriptionId: seeded.predecessor.id,
                effectiveAt: clock.now()
            });
            const before = await scope(seeded.predecessor.id);
            await expect(
                queueDowngrade({
                    subscriptionId: seeded.predecessor.id,
                    targetPlanVersionId: seeded.targetPlanVersionId,
                    targetBillingOptionId: seeded.targetBillingOptionId,
                    effectiveAt: clock.now()
                })
            ).rejects.toThrow();
            expect(await scope(seeded.predecessor.id)).toEqual(before);
        });
    }
);
