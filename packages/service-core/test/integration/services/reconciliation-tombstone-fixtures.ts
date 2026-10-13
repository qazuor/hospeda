/** Shared fixtures for the receipt tombstone of an unknown charge (HOS-1603, TEST:B11:3–5). */
import {
    and,
    coveredPeriods,
    domainEventModel,
    emailOutbox,
    eq,
    payments,
    promoRedemptions,
    providerLinks,
    receipts,
    reconciliationMarkPayments,
    reconciliationMarks,
    sql,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import {
    type HandleUnknownAuthorizationPorts,
    handleUnknownAuthorization
} from '../../../src/services/billing/reconciliation/handle-unknown-authorization.service.js';
import { getServiceTestDb } from './helpers.js';
import { reconciliationClock } from './reconciliation-sweep-fixtures.js';

/** A fake whose charges land approved at once (M8 off), isolated by its own id namespace. */
export function createChargingFake() {
    const fake = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock: reconciliationClock,
        honestAbout: [
            { lie: 'M8', why: 'the receipt tombstone of a late debit needs an approved charge' }
        ]
    });
    return { fake, provider: fake as unknown as PaymentProvider };
}

/**
 * Fabricates a debit of an authorization we do not own: a legacy reference
 * (`legacy-<uuid>`) or a UUID with no row, approved and charged once.
 */
export async function unknownCharge(
    fake: FakePaymentProvider,
    options: { readonly reference?: string; readonly cancelledAfterCharge?: boolean } = {}
) {
    const reference = options.reference ?? `legacy-${crypto.randomUUID()}`;
    const amount = { amountMinor: 250000, currency: 'ARS' } as const;
    const { authorizationId } = await fake.authorize({
        reference,
        amount,
        cadence: { everyMonths: 1 },
        reason: 'legacy debit after the cutover',
        returnUrl: 'https://example.test/return',
        payerEmail: `legacy-${crypto.randomUUID()}@example.test`
    });
    await fake.approve({ authorizationId });
    const { chargeId } = await fake.charge({ authorizationId, amount, reference });
    if (options.cancelledAfterCharge) await fake.cancel({ authorizationId });
    return { authorizationId, chargeId, reference };
}

/** Runs the handler on a charge arrival with the fixed reconciliation clock. */
export async function handleCharge(
    input: {
        readonly authorizationId: string;
        readonly chargeId: string;
        readonly correlationId?: string;
    },
    ports: Omit<HandleUnknownAuthorizationPorts, 'clock'> &
        Partial<Pick<HandleUnknownAuthorizationPorts, 'clock'>>
) {
    const correlationId = input.correlationId ?? crypto.randomUUID();
    const result = await handleUnknownAuthorization(
        {
            authorizationId: input.authorizationId,
            arrival: { kind: 'CHARGE', chargeId: input.chargeId },
            correlationId
        },
        { clock: reconciliationClock, ...ports }
    );
    return { result, correlationId };
}

/** Every row hanging from one tombstone, read by its id. */
export async function tombstoneRows(subscriptionId: string) {
    const db = getServiceTestDb();
    const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    const links = await db
        .select()
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, subscriptionId));
    const paymentRows = await db
        .select()
        .from(payments)
        .where(eq(payments.subscriptionId, subscriptionId));
    const marks = await db
        .select()
        .from(reconciliationMarks)
        .where(eq(reconciliationMarks.subscriptionId, subscriptionId));
    const hung = [];
    for (const mark of marks)
        hung.push(
            ...(await db
                .select()
                .from(reconciliationMarkPayments)
                .where(eq(reconciliationMarkPayments.markId, mark.id)))
        );
    return { subscription, links, payments: paymentRows, marks, hung };
}

/** The settlement side of one payment: receipt, credited mail, coverage. */
export async function settlementRows(input: {
    readonly paymentId: string;
    readonly subscriptionId: string;
}) {
    const db = getServiceTestDb();
    const receiptRows = await db
        .select()
        .from(receipts)
        .where(eq(receipts.paymentId, input.paymentId));
    const mails = await db
        .select()
        .from(emailOutbox)
        .where(
            and(
                eq(emailOutbox.template, 'billing.payment-credited'),
                sql`${emailOutbox.payload}->>'paymentId' = ${input.paymentId}`
            )
        );
    const coverageByPayment = await db
        .select()
        .from(coveredPeriods)
        .where(eq(coveredPeriods.paymentId, input.paymentId));
    const coverageBySubscription = await db
        .select()
        .from(coveredPeriods)
        .where(eq(coveredPeriods.subscriptionId, input.subscriptionId));
    const promos = await db
        .select()
        .from(promoRedemptions)
        .where(eq(promoRedemptions.subscriptionId, input.subscriptionId));
    return { receipts: receiptRows, mails, coverageByPayment, coverageBySubscription, promos };
}

/** The `reconciliation.mark_opened` events of one correlation id. */
export async function markOpenedEvents(correlationId: string) {
    return (await domainEventModel.findByCorrelationId({ correlationId })).filter(
        (event) => event.eventType === 'reconciliation.mark_opened'
    );
}
