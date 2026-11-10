import { eq, planMigrationSubscriptions, subscriptionModel, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { cancelPendingAttempt } from '../../../src/services/billing/subscription/cancel-pending-attempt.service.js';
import { expireAuthorizationWindows } from '../../../src/services/billing/subscription/expire-authorization-windows.service.js';
import { pauseSubscription } from '../../../src/services/billing/subscription/pause-subscription.service.js';
import { replacePendingAttempt } from '../../../src/services/billing/subscription/replace-pending-attempt.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    cleanupAnnouncedExitCases,
    createAnnouncedExitCase
} from './support/plan-migration-exit-fixtures.js';
import {
    seededSubscriptionIds,
    withSeededSubscriptionSweep
} from './support/subscription-window-sweep.js';
import { noTouristVip } from './support/tourist-vip.js';

const beforeCancelNotice = { beforeCancel: async () => 'SENT' as const };
const pendingClock = { now: () => new Date('2026-10-08T20:00:00.000Z') };

afterEach(async () => {
    await cleanupAnnouncedExitCases();
    seededSubscriptionIds.clear();
    vi.restoreAllMocks();
});
afterAll(closeServiceTestPool);

async function readScope(subscriptionId: string) {
    const [row] = await getServiceTestDb()
        .select()
        .from(planMigrationSubscriptions)
        .where(eq(planMigrationSubscriptions.subscriptionId, subscriptionId));
    if (!row) throw new Error('Migration scope row missing');
    return row;
}

async function expectTerminalExit(subscriptionId: string, status: 'ABANDONED' | 'CANCELLED') {
    const [subscription] = await getServiceTestDb()
        .select({ status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    expect(subscription).toEqual({ status });
    const row = await readScope(subscriptionId);
    expect({
        status: row.status,
        outReason: row.outReason,
        appliedAt: row.appliedAt,
        updatedAt: row.updatedAt
    }).toEqual({
        status: 'FUERA',
        outReason: 'TERMINO',
        appliedAt: null,
        updatedAt: expect.any(Date)
    });
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B12:6 AC:B12:6 toda llegada a un terminal, por cualquier camino, pasa su fila de alcance PENDIENTE o PARA_RESOLVER a FUERA en la misma transacción con el motivo «terminó»',
    () => {
        it('S40 abandons a pending authorization through cancelPendingAttempt', async () => {
            const { pendingCustomer } = await createAnnouncedExitCase({ addPendingCustomer: true });
            if (!pendingCustomer) throw new Error('Pending customer missing');
            const result = await cancelPendingAttempt(
                { subscriptionId: pendingCustomer.subscriptionId, userId: pendingCustomer.userId },
                { provider: pendingCustomer.provider, clock: pendingClock, beforeCancelNotice }
            );
            expect(result.outcome).toBe('ABANDONED');
            await expectTerminalExit(pendingCustomer.subscriptionId, 'ABANDONED');
        });

        it('S3 abandons an expired pending authorization through its real sweep', async () => {
            const { pendingCustomer } = await createAnnouncedExitCase({ addPendingCustomer: true });
            if (!pendingCustomer) throw new Error('Pending customer missing');
            // Seeded deadline isolates this customer from the shared integration clock.
            await getServiceTestDb()
                .update(subscriptions)
                .set({ authorizationWindowEndsAt: new Date('2026-10-08T19:00:00.000Z') })
                .where(eq(subscriptions.id, pendingCustomer.subscriptionId));
            seededSubscriptionIds.add(pendingCustomer.subscriptionId);
            const result = await withSeededSubscriptionSweep(1, () =>
                expireAuthorizationWindows(1, {
                    provider: pendingCustomer.provider,
                    clock: pendingClock,
                    beforeCancelNotice,
                    touristVipInheritance: noTouristVip
                })
            );
            expect(result.abandoned).toBe(1);
            await expectTerminalExit(pendingCustomer.subscriptionId, 'ABANDONED');
        });

        it('S39 abandons the replaced pending attempt through its real service', async () => {
            const { pendingCustomer } = await createAnnouncedExitCase({
                addPendingCustomer: true
            });
            if (!pendingCustomer) throw new Error('Pending customer missing');
            const commitment = await subscriptionModel.findLiveCommitment({
                userId: pendingCustomer.userId,
                vertical: 'accommodation'
            });
            if (!commitment) throw new Error('Pending commitment missing');
            await replacePendingAttempt(
                { commitment, userId: pendingCustomer.userId },
                { provider: pendingCustomer.provider, clock: pendingClock, beforeCancelNotice }
            );
            await expectTerminalExit(pendingCustomer.subscriptionId, 'ABANDONED');
        });

        it('a seeded raw status update proves the trigger is independent of a service and leaves other rows intact', async () => {
            const { seeded, pendingCustomer, migrationId } = await createAnnouncedExitCase({
                addPendingCustomer: true
            });
            if (!pendingCustomer) throw new Error('Pending customer missing');
            const otherBefore = await readScope(pendingCustomer.subscriptionId);
            // Seeded direct transition deliberately probes trigger coverage beyond service writers.
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'CANCELLED' })
                .where(eq(subscriptions.id, seeded.predecessor.id));
            await expectTerminalExit(seeded.predecessor.id, 'CANCELLED');
            expect(await readScope(pendingCustomer.subscriptionId)).toEqual(otherBefore);
            const rows = await getServiceTestDb()
                .select({ id: planMigrationSubscriptions.id })
                .from(planMigrationSubscriptions)
                .where(eq(planMigrationSubscriptions.planMigrationId, migrationId));
            expect(rows.map((row) => row.id).sort()).toEqual(
                [otherBefore.id, (await readScope(seeded.predecessor.id)).id].sort()
            );
        });

        it('an unresolved cycle also exits with TERMINO', async () => {
            const { seeded } = await createAnnouncedExitCase({ unresolved: true });
            expect((await readScope(seeded.predecessor.id)).status).toBe('PARA_RESOLVER');
            // Seeded direct transition isolates the PARA_RESOLVER trigger predicate.
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'CANCELLED' })
                .where(eq(subscriptions.id, seeded.predecessor.id));
            await expectTerminalExit(seeded.predecessor.id, 'CANCELLED');
        });

        it('rolls back the terminal status and scope exit together', async () => {
            const { seeded } = await createAnnouncedExitCase();
            const beforeSubscription = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.predecessor.id));
            const beforeScope = await readScope(seeded.predecessor.id);
            const rollback = new Error('rollback terminal transition');
            try {
                await getServiceTestDb().transaction(async (tx) => {
                    // Seeded direct transition tests the database transaction boundary.
                    await tx
                        .update(subscriptions)
                        .set({ status: 'CANCELLED' })
                        .where(eq(subscriptions.id, seeded.predecessor.id));
                    const [inside] = await tx
                        .select()
                        .from(planMigrationSubscriptions)
                        .where(
                            eq(planMigrationSubscriptions.subscriptionId, seeded.predecessor.id)
                        );
                    expect(inside?.status).toBe('FUERA');
                    throw rollback;
                });
            } catch (error) {
                if (error !== rollback) throw error;
            }
            expect(
                await getServiceTestDb()
                    .select({ status: subscriptions.status })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, seeded.predecessor.id))
            ).toEqual(beforeSubscription);
            expect(await readScope(seeded.predecessor.id)).toEqual(beforeScope);
        });

        it('preserves an APLICADA row exactly when its subscription ends', async () => {
            const { seeded } = await createAnnouncedExitCase();
            // Seeded APLICADA: S37, its only real writer, belongs to HOS-1614.
            await getServiceTestDb()
                .update(planMigrationSubscriptions)
                .set({ status: 'APLICADA', appliedAt: new Date('2026-10-11T13:00:00.000Z') })
                .where(eq(planMigrationSubscriptions.subscriptionId, seeded.predecessor.id));
            const before = await readScope(seeded.predecessor.id);
            // Seeded direct transition isolates the trigger's scope predicate.
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'CANCELLED' })
                .where(eq(subscriptions.id, seeded.predecessor.id));
            expect(await readScope(seeded.predecessor.id)).toEqual(before);
        });

        it.each([
            { status: 'CANCELADA' as const, outReason: null },
            { status: 'FUERA' as const, outReason: 'CAMBIO_DE_PLAN' as const }
        ])('preserves a prior $status row exactly', async ({ status, outReason }) => {
            const { seeded } = await createAnnouncedExitCase();
            // Seeded prior scope state isolates the trigger's scope predicate.
            await getServiceTestDb()
                .update(planMigrationSubscriptions)
                .set({ status, outReason })
                .where(eq(planMigrationSubscriptions.subscriptionId, seeded.predecessor.id));
            const before = await readScope(seeded.predecessor.id);
            // Seeded direct transition is independent of service code.
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'CANCELLED' })
                .where(eq(subscriptions.id, seeded.predecessor.id));
            expect(await readScope(seeded.predecessor.id)).toEqual(before);
        });

        it('keeps PENDIENTE when S8 pauses a subscription', async () => {
            const { seeded } = await createAnnouncedExitCase();
            const before = await readScope(seeded.predecessor.id);
            const result = await pauseSubscription(
                { subscriptionId: seeded.predecessor.id, requestedMonths: 2 },
                {
                    provider: seeded.provider,
                    clock: { now: () => new Date('2026-10-11T13:00:00.000Z') },
                    planPolicy: async () => ({
                        graceDays: 10,
                        allowsPause: true,
                        current: true,
                        sellable: true
                    }),
                    complements: {
                        addonPolicy: async () => {
                            throw new Error('Unexpected addon policy');
                        },
                        listing: async () => {
                            throw new Error('Unexpected listing policy');
                        }
                    }
                }
            );
            expect(result.outcome).toBe('PAUSED');
            expect(await readScope(seeded.predecessor.id)).toEqual(before);
        });
    }
);
