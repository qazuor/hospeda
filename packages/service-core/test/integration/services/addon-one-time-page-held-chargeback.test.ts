/**
 * HOS-2179 D1 meets HOS-2391: a page charge a mark holds (its own `payment` row hung from
 * COBRO_DUPLICADO, mark 23 or a divergence) that the payer then charges back. No `CONTRACARGO`
 * opens (one payment raises at most one mark); instead the open mark gets one event with
 * `provider.charged_back: true`, so the person sees its refund proposal is stale. The
 * credited-payments check lists the held row only to re-read it for that chargeback, and never
 * credits it. Runs with the fake, lies on.
 */
import { eq, payments, reconciliationCreditedPaymentModel } from '@repo/db';
import type { NoticeDelivery } from '@repo/payments';
import { FAKE_NOTICE_CHANNEL_HEADER } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { confirmOneTimePagePayment } from '../../../src/services/billing/addon/addon-instance-a2-one-time-page';
import { receiveProviderDelivery } from '../../../src/services/billing/notice/receive-provider-delivery.service';
import { runCreditedPaymentsCheck } from '../../../src/services/billing/reconciliation/sweep/credited-payments-check';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { purchaseNow, retirePurchaseFixtures } from './support/addon-purchase-fixtures';
import {
    boughtPage,
    changeOf,
    heldPagePayments,
    liftPageMarks,
    pageMarkEvents,
    pageMarks,
    pageSetup,
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

/** Hands every due Webhooks delivery to the receiver, wired as the API wires it. */
async function deliverDue(s: Setup) {
    const due = s.f.fake
        .takeDeliveries()
        .deliveries.filter(
            (delivery: NoticeDelivery) =>
                delivery.headers[FAKE_NOTICE_CHANNEL_HEADER] !== 'secondary'
        );
    const outcomes = [];
    for (const delivery of due)
        outcomes.push(
            (
                await receiveProviderDelivery(
                    {
                        url: 'https://api.example.test/api/v1/webhooks/mercadopago?source_news=webhooks',
                        delivery
                    },
                    {
                        provider: s.f.fake,
                        clock: s.f.ports.clock,
                        beforeCancelNotice: s.ports.beforeCancelNotice,
                        coverageNotices: s.ports.coverageNotices,
                        complements: {
                            addonPolicy: s.f.ports.addonPolicy,
                            listing: s.f.ports.listing
                        }
                    }
                )
            ).outcome
        );
    return outcomes;
}

/** Runs the credited-payments check over the given payments only. */
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

/** An activated purchase whose second payment is held by COBRO_DUPLICADO. */
async function heldDuplicate() {
    const s = await pageSetup();
    const { instance, paymentPageId } = await boughtPage(s);
    const first = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
    const second = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
    await confirmOneTimePagePayment({ instanceId: instance.id, chargeId: first.chargeId }, s.ports);
    expect(
        await confirmOneTimePagePayment(
            { instanceId: instance.id, chargeId: second.chargeId },
            s.ports
        )
    ).toEqual({ outcome: 'DUPLICATE_PAYMENT' });
    const [held] = await heldPagePayments(instance.id);
    if (!held) throw new Error('held payment missing');
    s.f.fake.takeDeliveries();
    return { s, instance, second, held };
}

/** The mark events of the instance that note a chargeback of this charge. */
async function chargebackNotes(instanceId: string, chargeId: string) {
    return (await pageMarkEvents(instanceId)).filter(
        (event) =>
            changeOf(event, 'provider.charged_back') === true &&
            changeOf(event, 'provider.charge_id') === chargeId
    );
}

describe('HOS-2179 D1 a chargeback on a charge a mark holds', () => {
    it.skipIf(skip)(
        'notes the chargeback once on the open mark and opens no CONTRACARGO',
        async () => {
            // Arrange
            const { s, instance, second, held } = await heldDuplicate();
            await s.f.fake.chargeBack({ chargeId: second.chargeId });

            // Act
            const outcomes = await deliverDue(s);
            await deliverDue(s);
            await sweepCreditedPayments(s, [held.payment.id]);

            // Assert
            expect(outcomes).toContain('ADDON_CHARGEBACK_MARKED');
            expect(await pageMarks(instance.id)).toEqual([
                { reason: 'COBRO_DUPLICADO', liftedAt: null }
            ]);
            const notes = await chargebackNotes(instance.id, second.chargeId);
            expect(notes).toHaveLength(1);
            expect(changeOf(notes[0] ?? { changes: [] }, 'reconciliation_mark.id')).toBe(
                held.markId
            );
        }
    );

    it.skipIf(skip)('leaves a lifted mark untouched', async () => {
        // Arrange
        const { s, instance, second } = await heldDuplicate();
        await liftPageMarks(instance.id, instance.ownerId);
        await s.f.fake.chargeBack({ chargeId: second.chargeId });

        // Act
        await deliverDue(s);

        // Assert
        expect(await chargebackNotes(instance.id, second.chargeId)).toHaveLength(0);
        const marks = await pageMarks(instance.id);
        expect(marks).toHaveLength(1);
        expect(marks[0]?.liftedAt).not.toBeNull();
    });

    it.skipIf(skip)(
        'is re-read by the credited-payments check and left alone when not charged back',
        async () => {
            // Arrange
            const { s, instance, held } = await heldDuplicate();
            const events = (await pageMarkEvents(instance.id)).length;

            // Act
            const summary = await sweepCreditedPayments(s, [held.payment.id]);

            // Assert
            expect(summary).toMatchObject({ examined: 1, chargebacks: 0, failures: [] });
            expect(await pageMarkEvents(instance.id)).toHaveLength(events);
            const [stored] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.id, held.payment.id));
            expect(stored).toMatchObject({ status: 'SUCCEEDED', version: held.payment.version });
        }
    );
});
