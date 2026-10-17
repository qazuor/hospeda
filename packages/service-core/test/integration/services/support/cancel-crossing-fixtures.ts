import {
    and,
    domainEvent,
    emailOutbox,
    eq,
    inArray,
    isNull,
    payments,
    reconciliationMarkPayments,
    reconciliationMarks,
    refunds,
    subscriptions
} from '@repo/db';
import type { FakePaymentProvider } from '@repo/payments/fake';
import { createPaymentReconciliationMarkPayments } from '../../../../src/services/billing/payment/payment-ledger.js';
import { recordChargeFact } from '../../../../src/services/billing/payment/record-charge-fact.service.js';
import { getServiceTestDb } from '../helpers.js';
import { retireCancelActiveRows, seedCancelActive } from './cancel-active-fixtures.js';
import { retireCancelDirectRows, seedDirectCancellation } from './cancel-direct-fixtures.js';
import { outboxBeforeCancelNotice } from './outbox-before-cancel-notice.js';

/** Mutable test clock shared by the fake provider and service ports. */
export function crossingClock(initial = new Date('2026-10-01T12:00:00.000Z')) {
    let now = initial;
    return {
        clock: { now: () => now },
        setNow: (next: Date) => {
            now = next;
        }
    };
}

const owned: { subscriptionId: string; userId: string }[] = [];
export async function seedCrossingActive(input: Parameters<typeof seedCancelActive>[0]) {
    const row = await seedCancelActive(input);
    owned.push({ subscriptionId: row.subscriptionId, userId: row.userId });
    return row;
}
export async function seedCrossingDirect(input: Parameters<typeof seedDirectCancellation>[0]) {
    const row = await seedDirectCancellation(input);
    owned.push({ subscriptionId: row.subscriptionId, userId: row.userId });
    return row;
}

/** Creates a fake charge at the supplied fact instant. */
export async function chargeOn(input: {
    fake: FakePaymentProvider;
    authorizationId: string;
    amountMinor?: number;
    at: Date;
    setNow: (date: Date) => void;
    reference: string;
}) {
    input.setNow(input.at);
    return input.fake.charge({
        authorizationId: input.authorizationId,
        amount: { amountMinor: input.amountMinor ?? 10000, currency: 'ARS' },
        reference: input.reference
    });
}

/** Records a fake charge with real reconciliation hanging and the cancellation notice seam. */
export async function recordOn(input: {
    fake: FakePaymentProvider;
    chargeId: string;
    clock: { now: () => Date };
    coverage?: (event: unknown) => Promise<void>;
}) {
    return recordChargeFact(
        { chargeId: input.chargeId },
        {
            provider: input.fake,
            clock: input.clock,
            markPayments: createPaymentReconciliationMarkPayments(input.clock),
            beforeCancelNotice: outboxBeforeCancelNotice(),
            coverageNotices: { emitCoverageChanged: input.coverage ?? (async () => undefined) }
        }
    );
}
export function marksOf(subscriptionId: string) {
    return getServiceTestDb()
        .select()
        .from(reconciliationMarks)
        .where(eq(reconciliationMarks.subscriptionId, subscriptionId));
}
export function hungPaymentsOf(markId: string) {
    return getServiceTestDb()
        .select()
        .from(reconciliationMarkPayments)
        .where(eq(reconciliationMarkPayments.markId, markId));
}
export function markOpenedEvents(subscriptionId: string) {
    return getServiceTestDb()
        .select()
        .from(domainEvent)
        .where(
            and(
                eq(domainEvent.entityType, 'subscription'),
                eq(domainEvent.entityId, subscriptionId),
                eq(domainEvent.eventType, 'reconciliation.mark_opened')
            )
        );
}
export async function refundsOfPayment(paymentId: string) {
    return getServiceTestDb().select().from(refunds).where(eq(refunds.paymentId, paymentId));
}
export async function retireCancelCrossingRows() {
    const rows = owned.splice(0);
    const ids = rows.map((row) => row.subscriptionId);
    if (ids.length) {
        const marks = await getServiceTestDb()
            .select({ id: reconciliationMarks.id })
            .from(reconciliationMarks)
            .where(inArray(reconciliationMarks.subscriptionId, ids));
        const markIds = marks.map((row) => row.id);
        if (markIds.length)
            await getServiceTestDb()
                .delete(reconciliationMarkPayments)
                .where(inArray(reconciliationMarkPayments.markId, markIds));
        await getServiceTestDb()
            .delete(reconciliationMarks)
            .where(inArray(reconciliationMarks.subscriptionId, ids));
        await getServiceTestDb()
            .delete(emailOutbox)
            .where(
                inArray(
                    emailOutbox.recipientUserId,
                    rows.map((row) => row.userId)
                )
            );
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED', serviceEndsAt: new Date('2000-01-01T00:00:00Z') })
            .where(inArray(subscriptions.id, ids));
    }
    await retireCancelDirectRows();
    await retireCancelActiveRows();
}

export async function paymentsForSubscription(subscriptionId: string) {
    return getServiceTestDb()
        .select()
        .from(payments)
        .where(eq(payments.subscriptionId, subscriptionId));
}
export async function openMarksOf(subscriptionId: string) {
    return getServiceTestDb()
        .select()
        .from(reconciliationMarks)
        .where(
            and(
                eq(reconciliationMarks.subscriptionId, subscriptionId),
                isNull(reconciliationMarks.liftedAt)
            )
        );
}
