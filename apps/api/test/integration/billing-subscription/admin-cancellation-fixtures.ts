import {
    billingDeadlineVersions,
    coveredPeriods,
    eq,
    getDb,
    payments,
    reconciliationMarkPayments,
    reconciliationMarks,
    subscriptions
} from '@repo/db';
import type { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { createChargebackDetection } from '@repo/service-core';
import {
    actorHeaders,
    CHARGED_12_DAYS_AGO,
    decisionsOf,
    grantRole,
    NOW,
    REVOKER_PERMISSIONS,
    retireRevocationRouteRows,
    revocationWrites,
    routeClock,
    routeFake,
    seedPrincipal,
    seedUser
} from './revocation-route-fixtures';
import {
    presetSelfCancelNotice,
    retireSelfCancelRows,
    seedSelfActive,
    seedSelfState
} from './self-cancel-fixtures';

const deadlineValues = {
    '10': { cardHours: 72, manualDays: 7 },
    '11': { noticeDays: 60, contactDays: [30, 7] },
    '12': { noticeDays: 60, contactDays: [30, 7] },
    '13': { daysBefore: [5, 1] },
    '14': { daysBefore: 7 },
    '15': { hoursRemaining: 24 },
    '16': { days: 7 },
    '17': { days: 7 },
    '18': { days: 180 },
    '19': { minutes: 60 }
} satisfies BillingDeadlineValues;

/** Ensure startSubscription's version 1 deadlines exist despite other suites truncating them. */
export async function ensureBillingDeadlineVersion1(): Promise<void> {
    await getDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: deadlineValues })
        .onConflictDoNothing();
}

const chargebacks: Array<{ subscriptionId: string; ownerId: string; markId: string }> = [];

/** Seed an active card subscription with the complete S6 suspension clock and selected provider state. */
export async function seedAdminSuspendedCard(input: {
    readonly fake: FakePaymentProvider;
    readonly clock: ReturnType<typeof routeClock>;
    readonly preapproval: 'ALIVE' | 'CANCELLED';
}) {
    await ensureBillingDeadlineVersion1();
    const seeded = await seedSelfActive(input.fake, input.clock);
    if (input.preapproval === 'CANCELLED')
        await input.fake.cancel({ authorizationId: seeded.authorizationId });
    await getDb()
        .update(subscriptions)
        .set({
            status: 'SUSPENDED',
            graceStartedAt: NOW,
            graceEndsAt: new Date(NOW.getTime() + 10 * 86_400_000),
            updatedAt: NOW
        })
        .where(eq(subscriptions.id, seeded.subscriptionId));
    return seeded;
}

/** Seed a manual principal in SUSPENDED with the same clock columns S6 writes. */
export async function seedAdminSuspendedManual() {
    const ownerId = await seedUser('admin-suspended-manual');
    const subscriptionId = await seedPrincipal({
        ownerId,
        status: 'SUSPENDED',
        paymentMethod: 'MANUAL'
    });
    await getDb()
        .update(subscriptions)
        .set({
            graceStartedAt: NOW,
            graceEndsAt: new Date(NOW.getTime() + 10 * 86_400_000),
            updatedAt: NOW
        })
        .where(eq(subscriptions.id, subscriptionId));
    return { ownerId, subscriptionId };
}

/** Seed a grace-period card after ensuring the real signup's deadline config. */
export async function seedAdminGraceCard(input: {
    readonly fake: FakePaymentProvider;
    readonly clock: ReturnType<typeof routeClock>;
}) {
    await ensureBillingDeadlineVersion1();
    const seeded = await seedSelfActive(input.fake, input.clock);
    await getDb()
        .update(subscriptions)
        .set({
            status: 'GRACE_PERIOD',
            graceStartedAt: new Date(NOW.getTime() - 4 * 86_400_000),
            graceEndsAt: new Date(NOW.getTime() + 6 * 86_400_000),
            updatedAt: NOW
        })
        .where(eq(subscriptions.id, seeded.subscriptionId));
    return seeded;
}

/** Seed an active card, a 12-day-old credited covered period, and an open reason-17 mark. */
export async function seedAdminChargebackActive(input: {
    readonly fake: FakePaymentProvider;
    readonly clock: ReturnType<typeof routeClock>;
}) {
    await ensureBillingDeadlineVersion1();
    const seeded = await seedSelfActive(input.fake, input.clock);
    const { ownerId, paymentId, subscriptionId, authorizationId } = seeded;
    await getDb()
        .update(payments)
        .set({ factAt: CHARGED_12_DAYS_AGO })
        .where(eq(payments.id, paymentId));
    await getDb()
        .update(coveredPeriods)
        .set({ creditedAt: CHARGED_12_DAYS_AGO })
        .where(eq(coveredPeriods.paymentId, paymentId));
    const result = await createChargebackDetection({}).detect({
        payment: { id: paymentId, subscriptionId, status: 'SUCCEEDED' },
        actor: 'job',
        correlationId: crypto.randomUUID()
    });
    if (result.outcome !== 'MARKED' || !result.markId) throw new Error('Expected chargeback mark');
    chargebacks.push({ subscriptionId, ownerId, markId: result.markId });
    return { ownerId, subscriptionId, authorizationId, paymentId, markId: result.markId };
}

/** Retire only rows created here and by the two reused fixture modules. */
export async function retireAdminCancellationRows(): Promise<void> {
    const db = getDb();
    for (const item of chargebacks.splice(0)) {
        await db
            .update(reconciliationMarkPayments)
            .set({ resolvedAt: NOW })
            .where(eq(reconciliationMarkPayments.markId, item.markId));
        await db
            .update(reconciliationMarks)
            .set({ liftedAt: NOW, liftedBy: item.ownerId })
            .where(eq(reconciliationMarks.id, item.markId));
        await db
            .update(payments)
            .set({ factAt: new Date('2000-01-01T00:00:00.000Z') })
            .where(eq(payments.subscriptionId, item.subscriptionId));
    }
    await retireRevocationRouteRows();
    await retireSelfCancelRows();
}

export {
    actorHeaders,
    CHARGED_12_DAYS_AGO,
    decisionsOf,
    grantRole,
    NOW,
    presetSelfCancelNotice,
    REVOKER_PERMISSIONS,
    revocationWrites,
    routeClock,
    routeFake,
    seedSelfActive,
    seedSelfState
};
