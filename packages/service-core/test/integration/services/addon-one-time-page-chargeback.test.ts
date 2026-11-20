/**
 * HOS-2391: a chargeback on the payment that activated a one-time page purchase opens
 * `CONTRACARGO` (MOT:17) on the instance, from the notice and from the daily sweep. The
 * instance stays ACTIVE: a person decides from the mark (owner decision, option 1). The fake
 * lies by default; only the M1 lie of `purchaseFixture` is switched off.
 */
import { reconciliationCreditedPaymentModel } from '@repo/db';
import type { NoticeDelivery } from '@repo/payments';
import { FAKE_NOTICE_CHANNEL_HEADER } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { confirmOneTimePagePayment } from '../../../src/services/billing/addon/addon-instance-a2-one-time-page';
import { receiveProviderDelivery } from '../../../src/services/billing/notice/receive-provider-delivery.service';
import { runCreditedPaymentsCheck } from '../../../src/services/billing/reconciliation/sweep/credited-payments-check';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers';
import { purchaseNow, retirePurchaseFixtures } from './support/addon-purchase-fixtures';
import {
    boughtPage,
    changeOf,
    liftPageMarks,
    pageInstance,
    pageMarkEvents,
    pageMarks,
    pagePayments,
    pageSetup,
    refusePageMarks,
    retirePageMarks
} from './support/one-time-page-fixtures';
import { orderDeadlines } from './support/paid-order-fixtures';

const DAY_MS = 86_400_000;
const skip = !isServiceTestDbAvailable();

afterEach(async () => {
    vi.restoreAllMocks();
    await retirePageMarks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

type Setup = Awaited<ReturnType<typeof pageSetup>>;

/** Hands one delivery to the receiver, wired as the API wires it. */
async function deliver(s: Setup, delivery: NoticeDelivery) {
    return receiveProviderDelivery(
        {
            url: 'https://api.example.test/api/v1/webhooks/mercadopago?source_news=webhooks',
            delivery
        },
        {
            provider: s.f.fake,
            clock: s.f.ports.clock,
            beforeCancelNotice: s.ports.beforeCancelNotice,
            coverageNotices: s.ports.coverageNotices,
            complements: { addonPolicy: s.f.ports.addonPolicy, listing: s.f.ports.listing }
        }
    );
}

/** The Webhooks deliveries the fake sent and that are due (M6 also sends each by IPN). */
function webhooksDeliveries(s: Setup): NoticeDelivery[] {
    return s.f.fake
        .takeDeliveries()
        .deliveries.filter((d) => d.headers[FAKE_NOTICE_CHANNEL_HEADER] !== 'secondary');
}

/** A page purchase activated by its approved payment, which the payer then charges back. */
async function activatedThenChargedBack() {
    const s = await pageSetup();
    const { instance, paymentPageId } = await boughtPage(s);
    const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
    const [approved] = webhooksDeliveries(s);
    if (!approved) throw new Error('approval notice missing');
    expect((await deliver(s, approved)).outcome).toBe('ADDON_PAYMENT_ACTIVATED');
    await s.f.fake.chargeBack({ chargeId: paid.chargeId });
    const [chargeback] = webhooksDeliveries(s);
    if (!chargeback) throw new Error('chargeback notice missing');
    return { s, instance, paid, chargeback };
}

/** Runs the credited-payments check over this test's payments only. */
async function sweepCreditedPayments(s: Setup, ownedPaymentIds: readonly string[]) {
    const original = reconciliationCreditedPaymentModel.listCreditedPaymentsInWindowPage.bind(
        reconciliationCreditedPaymentModel
    );
    const listing = vi
        .spyOn(reconciliationCreditedPaymentModel, 'listCreditedPaymentsInWindowPage')
        .mockImplementation(async (page) =>
            (await original({ ...page, afterPaymentId: undefined, limit: 10_000 }))
                .filter((row) => ownedPaymentIds.includes(row.id))
                .filter((row) => page.afterPaymentId === undefined || row.id > page.afterPaymentId)
                .slice(0, page.limit)
        );
    s.f.advanceTo(new Date(purchaseNow.getTime() + DAY_MS));
    try {
        return await runCreditedPaymentsCheck(
            { correlationId: crypto.randomUUID(), pageSize: 50 },
            { provider: s.f.fake, clock: s.f.ports.clock, deadlines: orderDeadlines(180) }
        );
    } finally {
        listing.mockRestore();
    }
}

describe('HOS-2391 the notice of a charged-back page payment opens CONTRACARGO', () => {
    it.skipIf(skip)('opens the mark on the instance and keeps it ACTIVE', async () => {
        const { s, instance, paid, chargeback } = await activatedThenChargedBack();

        const answer = await deliver(s, chargeback);

        expect(answer).toEqual({ ack: 'OK', outcome: 'ADDON_CHARGEBACK_MARKED' });
        expect((await pageInstance(instance.id)).status).toBe('ACTIVE');
        const held = await pagePayments(instance.id);
        expect(held.map((p) => p.providerFactId)).toEqual([paid.chargeId]);
        expect(await pageMarks(instance.id)).toEqual([{ reason: 'CONTRACARGO', liftedAt: null }]);
        const [event] = await pageMarkEvents(instance.id);
        expect(event?.actorType).toBe('provider');
        expect(changeOf(event ?? { changes: [] }, 'provider.charge_id')).toBe(paid.chargeId);
        expect(changeOf(event ?? { changes: [] }, 'payment.id')).toBe(held[0]?.id);
        expect(changeOf(event ?? { changes: [] }, 'provider.charge_amount_minor')).toBe(10000);
    });

    it.skipIf(skip)('does not open a second mark for a repeated notice', async () => {
        const { s, instance, chargeback } = await activatedThenChargedBack();

        const answers = [await deliver(s, chargeback), await deliver(s, chargeback)];

        expect(answers.map((a) => a.outcome)).toEqual([
            'ADDON_CHARGEBACK_MARKED',
            'ADDON_CHARGEBACK_MARKED'
        ]);
        expect(await pageMarks(instance.id)).toEqual([{ reason: 'CONTRACARGO', liftedAt: null }]);
        expect(await pageMarkEvents(instance.id)).toHaveLength(1);
    });

    it.skipIf(skip)('does not reopen a chargeback a person already lifted', async () => {
        const { s, instance, chargeback } = await activatedThenChargedBack();
        await deliver(s, chargeback);
        await liftPageMarks(instance.id, instance.ownerId);

        expect((await deliver(s, chargeback)).outcome).toBe('ADDON_CHARGEBACK_MARKED');

        const marks = await pageMarks(instance.id);
        expect(marks).toHaveLength(1);
        expect(marks[0]?.liftedAt).not.toBeNull();
    });

    it.skipIf(skip)(
        'acks an error, so the notice comes again, when the mark cannot open',
        async () => {
            const { s, instance, chargeback } = await activatedThenChargedBack();

            await refusePageMarks(instance.id, async () => {
                expect(await deliver(s, chargeback)).toEqual({ ack: 'ERROR', outcome: 'FAILED' });
            });
            expect(await pageMarks(instance.id)).toHaveLength(0);

            expect((await deliver(s, chargeback)).outcome).toBe('ADDON_CHARGEBACK_MARKED');
            expect(await pageMarks(instance.id)).toEqual([
                { reason: 'CONTRACARGO', liftedAt: null }
            ]);
        }
    );

    it.skipIf(skip)(
        'never activates a purchase whose only payment was charged back before any notice',
        async () => {
            // Decision (HOS-2391): the money went back to the payer before we credited it, so
            // there is nothing to reconcile. Like a refunded payment it is NOT_APPROVED: the
            // purchase keeps waiting until its window closes, and no mark opens.
            const s = await pageSetup();
            const { instance, paymentPageId } = await boughtPage(s);
            const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
            await s.f.fake.chargeBack({ chargeId: paid.chargeId });
            const notices = webhooksDeliveries(s);
            expect(notices.length).toBeGreaterThan(0);

            const outcomes = [];
            for (const notice of notices) outcomes.push((await deliver(s, notice)).outcome);

            expect(new Set(outcomes)).toEqual(new Set(['ADDON_PAYMENT_NOT_APPROVED']));
            expect((await pageInstance(instance.id)).status).toBe('PENDING_AUTHORIZATION');
            expect(await pagePayments(instance.id)).toHaveLength(0);
            expect(await pageMarks(instance.id)).toHaveLength(0);
        }
    );

    it.skipIf(skip)(
        'opens no duplicate for a second payment charged back before its notice',
        async () => {
            const s = await pageSetup();
            const { instance, paymentPageId } = await boughtPage(s);
            const first = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
            const second = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
            await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: first.chargeId },
                s.ports
            );
            await s.f.fake.chargeBack({ chargeId: second.chargeId });

            // The money of the second payment already went back: refunding it would pay twice.
            expect(
                await confirmOneTimePagePayment(
                    { instanceId: instance.id, chargeId: second.chargeId },
                    s.ports
                )
            ).toEqual({ outcome: 'NOT_APPROVED' });
            expect((await pageInstance(instance.id)).status).toBe('ACTIVE');
            expect(await pageMarks(instance.id)).toHaveLength(0);
        }
    );
});

describe('HOS-2391 the sweep finds a chargeback the notice missed', () => {
    it.skipIf(skip)('opens CONTRACARGO from the credited-payments check', async () => {
        const { s, instance, paid } = await activatedThenChargedBack();
        const held = await pagePayments(instance.id);
        const read = vi.spyOn(s.f.fake, 'readCharge');

        const summary = await sweepCreditedPayments(
            s,
            held.map((p) => p.id)
        );

        expect(read).toHaveBeenCalledWith({ chargeId: paid.chargeId });
        expect(summary).toMatchObject({ examined: 1, chargebacks: 1, failures: [] });
        expect((await pageInstance(instance.id)).status).toBe('ACTIVE');
        expect(await pageMarks(instance.id)).toEqual([{ reason: 'CONTRACARGO', liftedAt: null }]);
        const [event] = await pageMarkEvents(instance.id);
        expect(event?.actorType).toBe('job');
        expect(changeOf(event ?? { changes: [] }, 'provider.charge_id')).toBe(paid.chargeId);
    });

    it.skipIf(skip)('converges with the notice on one mark and one event', async () => {
        const { s, instance, chargeback } = await activatedThenChargedBack();
        const held = await pagePayments(instance.id);

        await sweepCreditedPayments(
            s,
            held.map((p) => p.id)
        );
        expect((await deliver(s, chargeback)).outcome).toBe('ADDON_CHARGEBACK_MARKED');
        await sweepCreditedPayments(
            s,
            held.map((p) => p.id)
        );

        expect(await pageMarks(instance.id)).toEqual([{ reason: 'CONTRACARGO', liftedAt: null }]);
        expect(await pageMarkEvents(instance.id)).toHaveLength(1);
    });

    it.skipIf(skip)('opens nothing for a page payment that was not charged back', async () => {
        const s = await pageSetup();
        const { instance, paymentPageId } = await boughtPage(s);
        const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        await confirmOneTimePagePayment(
            { instanceId: instance.id, chargeId: paid.chargeId },
            s.ports
        );
        const held = await pagePayments(instance.id);

        const summary = await sweepCreditedPayments(
            s,
            held.map((p) => p.id)
        );

        expect(summary).toMatchObject({ examined: 1, chargebacks: 0, failures: [] });
        expect(await pageMarks(instance.id)).toHaveLength(0);
    });

    it.skipIf(skip)('counts a failure when the mark cannot open and goes on', async () => {
        const { s, instance } = await activatedThenChargedBack();
        const held = await pagePayments(instance.id);

        await refusePageMarks(instance.id, async () => {
            const summary = await sweepCreditedPayments(
                s,
                held.map((p) => p.id)
            );
            expect(summary.chargebacks).toBe(1);
            expect(summary.failures).toHaveLength(1);
            expect(summary.failures[0]?.paymentId).toBe(held[0]?.id);
        });
        expect(await pageMarks(instance.id)).toHaveLength(0);
    });
});
