/**
 * HOS-2179 D3 (owner, 2026-11-20; spec P-3): when the refund of a late page charge that a mark 23
 * holds executes, the buyer (the add-on instance's owner) gets exactly one mail through the
 * outbox. A repeated notice or a re-run settlement never adds a second row, the refund of a
 * DIVERGENCIA_DE_MONTO or COBRO_DUPLICADO charge mails nothing, and a failed refund mails nothing.
 * Runs end to end with the fake, lies on.
 */
import { and, emailOutbox, eq, refunds, users } from '@repo/db';
import type { NoticeDelivery, PaymentProvider, RefundInput } from '@repo/payments';
import { PaymentProviderError } from '@repo/payments';
import { FAKE_NOTICE_CHANNEL_HEADER } from '@repo/payments/fake';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { confirmOneTimePagePayment } from '../../../src/services/billing/addon/addon-instance-a2-one-time-page';
import { abandonOneTimeAddon } from '../../../src/services/billing/addon/expire-addon-authorization-windows-one-time';
import { receiveProviderDelivery } from '../../../src/services/billing/notice/receive-provider-delivery.service';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service';
import { executeRefundFromProviderRead } from '../../../src/services/billing/refund/execute-refund.service';
import {
    enqueueLatePaymentRefundNotice,
    LATE_PAYMENT_REFUNDED_TEMPLATE
} from '../../../src/services/billing/refund/late-payment-refund-notice';
import { settleExternalRefund } from '../../../src/services/billing/refund/settle-external-refund.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { purchaseNow, retirePurchaseFixtures } from './support/addon-purchase-fixtures';
import {
    boughtPage,
    heldPagePayments,
    pagePriceIs,
    pageSetup,
    proposedRefund,
    retirePageMarks
} from './support/one-time-page-fixtures';
import { seedAdminActor } from './support/refund-fixtures';

const skip = !isServiceTestDbAvailable();

afterEach(async () => {
    vi.restoreAllMocks();
    await retirePageMarks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

type Setup = Awaited<ReturnType<typeof pageSetup>>;
type Instance = Awaited<ReturnType<typeof boughtPage>>['instance'];

/** Hands the given Webhooks deliveries to the receiver, wired as the API wires it. */
async function deliver(s: Setup, deliveries: readonly NoticeDelivery[]) {
    const answers = [];
    for (const delivery of deliveries)
        answers.push(
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
                    complements: { addonPolicy: s.f.ports.addonPolicy, listing: s.f.ports.listing }
                }
            )
        );
    return answers;
}

/** The due primary-channel deliveries, taken from the fake. */
function takeDue(s: Setup): readonly NoticeDelivery[] {
    return s.f.fake
        .takeDeliveries()
        .deliveries.filter(
            (delivery: NoticeDelivery) =>
                delivery.headers[FAKE_NOTICE_CHANNEL_HEADER] !== 'secondary'
        );
}

/** The provider with its `refund` replaced, everything else untouched. */
function withRefund(
    provider: PaymentProvider,
    refund: (input: RefundInput) => ReturnType<PaymentProvider['refund']>
): PaymentProvider {
    return new Proxy(provider, {
        get(target, property, receiver) {
            if (property === 'refund') return refund;
            return Reflect.get(target, property, receiver);
        }
    });
}

/** The single held payment of the instance, with its mark reason. */
async function onlyHeld(instanceId: string) {
    const held = await heldPagePayments(instanceId);
    expect(held).toHaveLength(1);
    const [row] = held;
    if (!row) throw new Error('held payment missing');
    return row;
}

/**
 * A person refunds the held charge from its mark (RF1 + RF2) and the provider's notice runs RF3.
 * Returns the notice deliveries so a test can hand them over again.
 */
async function refundFromMark(
    s: Setup,
    paymentId: string,
    amount: number,
    provider: PaymentProvider = s.f.fake
) {
    // The mark proposed it when it held the charge; a person only confirms it.
    const proposed = await proposedRefund(paymentId);
    expect(proposed).toMatchObject({ status: 'REQUESTED', amount });
    const refundId = proposed.id;
    s.f.fake.takeDeliveries();
    const person = await seedAdminActor([PermissionEnum.BILLING_REFUND]);
    const confirmed = await confirmRefund(
        { actor: person, refundId },
        { clock: s.f.ports.clock, provider }
    );
    const deliveries = takeDue(s);
    await deliver(s, deliveries);
    const [refund] = await getServiceTestDb()
        .select()
        .from(refunds)
        .where(eq(refunds.id, refundId));
    return { refundId, refund, confirmed, deliveries };
}

/** Every late payment refunded row addressed to the instance's owner. */
async function lateRefundMails(instance: Instance) {
    return getServiceTestDb()
        .select()
        .from(emailOutbox)
        .where(
            and(
                eq(emailOutbox.template, LATE_PAYMENT_REFUNDED_TEMPLATE),
                eq(emailOutbox.recipientUserId, instance.ownerId)
            )
        );
}

async function ownerEmail(instance: Instance): Promise<string> {
    const [owner] = await getServiceTestDb()
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, instance.ownerId));
    if (!owner?.email) throw new Error('owner email missing');
    return owner.email;
}

/** A purchase abandoned with an approved payment on its page, held by mark 23 from its notice. */
async function lateHeldPayment() {
    const s = await pageSetup();
    const { instance, paymentPageId } = await boughtPage(s);
    const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
    await abandonOneTimeAddon(
        {
            instanceId: instance.id,
            expectedProviderOrderId: null,
            now: s.f.ports.clock.now()
        },
        { billingFacts: undefined }
    );
    expect(await deliver(s, takeDue(s))).toContainEqual({
        ack: 'OK',
        outcome: 'ADDON_LATE_PAYMENT_MARKED'
    });
    const held = await onlyHeld(instance.id);
    expect(held.reason).toBe('ORDEN_PAGADA_SIN_INSTANCIA');
    return { s, instance, paid, held };
}

describe('HOS-2179 D3 the buyer is mailed when a late payment is refunded', () => {
    it.skipIf(skip)(
        'writes exactly one outbox row to the account email when the mark 23 refund executes',
        async () => {
            // Arrange
            const { s, instance, held } = await lateHeldPayment();
            expect(await lateRefundMails(instance)).toHaveLength(0);

            // Act
            const { refundId, refund } = await refundFromMark(s, held.payment.id, 10000);

            // Assert
            expect(refund?.status).toBe('EXECUTED');
            const mails = await lateRefundMails(instance);
            expect(mails).toHaveLength(1);
            expect(mails[0]).toMatchObject({
                recipientEmail: await ownerEmail(instance),
                status: 'pending'
            });
            expect(mails[0]?.payload).toMatchObject({
                refundId,
                paymentId: held.payment.id,
                addonInstanceId: instance.id,
                locale: 'es',
                amountMinor: 10000,
                currency: held.payment.currency
            });
            expect(mails[0]?.dedupKey).toContain(refundId);
        }
    );

    it.skipIf(skip)(
        'writes no second row on a repeated notice, a re-read, or a second enqueue',
        async () => {
            // Arrange
            const { s, instance, held } = await lateHeldPayment();
            const { refundId, deliveries } = await refundFromMark(s, held.payment.id, 10000);
            expect(deliveries.length).toBeGreaterThan(0);

            // Act
            await deliver(s, deliveries);
            const reread = await executeRefundFromProviderRead(
                { refundId },
                { provider: s.f.fake, clock: s.f.ports.clock }
            );
            const again = await getServiceTestDb().transaction((tx) =>
                enqueueLatePaymentRefundNotice({ tx, refundId, paymentId: held.payment.id })
            );

            // Assert
            expect(reread.outcome).toBe('NOT_CONFIRMED');
            expect(again).toEqual({ outcome: 'ALREADY_ENQUEUED' });
            expect(await lateRefundMails(instance)).toHaveLength(1);
        }
    );

    it.skipIf(skip)('mails once when admin action 14 settles the late payment', async () => {
        // Arrange
        const { s, instance, held } = await lateHeldPayment();
        const admin = await seedAdminActor([PermissionEnum.BILLING_SETTLE_EXTERNAL]);

        // Act
        const settled = await settleExternalRefund(
            {
                actor: admin,
                source: { kind: 'PAYMENT', id: held.payment.id },
                amount: held.payment.amount,
                channel: 'BANK_TRANSFER',
                reference: `d3-${crypto.randomUUID()}`,
                reason: 'OUT_OF_FLOW_REFUND'
            },
            { clock: s.f.ports.clock }
        );

        // Assert
        const mails = await lateRefundMails(instance);
        expect(mails).toHaveLength(1);
        expect(mails[0]?.payload).toMatchObject({
            refundId: settled.refundId,
            amountMinor: held.payment.amount
        });
    });

    it.skipIf(skip)('mails nothing when the refund fails at the provider', async () => {
        // Arrange
        const { s, instance, held } = await lateHeldPayment();
        const rejecting = withRefund(s.f.fake, async () => {
            throw new PaymentProviderError({
                code: 'REJECTED',
                capability: 'refund',
                message: 'Mercado Pago refund failed (401)',
                cause: { status: 401, body: { message: 'Unauthorized use of live credentials' } }
            });
        });

        // Act
        const { refund, confirmed } = await refundFromMark(s, held.payment.id, 10000, rejecting);

        // Assert
        expect(confirmed).toMatchObject({ status: 'FAILED', outcome: 'PROVIDER_REJECTED_FAILED' });
        expect(refund?.status).toBe('FAILED');
        expect(await lateRefundMails(instance)).toHaveLength(0);
    });
});

describe('HOS-2179 D3 other page-charge marks never send the late payment mail', () => {
    it.skipIf(skip)('DIVERGENCIA_DE_MONTO: the refund executes and mails nothing', async () => {
        // Arrange
        const s = await pageSetup();
        const { instance, paymentPageId } = await boughtPage(s);
        const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        await pagePriceIs(instance.productId, 12000);
        expect(
            await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: paid.chargeId },
                s.ports
            )
        ).toEqual({ outcome: 'AMOUNT_MISMATCH' });
        const held = await onlyHeld(instance.id);
        expect(held.reason).toBe('DIVERGENCIA_DE_MONTO');

        // Act
        const { refund } = await refundFromMark(s, held.payment.id, 10000);

        // Assert
        expect(refund?.status).toBe('EXECUTED');
        expect(await lateRefundMails(instance)).toHaveLength(0);
    });

    it.skipIf(skip)('COBRO_DUPLICADO: the refund executes and mails nothing', async () => {
        // Arrange
        const s = await pageSetup();
        const { instance, paymentPageId } = await boughtPage(s);
        const first = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        const later = new Date(purchaseNow.getTime() + 20 * 60_000);
        s.f.advanceTo(later);
        const second = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        s.f.advanceTo(purchaseNow);
        await confirmOneTimePagePayment(
            { instanceId: instance.id, chargeId: first.chargeId },
            s.ports
        );
        s.f.advanceTo(later);
        expect(
            await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: second.chargeId },
                s.ports
            )
        ).toEqual({ outcome: 'DUPLICATE_PAYMENT' });
        const held = await onlyHeld(instance.id);
        expect(held.reason).toBe('COBRO_DUPLICADO');

        // Act
        const { refund } = await refundFromMark(s, held.payment.id, 10000);

        // Assert
        expect(refund?.status).toBe('EXECUTED');
        expect(await lateRefundMails(instance)).toHaveLength(0);
    });
});
