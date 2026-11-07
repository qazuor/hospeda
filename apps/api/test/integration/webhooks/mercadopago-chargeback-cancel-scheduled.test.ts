/** TEST:B8a:7: a real charged-back payment ends its scheduled principal through API roots. */
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
import { FAKE_NOTICE_DELAY_MS } from '@repo/payments/fake';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { presetSelfCancelNotice } from '../billing-subscription/self-cancel-fixtures';
import {
    postDelivery,
    retireSubjects,
    signedNotice,
    signup
} from './mercadopago-delegates-fixtures';
import { startPeriodChargesFixture } from './mercadopago-period-charges-fixtures';

let fixture: Awaited<ReturnType<typeof startPeriodChargesFixture>>;

beforeAll(async () => {
    fixture = await startPeriodChargesFixture();
});
afterEach(async () => {
    vi.restoreAllMocks();
    await retireSubjects(fixture.subjects, fixture.lifterId);
});
afterAll(async () => {
    await fixture.stop();
});

async function deliver(type: 'subscription_preapproval' | 'payment', id: string, version: string) {
    const notice = signedNotice({ clock: fixture.clock, type, id, version });
    fixture.subjects.deliveries.push(notice);
    const response = await postDelivery(fixture.app, notice);
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { received: true } });
}

async function scheduledChargeback() {
    const created = await signup({
        app: fixture.app,
        billingOptionId: fixture.billingOptionId,
        subjects: fixture.subjects
    });
    await fixture.fake.approve({ authorizationId: created.authorizationId });
    fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
    await deliver('subscription_preapproval', created.authorizationId, '1');
    const charge = await fixture.fake.charge({
        authorizationId: created.authorizationId,
        amount: { amountMinor: 100000, currency: 'ARS' },
        reference: `hos1633-s12-${crypto.randomUUID()}`
    });
    fixture.clock.advance({ ms: 60 * 60 * 1000 });
    await deliver('payment', charge.chargeId, '1');
    await presetSelfCancelNotice({
        ownerId: created.userId,
        subscriptionId: created.subscriptionId,
        status: 'sent'
    });
    const response = await fixture.app.request(
        `/api/v1/protected/billing-subscription/${created.subscriptionId}/cancellation`,
        {
            method: 'POST',
            headers: {
                'user-agent': 'vitest',
                'x-mock-actor-id': created.userId,
                'x-mock-actor-role': 'USER',
                'x-mock-actor-permissions': '[]'
            }
        }
    );
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({
        success: true,
        data: { outcome: 'SCHEDULED' }
    });
    const [scheduled] = await getDb()
        .select({ status: subscriptions.status, serviceEndsAt: subscriptions.serviceEndsAt })
        .from(subscriptions)
        .where(eq(subscriptions.id, created.subscriptionId));
    expect(scheduled?.status).toBe('CANCEL_SCHEDULED');
    expect(scheduled?.serviceEndsAt).toBeInstanceOf(Date);
    expect(
        (await fixture.fake.readAuthorization({ authorizationId: created.authorizationId }))
            .snapshot.status
    ).toBe('cancelled');
    await fixture.fake.chargeBack({ chargeId: charge.chargeId });
    fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
    return { ...created, chargeId: charge.chargeId, scheduledEnd: scheduled!.serviceEndsAt! };
}

async function expectS12Settled(created: Awaited<ReturnType<typeof scheduledChargeback>>) {
    const [row] = await getDb()
        .select({ status: subscriptions.status, serviceEndsAt: subscriptions.serviceEndsAt })
        .from(subscriptions)
        .where(eq(subscriptions.id, created.subscriptionId));
    expect(row?.status).toBe('CANCELLED');
    expect(row?.serviceEndsAt).toBeInstanceOf(Date);
    expect(row!.serviceEndsAt!.getTime()).toBeLessThan(created.scheduledEnd.getTime());
    const [payment] = await getDb()
        .select({ id: payments.id })
        .from(payments)
        .where(eq(payments.providerFactId, created.chargeId));
    expect(payment).toBeDefined();
    const marks = await getDb()
        .select({ id: reconciliationMarks.id, liftedAt: reconciliationMarks.liftedAt })
        .from(reconciliationMarks)
        .where(
            and(
                eq(reconciliationMarks.subscriptionId, created.subscriptionId),
                eq(reconciliationMarks.reason, 'CONTRACARGO')
            )
        );
    expect(marks).toHaveLength(1);
    expect(marks[0]?.liftedAt).toBeNull();
    const hung = await getDb()
        .select({ paymentId: reconciliationMarkPayments.paymentId })
        .from(reconciliationMarkPayments)
        .where(eq(reconciliationMarkPayments.markId, marks[0]!.id));
    expect(hung.map((item) => item.paymentId)).toEqual([payment?.id]);
    const mails = await getDb()
        .select({ template: emailOutbox.template, payload: emailOutbox.payload })
        .from(emailOutbox)
        .where(
            and(
                eq(emailOutbox.recipientUserId, created.userId),
                eq(emailOutbox.template, 'billing.chargeback-suspension')
            )
        );
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({
        template: 'billing.chargeback-suspension',
        payload: { subscriptionId: created.subscriptionId, origin: 'CANCEL_SCHEDULED' }
    });
}

describe('TEST:B8a:7 scheduled cancellation is ended by a charged-back payment', () => {
    it('the signed payment webhook rereads the charge and runs S12', async () => {
        const created = await scheduledChargeback();
        const cancel = vi.spyOn(fixture.fake, 'cancel');
        const pause = vi.spyOn(fixture.fake, 'pause');
        const resume = vi.spyOn(fixture.fake, 'resume');

        await deliver('payment', created.chargeId, '2');

        await expectS12Settled(created);
        expect(
            cancel.mock.calls.filter(([input]) => input.authorizationId === created.authorizationId)
        ).toHaveLength(0);
        expect(
            pause.mock.calls.filter(([input]) => input.authorizationId === created.authorizationId)
        ).toHaveLength(0);
        expect(
            resume.mock.calls.filter(([input]) => input.authorizationId === created.authorizationId)
        ).toHaveLength(0);
    });

    it('the real credited-payments sweep rereads the same state and runs S12', async () => {
        const created = await scheduledChargeback();
        const cancel = vi.spyOn(fixture.fake, 'cancel');
        const pause = vi.spyOn(fixture.fake, 'pause');
        const resume = vi.spyOn(fixture.fake, 'resume');

        await fixture.runSweep();

        await expectS12Settled(created);
        expect(
            cancel.mock.calls.filter(([input]) => input.authorizationId === created.authorizationId)
        ).toHaveLength(0);
        expect(
            pause.mock.calls.filter(([input]) => input.authorizationId === created.authorizationId)
        ).toHaveLength(0);
        expect(
            resume.mock.calls.filter(([input]) => input.authorizationId === created.authorizationId)
        ).toHaveLength(0);
    });
});
