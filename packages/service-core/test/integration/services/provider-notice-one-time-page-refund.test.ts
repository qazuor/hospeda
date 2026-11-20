/**
 * HOS-2179 §5.11 + §5.3 path 1: the `payment` notice of a refunded page charge is what runs RF3
 * for its confirmed refund, as it does on the subscription path. Without it the refund stays
 * CONFIRMED and the payment never reaches REFUNDED. Runs end to end through the receiver with
 * the fake, lies on.
 */
import { eq, payments, refunds } from '@repo/db';
import type { NoticeDelivery } from '@repo/payments';
import { FAKE_NOTICE_CHANNEL_HEADER } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { receiveProviderDelivery } from '../../../src/services/billing/notice/receive-provider-delivery.service';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { retirePurchaseFixtures } from './support/addon-purchase-fixtures';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice';
import { refundPageFixture, spendFirstPartialRefusal } from './support/refund-page-fixtures';

const skip = !isServiceTestDbAvailable();

afterEach(async () => {
    vi.restoreAllMocks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

type Setup = Awaited<ReturnType<typeof refundPageFixture>>;

/** Hands every due Webhooks delivery to the receiver, wired as the API wires it. */
async function deliverDue(s: Setup) {
    const due = s.f.fake
        .takeDeliveries()
        .deliveries.filter(
            (delivery: NoticeDelivery) =>
                delivery.headers[FAKE_NOTICE_CHANNEL_HEADER] !== 'secondary'
        );
    const answers = [];
    for (const delivery of due)
        answers.push(
            await receiveProviderDelivery(
                {
                    url: 'https://api.example.test/api/v1/webhooks/mercadopago?source_news=webhooks',
                    delivery
                },
                {
                    provider: s.f.fake,
                    clock: s.f.ports.clock,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                    coverageNotices: { emitCoverageChanged: vi.fn(async () => {}) },
                    complements: {
                        addonPolicy: s.f.ports.addonPolicy,
                        listing: s.f.ports.listing
                    }
                }
            )
        );
    return answers;
}

async function rows(s: Setup) {
    const db = getServiceTestDb();
    const [refund] = await db.select().from(refunds).where(eq(refunds.id, s.refundId));
    const [payment] = await db.select().from(payments).where(eq(payments.id, s.payment.id));
    return { refund, payment };
}

describe('HOS-2179 §5.11 the notice of a refunded page charge executes its refund', () => {
    it.skipIf(skip)('executes a confirmed total refund and refunds the payment', async () => {
        // Arrange
        const s = await refundPageFixture();
        s.f.fake.takeDeliveries();
        const confirmed = await confirmRefund(
            { actor: s.actor, refundId: s.refundId },
            { clock: s.f.ports.clock, provider: s.f.fake }
        );
        expect(confirmed).toMatchObject({ status: 'CONFIRMED', outcome: 'SENT' });
        expect((await rows(s)).refund?.status).toBe('CONFIRMED');

        // Act
        const answers = await deliverDue(s);

        // Assert
        expect(answers).toContainEqual({ ack: 'OK', outcome: 'ADDON_PAYMENT_ALREADY_CONFIRMED' });
        const after = await rows(s);
        expect(after.refund?.status).toBe('EXECUTED');
        expect(after.payment).toMatchObject({
            status: 'REFUNDED',
            refundedAmount: s.payment.amount
        });
    });

    it.skipIf(skip)(
        'executes a confirmed partial refund once, on a repeated notice too',
        async () => {
            // Arrange
            const s = await refundPageFixture({ refundAmount: 4000 });
            await spendFirstPartialRefusal({ f: s.f, chargeId: s.charge.chargeId });
            s.f.fake.takeDeliveries();
            await confirmRefund(
                { actor: s.actor, refundId: s.refundId },
                { clock: s.f.ports.clock, provider: s.f.fake }
            );
            const [notice] = s.f.fake
                .takeDeliveries()
                .deliveries.filter(
                    (delivery) => delivery.headers[FAKE_NOTICE_CHANNEL_HEADER] !== 'secondary'
                );
            if (!notice) throw new Error('notice missing');
            const ports = {
                provider: s.f.fake,
                clock: s.f.ports.clock,
                beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                coverageNotices: { emitCoverageChanged: vi.fn(async () => {}) },
                complements: { addonPolicy: s.f.ports.addonPolicy, listing: s.f.ports.listing }
            };
            const url = 'https://api.example.test/api/v1/webhooks/mercadopago?source_news=webhooks';

            // Act
            for (let i = 0; i < 2; i++)
                await receiveProviderDelivery({ url, delivery: notice }, ports);

            // Assert
            const after = await rows(s);
            expect(after.refund?.status).toBe('EXECUTED');
            expect(after.payment).toMatchObject({
                status: 'PARTIALLY_REFUNDED',
                refundedAmount: 4000
            });
        }
    );
});
