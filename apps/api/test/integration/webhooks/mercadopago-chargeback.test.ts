/**
 * TEST:B7:7 AC:B7:10 the chargeback reaches S6 from the real API roots.
 *
 * The state is produced only through services and routes: a real signup, a
 * credited charge delivered as a Webhooks notice, and `fake.chargeBack` on the
 * fake provider. (a) the charge notice re-reads it, (b) the credited-payments
 * pass of the daily sweep re-reads it, and (d) the real outbox sender renders the
 * notice S6 enqueued.
 */
import {
    and,
    emailOutbox,
    eq,
    getDb,
    payments,
    reconciliationMarkPayments,
    reconciliationMarks,
    subscriptions
} from '@repo/db';
import { CHARGEBACK_SUSPENSION_SUBJECT } from '@repo/notifications';
import { FAKE_NOTICE_DELAY_MS } from '@repo/payments/fake';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildOutboxSenderRender } from '../../../src/cron/jobs/email-outbox-sender.job.js';
import {
    noticeRowsOf,
    postDelivery,
    retireSubjects,
    SIGNING_KEY,
    type SignedDelivery,
    signedNotice,
    signup
} from './mercadopago-delegates-fixtures';
import { startPeriodChargesFixture } from './mercadopago-period-charges-fixtures';

let fixture: Awaited<ReturnType<typeof startPeriodChargesFixture>>;

beforeAll(async () => {
    fixture = await startPeriodChargesFixture();
});
afterEach(async () => retireSubjects(fixture.subjects, fixture.lifterId));
afterAll(async () => {
    await fixture.stop();
});

async function deliver(delivery: SignedDelivery) {
    fixture.subjects.deliveries.push(delivery);
    const response = await postDelivery(fixture.app, delivery);
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { received: true } });
    expect((await noticeRowsOf(delivery)).map((item) => item.channel)).toEqual(['WEBHOOKS']);
}

/** The next notice the fake planned for a resource, or a fresh signed one when there is none. */
async function nextDelivery(type: 'subscription_preapproval' | 'payment', id: string) {
    const due = fixture.server
        .mercadoPagoDeliveries({ webhookSecret: SIGNING_KEY })
        .deliveries.find(
            (item) => item.query.includes(`type=${type}`) && item.query.includes(`data.id=${id}`)
        );
    if (due) return due;
    return signedNotice({ clock: fixture.clock, type, id, version: '2' });
}

/** A fresh charge notice: a new body, so the receiver stores a new delivery. */
function chargeNotice(chargeId: string, version: string) {
    return signedNotice({ clock: fixture.clock, type: 'payment', id: chargeId, version });
}

async function activeSignup() {
    const created = await signup({
        app: fixture.app,
        billingOptionId: fixture.billingOptionId,
        subjects: fixture.subjects
    });
    await fixture.fake.approve({ authorizationId: created.authorizationId });
    fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
    await deliver(await nextDelivery('subscription_preapproval', created.authorizationId));
    return created;
}

/** A charge of 100 000 cents credited through the real notice receiver. */
async function creditedCharge(created: Awaited<ReturnType<typeof activeSignup>>) {
    const charge = await fixture.fake.charge({
        authorizationId: created.authorizationId,
        amount: { amountMinor: 100000, currency: 'ARS' },
        reference: `hos1631-chargeback-${crypto.randomUUID()}`
    });
    fixture.clock.advance({ ms: 60 * 60 * 1000 });
    await deliver(await nextDelivery('payment', charge.chargeId));
    return charge;
}

async function chargebackOutbox(userId: string) {
    return getDb()
        .select()
        .from(emailOutbox)
        .where(
            and(
                eq(emailOutbox.recipientUserId, userId),
                eq(emailOutbox.template, 'billing.chargeback-suspension')
            )
        );
}

/** The three S6 effects AC:B7:10 names, filtered by this case's subscription. */
async function expectChargebackSettled(input: {
    readonly created: Awaited<ReturnType<typeof activeSignup>>;
    readonly chargeId: string;
}) {
    const { created, chargeId } = input;
    const [row] = await getDb()
        .select({ status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.id, created.subscriptionId));
    expect(row?.status).toBe('SUSPENDED');
    expect(
        (await fixture.fake.readAuthorization({ authorizationId: created.authorizationId }))
            .snapshot.status
    ).toBe('cancelled');

    const [payment] = await getDb()
        .select({ id: payments.id })
        .from(payments)
        .where(eq(payments.providerFactId, chargeId));
    expect(payment).toBeDefined();
    const marks = await getDb()
        .select({ id: reconciliationMarks.id })
        .from(reconciliationMarks)
        .where(
            and(
                eq(reconciliationMarks.subscriptionId, created.subscriptionId),
                eq(reconciliationMarks.reason, 'CONTRACARGO')
            )
        );
    expect(marks).toHaveLength(1);
    const hung = await getDb()
        .select({ paymentId: reconciliationMarkPayments.paymentId })
        .from(reconciliationMarkPayments)
        .where(eq(reconciliationMarkPayments.markId, marks[0]!.id));
    expect(hung.map((item) => item.paymentId)).toEqual([payment?.id]);

    const mails = await chargebackOutbox(created.userId);
    expect(mails).toHaveLength(1);
    expect(mails[0]?.payload).toMatchObject({
        subscriptionId: created.subscriptionId,
        chargedBackPayment: {
            amountMinor: 100000,
            currency: 'ARS',
            chargedOn: '2026-10-12'
        }
    });
}

describe('TEST:B7:7 AC:B7:10 the charged_back read reaches S6 from the provider notice', () => {
    it('(a) suspends the row, cancels the preapproval and opens the mark with the payment', async () => {
        // Arrange: a real ACTIVE subscription with a credited charge.
        const created = await activeSignup();
        const charge = await creditedCharge(created);
        await fixture.fake.chargeBack({ chargeId: charge.chargeId });
        fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });

        // Act: the charge notice opens the mark; S6 defers until the notice is sent.
        await deliver(await nextDelivery('payment', charge.chargeId));
        expect(await chargebackOutbox(created.userId)).toHaveLength(1);
        await fixture.markOutboxSent({
            userId: created.userId,
            template: 'billing.chargeback-suspension'
        });
        // The next read of the same charge retries S6, which now cancels and suspends.
        await deliver(chargeNotice(charge.chargeId, '3'));

        // Assert
        await expectChargebackSettled({ created, chargeId: charge.chargeId });
    });

    it('(d) the real outbox sender renders the notice S6 enqueued with its subject and amount', async () => {
        // Arrange
        const created = await activeSignup();
        const charge = await creditedCharge(created);
        await fixture.fake.chargeBack({ chargeId: charge.chargeId });
        fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
        await deliver(await nextDelivery('payment', charge.chargeId));
        await fixture.markOutboxSent({
            userId: created.userId,
            template: 'billing.chargeback-suspension'
        });
        await deliver(chargeNotice(charge.chargeId, '3'));
        const [row] = await chargebackOutbox(created.userId);

        // Act
        const rendered = await buildOutboxSenderRender({ siteUrl: 'https://hospeda.test' })({
            row: row!
        });

        // Assert
        expect(rendered.subject).toBe(CHARGEBACK_SUSPENSION_SUBJECT);
        const html = renderToStaticMarkup(rendered.react);
        expect(html).toContain('1.000,00');
        expect(html).toContain('12 de octubre de 2026');
    });
});

describe('TEST:B7:7 AC:B7:10 the charged_back read reaches S6 from the credited-payments sweep', () => {
    it('(b) the reconciliation sweep suspends that row and cancels its preapproval', async () => {
        // Arrange: a real ACTIVE subscription with a credited charge.
        const created = await activeSignup();
        const charge = await creditedCharge(created);
        await fixture.fake.chargeBack({ chargeId: charge.chargeId });

        // Act: the credited-payments pass reads the payment by id; S6 defers on the pending mail.
        await fixture.runSweep();
        expect(await chargebackOutbox(created.userId)).toHaveLength(1);
        await fixture.markOutboxSent({
            userId: created.userId,
            template: 'billing.chargeback-suspension'
        });
        // The next sweep re-reads the same payment and S6 completes.
        await fixture.runSweep();

        // Assert
        await expectChargebackSettled({ created, chargeId: charge.chargeId });
    });
});
