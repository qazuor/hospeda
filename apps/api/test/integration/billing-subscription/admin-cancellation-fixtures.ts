import {
    billingOptions,
    buildEmailDedupKey,
    buildEventOccurrence,
    coveredPeriods,
    emailOutbox,
    emailOutboxModel,
    eq,
    getDb,
    payments,
    plans,
    planVersions,
    reconciliationMarkPayments,
    reconciliationMarks,
    subscriptionModel,
    subscriptions
} from '@repo/db';
import type { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import {
    BEFORE_CANCEL_TEMPLATE_BY_KIND,
    createChargebackDetection,
    createPaymentReconciliationMarkPayments,
    startSubscription
} from '@repo/service-core';
import { ensureBillingDeadlineVersion1 } from '../helpers/billing-deadline-version.js';
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
    seedSelfComplement,
    seedSelfState
} from './self-cancel-fixtures';

const chargebacks: Array<{
    subscriptionId: string;
    ownerId: string;
    paymentId: string;
    markId: string;
}> = [];

/** Preset the S23/S24 direct-cancellation notice as sent so the provider call can proceed. */
export async function presetAdminDirectCancelNotice(input: {
    readonly ownerId: string;
    readonly subscriptionId: string;
}): Promise<void> {
    const template = BEFORE_CANCEL_TEMPLATE_BY_KIND.DIRECT_CANCELLATION;
    const dedupKey = buildEmailDedupKey({
        recipient: input.ownerId,
        template,
        occurrence: buildEventOccurrence({ eventId: input.subscriptionId })
    });
    await emailOutboxModel.enqueue({
        recipientUserId: input.ownerId,
        recipientEmail: `admin-direct-cancel-${crypto.randomUUID()}@example.test`,
        template,
        payload: { subscriptionId: input.subscriptionId },
        dedupKey
    });
    await getDb()
        .update(emailOutbox)
        .set({ status: 'sent' })
        .where(eq(emailOutbox.dedupKey, dedupKey));
}

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
    const db = getDb();
    const ownerId = await seedUser('admin-chargeback');
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: VerticalEnum.ACCOMMODATION,
            slug: `admin-chargeback-${crypto.randomUUID()}`,
            name: 'Admin chargeback fixture'
        })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Expected plan');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: VerticalEnum.ACCOMMODATION,
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: false,
            current: false,
            trialDays: 0,
            allowsPause: false
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('Expected plan version');
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 10000, currency: 'ARS' })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('Expected billing option');
    const started = await startSubscription(
        { userId: ownerId, billingOptionId: option.id, returnUrl: 'https://example.test' },
        {
            provider: input.fake,
            clock: input.clock,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' },
            touristVipInheritance: { inherits: async () => false },
            planPolicy: async () => ({
                graceDays: 10,
                allowsPause: false,
                current: true,
                sellable: true
            })
        }
    );
    const { subscriptionId, authorizationId } = started;
    await input.fake.approve({ authorizationId });
    await subscriptionModel.activatePendingAuthorization({
        subscriptionId,
        now: input.clock.now()
    });
    input.fake.takeDeliveries();
    const [payment] = await db
        .insert(payments)
        .values({
            subscriptionId,
            amount: 10000,
            currency: 'ARS',
            status: 'SUCCEEDED',
            provider: 'FAKE',
            providerFactId: `admin-chargeback-${crypto.randomUUID()}`,
            factAt: CHARGED_12_DAYS_AGO
        })
        .returning({ id: payments.id });
    if (!payment) throw new Error('Expected credited payment');
    const paymentId = payment.id;
    await db.insert(coveredPeriods).values({
        subscriptionId,
        paymentId,
        periodStart: new Date('2026-09-08T12:00:00.000Z'),
        creditedAt: CHARGED_12_DAYS_AGO
    });
    const result = await createChargebackDetection({
        markPayments: createPaymentReconciliationMarkPayments(input.clock)
    }).detect({
        payment: { id: paymentId, subscriptionId, status: 'SUCCEEDED' },
        actor: 'job',
        correlationId: crypto.randomUUID()
    });
    if (result.outcome !== 'MARKED' || !result.markId) throw new Error('Expected chargeback mark');
    chargebacks.push({ subscriptionId, ownerId, paymentId, markId: result.markId });
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
            .where(eq(payments.id, item.paymentId));
        await db
            .update(subscriptions)
            .set({
                status: 'CANCELLED',
                graceStartedAt: null,
                graceEndsAt: null,
                updatedAt: NOW
            })
            .where(eq(subscriptions.id, item.subscriptionId));
    }
    await retireSelfCancelRows();
    await retireRevocationRouteRows();
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
    seedSelfComplement,
    seedSelfState
};
