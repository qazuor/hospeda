import {
    and,
    billingDeadlineVersions,
    inArray,
    isNull,
    manualPayments,
    payments,
    reconciliationMarkPayments,
    reconciliationMarks,
    subscriptionModel,
    subscriptions,
    users
} from '@repo/db';
import type { BillingDeadlineValues } from '@repo/schemas';
import type { HangablePayment } from '../../../../src/services/billing/reconciliation/reconciliation-mark-payments.port.js';
import { getServiceTestDb, getServiceTestPool } from '../helpers.js';

/** Fixed clock shared by the mark-payment suites (TEST:B5:19, TEST:B5:20). */
export const markPaymentClock = { now: () => new Date('2026-10-10T12:00:00.000Z') };

const deadlines = {
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

/** One seeded ACTIVE subscription and its owner. */
export interface MarkPaymentFixture {
    readonly userId: string;
    readonly subscriptionId: string;
}

const seeded: MarkPaymentFixture[] = [];

/**
 * Seeds a user, plan, plan_version, billing_option and an ACTIVE subscription,
 * and tracks it for {@link retireMarkPaymentFixtures}.
 */
export async function markPaymentFixture(): Promise<MarkPaymentFixture> {
    const db = getServiceTestDb();
    const pool = getServiceTestPool();
    const [user] = await db
        .insert(users)
        .values({
            email: `mark-payment-${crypto.randomUUID()}@example.test`,
            displayName: 'Mark payment test',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    await db
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: deadlines })
        .onConflictDoNothing();
    const planId = (
        await pool.query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `mark-payment-${crypto.randomUUID()}`, 'Mark payment plan']
        )
    ).rows[0]?.id;
    const versionId = (
        await pool.query<{ id: string }>(
            "INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause) VALUES ($1, 'accommodation', $2, true, true, 0, false) RETURNING id",
            [planId, Math.floor(Math.random() * 1e8) + 1]
        )
    ).rows[0]?.id;
    const optionId = (
        await pool.query<{ id: string }>(
            "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, 'monthly', 250000, 'ARS') RETURNING id",
            [versionId]
        )
    ).rows[0]?.id;
    if (!versionId || !optionId) throw new Error('No plan anchors');
    const row = await subscriptionModel.createPendingAuthorization({
        userId: user.id,
        vertical: 'accommodation',
        planVersionId: versionId,
        billingOptionId: optionId,
        authorizationWindowDeadlineVersion: 1,
        authorizationWindowEndsAt: new Date('2027-01-01T00:00:00Z')
    });
    await pool.query("UPDATE subscription SET status='ACTIVE' WHERE id=$1", [row.subscription.id]);
    const fixture = { userId: user.id, subscriptionId: row.subscription.id };
    seeded.push(fixture);
    return fixture;
}

/** Seeds a SUCCEEDED provider payment with a unique fact id and returns it as hangable. */
export async function seedProviderPayment({
    subscriptionId
}: {
    readonly subscriptionId: string;
}): Promise<HangablePayment> {
    const [payment] = await getServiceTestDb()
        .insert(payments)
        .values({
            subscriptionId,
            amount: 250000,
            currency: 'ARS',
            status: 'SUCCEEDED',
            provider: 'mercadopago',
            providerFactId: `mark-payment-${crypto.randomUUID()}`,
            factAt: markPaymentClock.now()
        })
        .returning({ id: payments.id });
    if (!payment) throw new Error('No payment');
    return { source: 'PAYMENT', id: payment.id };
}

/** Seeds an AWAITING manual payment (no registration) and returns it as hangable. */
export async function seedManualPayment({
    subscriptionId
}: {
    readonly subscriptionId: string;
}): Promise<HangablePayment> {
    const [manual] = await getServiceTestDb()
        .insert(manualPayments)
        .values({ subscriptionId, periodStart: markPaymentClock.now(), status: 'AWAITING' })
        .returning({ id: manualPayments.id });
    if (!manual) throw new Error('No manual payment');
    return { source: 'MANUAL_PAYMENT', id: manual.id };
}

/** Reads the rows hung on one mark, oldest first. */
export async function hungRows({ markId }: { readonly markId: string }) {
    const result = await getServiceTestPool().query<{
        payment_id: string | null;
        manual_payment_id: string | null;
        hung_at: Date;
        resolved_at: Date | null;
    }>(
        'SELECT payment_id, manual_payment_id, hung_at, resolved_at FROM reconciliation_mark_payment WHERE mark_id = $1 ORDER BY hung_at, created_at',
        [markId]
    );
    return result.rows;
}

/** Marks every payment hung on one mark as resolved (as RF5 would; the writer is not this leaf). */
export async function resolveHungPayments({ markId }: { readonly markId: string }) {
    await getServiceTestPool().query(
        'UPDATE reconciliation_mark_payment SET resolved_at = $2 WHERE mark_id = $1 AND resolved_at IS NULL',
        [markId, markPaymentClock.now()]
    );
}

/**
 * Retires everything the cases seeded: resolves their hung payments, lifts their
 * open marks and cancels their subscriptions, so no global population changes.
 */
export async function retireMarkPaymentFixtures(): Promise<void> {
    const db = getServiceTestDb();
    for (const { subscriptionId, userId } of seeded.splice(0)) {
        const marks = await db
            .select({ id: reconciliationMarks.id })
            .from(reconciliationMarks)
            .where(inArray(reconciliationMarks.subscriptionId, [subscriptionId]));
        const markIds = marks.map((mark) => mark.id);
        if (markIds.length > 0)
            await db
                .update(reconciliationMarkPayments)
                .set({ resolvedAt: new Date() })
                .where(
                    and(
                        inArray(reconciliationMarkPayments.markId, markIds),
                        isNull(reconciliationMarkPayments.resolvedAt)
                    )
                );
        await db
            .update(reconciliationMarks)
            .set({ liftedAt: new Date(), liftedBy: userId })
            .where(
                and(
                    inArray(reconciliationMarks.subscriptionId, [subscriptionId]),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
        await db
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(inArray(subscriptions.id, [subscriptionId]));
    }
}
