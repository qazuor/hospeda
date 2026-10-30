/**
 * Fixtures for TEST:B11:27 (AC:B11:27): a charge of the fake credited through
 * `recordChargeFact`, its chargeback, the notice that carries it, and the reads
 * a case asserts on. Everything a case seeds is retired by
 * {@link retireChargebackFixtures}, so no global population changes.
 */
import {
    and,
    coveredPeriods,
    domainEvent,
    emailOutbox,
    eq,
    inArray,
    isNull,
    payments,
    reconciliationMarkPayments,
    reconciliationMarks,
    subscriptions
} from '@repo/db';
import type { NoticeDelivery } from '@repo/payments';
import { encodeFakeNotice, FAKE_NOTICE_CHANNEL_HEADER } from '@repo/payments/fake';
import { processProviderNotice } from '../../../../src/services/billing/notice/process-provider-notice.service.js';
import { createPaymentReconciliationMarkPayments } from '../../../../src/services/billing/payment/payment-ledger.js';
import { recordChargeFact } from '../../../../src/services/billing/payment/record-charge-fact.service.js';
import type { ChargebackDetection } from '../../../../src/services/billing/reconciliation/chargeback/chargeback-detection.js';
import { getServiceTestDb } from '../helpers.js';
import { paymentFixture } from './payment-fixtures.js';

const beforeCancelNotice = { beforeCancel: async () => 'SENT' as const };
const seeded: { readonly subscriptionId: string; readonly userId: string }[] = [];
const RETIRED_FACT_AT = new Date('2000-01-01T00:00:00.000Z');

/** The payment fixture a chargeback case starts from. */
export type ChargebackFixture = Awaited<ReturnType<typeof paymentFixture>>;

/** A fresh subscription with its fake, registered for retirement. */
export async function chargebackFixture(): Promise<ChargebackFixture> {
    const fixture = await paymentFixture();
    seeded.push({ subscriptionId: fixture.started.subscriptionId, userId: fixture.user.id });
    return fixture;
}

/** An approved charge of 10 000 on the fixture's authorization, not recorded yet. */
export async function approvedCharge(fixture: ChargebackFixture): Promise<string> {
    const { chargeId } = await fixture.provider.charge({
        authorizationId: fixture.started.authorizationId,
        amount: { amountMinor: 10_000, currency: 'ARS' },
        reference: fixture.started.subscriptionId
    });
    return chargeId;
}

/** The ports a notice is processed with: the real S14 port and the fixture's notices. */
export function noticePorts(
    fixture: ChargebackFixture,
    extra: { readonly chargebacks?: ChargebackDetection } = {}
) {
    return {
        provider: fixture.provider,
        clock: fixture.clock,
        beforeCancelNotice,
        coverageNotices: fixture.coverageNotices,
        promoCharges: fixture.promoCharges,
        promoExhaustion: fixture.promoExhaustion,
        markPayments: createPaymentReconciliationMarkPayments(fixture.clock),
        ...extra
    };
}

/** Records a charge through `recordChargeFact` and returns its payment id. */
export async function recordCharge(
    fixture: ChargebackFixture,
    chargeId: string,
    extra: { readonly chargebacks?: ChargebackDetection } = {}
) {
    return recordChargeFact({ chargeId }, noticePorts(fixture, extra));
}

/** A charge notice as the fake's primary channel sends it. */
export function chargeNotice(chargeId: string, version: string): NoticeDelivery {
    const encoded = encodeFakeNotice({
        notice: { resourceKind: 'charge', resourceId: chargeId, version },
        format: 'json'
    });
    return {
        headers: {
            'content-type': encoded.contentType,
            [FAKE_NOTICE_CHANNEL_HEADER]: 'primary'
        },
        body: encoded.body
    };
}

/** Delivers one charge notice to the receiver. */
export async function deliverChargeNotice(
    fixture: ChargebackFixture,
    chargeId: string,
    extra: { readonly chargebacks?: ChargebackDetection } = {}
) {
    return processProviderNotice(
        { channel: 'WEBHOOKS', delivery: chargeNotice(chargeId, '2') },
        noticePorts(fixture, extra)
    );
}

/** The payment row the fixture's charge produced. */
export async function paymentOfCharge(chargeId: string) {
    const [row] = await getServiceTestDb()
        .select()
        .from(payments)
        .where(eq(payments.providerFactId, chargeId));
    if (!row) throw new Error(`No payment for charge ${chargeId}`);
    return row;
}

/** Every reason-17 mark of one subscription, open or lifted. */
export async function chargebackMarks(subscriptionId: string) {
    return getServiceTestDb()
        .select()
        .from(reconciliationMarks)
        .where(
            and(
                eq(reconciliationMarks.subscriptionId, subscriptionId),
                eq(reconciliationMarks.reason, 'CONTRACARGO')
            )
        );
}

/** What a chargeback must not move: the row, its coverage, its mails and its events. */
export async function untouchedState(fixture: ChargebackFixture) {
    const subscriptionId = fixture.started.subscriptionId;
    const db = getServiceTestDb();
    const [subscription] = await db
        .select({ status: subscriptions.status, serviceEndsAt: subscriptions.serviceEndsAt })
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    const coverage = await db
        .select()
        .from(coveredPeriods)
        .where(eq(coveredPeriods.subscriptionId, subscriptionId))
        .orderBy(coveredPeriods.id);
    const mails = await db
        .select({ id: emailOutbox.id })
        .from(emailOutbox)
        .where(eq(emailOutbox.recipientUserId, fixture.user.id));
    const events = await db
        .select({ eventType: domainEvent.eventType })
        .from(domainEvent)
        .where(
            and(
                eq(domainEvent.entityType, 'subscription'),
                eq(domainEvent.entityId, subscriptionId)
            )
        );
    return {
        subscription,
        coverage,
        mailCount: mails.length,
        subscriptionEvents: events.filter((e) => e.eventType.startsWith('subscription.')).length,
        markOpenedEvents: events.filter((e) => e.eventType === 'reconciliation.mark_opened').length
    };
}

/**
 * Retires what the cases seeded: resolves their hung payments, lifts their open
 * marks and cancels their subscriptions, so no global population changes.
 */
export async function retireChargebackFixtures(): Promise<void> {
    const db = getServiceTestDb();
    for (const { subscriptionId, userId } of seeded.splice(0)) {
        const marks = await db
            .select({ id: reconciliationMarks.id })
            .from(reconciliationMarks)
            .where(eq(reconciliationMarks.subscriptionId, subscriptionId));
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
                    eq(reconciliationMarks.subscriptionId, subscriptionId),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
        await db
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(eq(subscriptions.id, subscriptionId));
        // Out of every credited-payments window, so no other sweep re-reads them.
        await db
            .update(payments)
            .set({ factAt: RETIRED_FACT_AT })
            .where(eq(payments.subscriptionId, subscriptionId));
    }
}
