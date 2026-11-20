/**
 * HOS-2179 D1 (owner, 2026-11-20): a page charge that only a reconciliation mark holds
 * (DIVERGENCIA_DE_MONTO, COBRO_DUPLICADO, mark 23) gets its own `payment` row hung from the mark,
 * so it is refunded through the ordinary path: RF1 + RF2 by a person, RF3 on the notice, and the
 * mark's payment resolved by the settlement. Also the three safeguards: a correct payment still
 * activates, the revocation refunds the payment that activated, and the held row is never credited.
 * Runs end to end with the fake, lies on.
 */
import {
    addonInstances,
    coveredPeriods,
    eq,
    payments,
    receipts,
    reconciliationMarks,
    refunds
} from '@repo/db';
import type { NoticeDelivery } from '@repo/payments';
import { FAKE_NOTICE_CHANNEL_HEADER } from '@repo/payments/fake';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { confirmOneTimePagePayment } from '../../../src/services/billing/addon/addon-instance-a2-one-time-page';
import { abandonOneTimeAddon } from '../../../src/services/billing/addon/expire-addon-authorization-windows-one-time';
import { receiveProviderDelivery } from '../../../src/services/billing/notice/receive-provider-delivery.service';
import { liftReconciliationMark } from '../../../src/services/billing/reconciliation/lift-reconciliation-mark.service';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service';
import { requestRefund } from '../../../src/services/billing/refund/request-refund.service';
import { settleExternalRefund } from '../../../src/services/billing/refund/settle-external-refund.service';
import { requestOneTimeAddonRefunds } from '../../../src/services/billing/subscription/revocation-addon-refunds';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { purchaseNow, retirePurchaseFixtures } from './support/addon-purchase-fixtures';
import {
    activationPagePayments,
    boughtPage,
    heldPagePayments,
    pageInstance,
    pageMarks,
    pagePriceIs,
    pageSetup,
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
                    beforeCancelNotice: s.ports.beforeCancelNotice,
                    coverageNotices: s.ports.coverageNotices,
                    complements: { addonPolicy: s.f.ports.addonPolicy, listing: s.f.ports.listing }
                }
            )
        );
    return answers;
}

/** The single payment row a mark holds on the instance, with its attachment. */
async function onlyHeld(instanceId: string) {
    const held = await heldPagePayments(instanceId);
    expect(held).toHaveLength(1);
    const [row] = held;
    if (!row) throw new Error('held payment missing');
    return row;
}

/**
 * A person refunds the whole held charge from its mark: RF1 with the mark's proposal, RF2 sent to
 * the provider, then the provider's notice runs RF3.
 */
async function refundFromMark(s: Setup, paymentId: string, amount: number) {
    const { refundId } = await requestRefund(
        { source: { kind: 'PAYMENT', id: paymentId }, amount, reason: 'MARK_PROPOSAL' },
        { clock: s.f.ports.clock }
    );
    s.f.fake.takeDeliveries();
    const person = await seedAdminActor([PermissionEnum.BILLING_REFUND]);
    const confirmed = await confirmRefund(
        { actor: person, refundId },
        { clock: s.f.ports.clock, provider: s.f.fake }
    );
    expect(confirmed).toMatchObject({ status: 'CONFIRMED', outcome: 'SENT' });
    await deliverDue(s);
    const [refund] = await getServiceTestDb()
        .select()
        .from(refunds)
        .where(eq(refunds.id, refundId));
    return { refundId, refund };
}

/** Asserts the full settlement of a held charge and that its mark can then be lifted. */
async function expectSettledAndLiftable(
    s: Setup,
    instance: { readonly id: string; readonly ownerId: string },
    refundId: string
) {
    const instanceId = instance.id;
    const held = await onlyHeld(instanceId);
    expect(held.payment).toMatchObject({ status: 'REFUNDED', refundedAmount: held.payment.amount });
    expect(held.resolvedAt).not.toBeNull();
    expect(held.refundId).toBe(refundId);
    const [mark] = await getServiceTestDb()
        .select()
        .from(reconciliationMarks)
        .where(eq(reconciliationMarks.id, held.markId));
    if (!mark) throw new Error('mark missing');
    // S15 refuses a mark with an unresolved payment: the settlement is what lets it go.
    await liftReconciliationMark(
        { markId: mark.id, expectedVersion: mark.version, liftedBy: instance.ownerId },
        { clock: s.f.ports.clock }
    );
    expect((await pageMarks(instanceId)).every((row) => row.liftedAt !== null)).toBe(true);
}

/** A purchase activated by its first approved payment, plus a second approved payment marked. */
async function activatedWithDuplicate() {
    const s = await pageSetup();
    const { instance, paymentPageId } = await boughtPage(s);
    const first = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
    // The duplicate is 20 minutes newer than the activation, so "the latest payment" would pick
    // it. Both are paid before the activation closes the page.
    const later = new Date(purchaseNow.getTime() + 20 * 60_000);
    s.f.advanceTo(later);
    const second = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
    s.f.advanceTo(purchaseNow);
    expect(
        await confirmOneTimePagePayment(
            { instanceId: instance.id, chargeId: first.chargeId },
            s.ports
        )
    ).toMatchObject({ outcome: 'ACTIVATED' });
    s.f.advanceTo(later);
    expect(
        await confirmOneTimePagePayment(
            { instanceId: instance.id, chargeId: second.chargeId },
            s.ports
        )
    ).toEqual({ outcome: 'DUPLICATE_PAYMENT' });
    return { s, instance, first, second };
}

/** A purchase abandoned with approved payments on its page it never saw. */
async function paidAfterAbandon(input: { readonly twice?: boolean } = {}) {
    const s = await pageSetup();
    const { instance, paymentPageId } = await boughtPage(s);
    const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
    const again = input.twice ? s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' }) : null;
    await abandonOneTimeAddon({
        instanceId: instance.id,
        expectedProviderOrderId: null,
        now: s.f.ports.clock.now()
    });
    return { s, instance, paid, again };
}

describe('HOS-2179 D1 a charge only a mark holds is refunded through the ordinary path', () => {
    it.skipIf(skip)(
        'DIVERGENCIA_DE_MONTO: holds the charge, a person refunds it, the notice settles it',
        async () => {
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
            expect(held).toMatchObject({ reason: 'DIVERGENCIA_DE_MONTO', resolvedAt: null });
            expect(held.payment).toMatchObject({
                providerFactId: paid.chargeId,
                amount: 10000,
                status: 'SUCCEEDED',
                subscriptionId: null
            });

            // Act
            const { refundId, refund } = await refundFromMark(s, held.payment.id, 10000);

            // Assert
            expect(refund?.status).toBe('EXECUTED');
            await expectSettledAndLiftable(s, instance, refundId);
            expect((await pageInstance(instance.id)).status).toBe('PENDING_AUTHORIZATION');
        }
    );

    it.skipIf(skip)(
        'COBRO_DUPLICADO: refunds the duplicate and leaves the activating payment alone',
        async () => {
            // Arrange
            const { s, instance, first, second } = await activatedWithDuplicate();
            const held = await onlyHeld(instance.id);
            expect(held).toMatchObject({ reason: 'COBRO_DUPLICADO', resolvedAt: null });
            expect(held.payment.providerFactId).toBe(second.chargeId);

            // Act
            const { refundId, refund } = await refundFromMark(s, held.payment.id, 10000);

            // Assert
            expect(refund?.status).toBe('EXECUTED');
            await expectSettledAndLiftable(s, instance, refundId);
            const [activation] = await activationPagePayments(instance.id);
            expect(activation).toMatchObject({
                providerFactId: first.chargeId,
                status: 'SUCCEEDED',
                refundedAmount: 0
            });
            expect((await pageInstance(instance.id)).status).toBe('ACTIVE');
        }
    );

    it.skipIf(skip)(
        'mark 23: holds a payment on an abandoned purchase opened by its notice and refunds it',
        async () => {
            // Arrange
            const { s, instance, paid } = await paidAfterAbandon();
            const answers = await deliverDue(s);
            expect(answers).toContainEqual({ ack: 'OK', outcome: 'ADDON_LATE_PAYMENT_MARKED' });
            const held = await onlyHeld(instance.id);
            expect(held).toMatchObject({ reason: 'ORDEN_PAGADA_SIN_INSTANCIA', resolvedAt: null });
            expect(held.payment.providerFactId).toBe(paid.chargeId);

            // Act
            const { refundId, refund } = await refundFromMark(s, held.payment.id, 10000);

            // Assert
            expect(refund?.status).toBe('EXECUTED');
            await expectSettledAndLiftable(s, instance, refundId);
            expect((await pageInstance(instance.id)).status).toBe('ABANDONED');
        }
    );

    it.skipIf(skip)('admin action 14 settles a held charge refunded outside the flow', async () => {
        // Arrange
        const { s, instance } = await paidAfterAbandon();
        await deliverDue(s);
        const held = await onlyHeld(instance.id);
        const admin = await seedAdminActor([PermissionEnum.BILLING_SETTLE_EXTERNAL]);

        // Act
        const settled = await settleExternalRefund(
            {
                actor: admin,
                source: { kind: 'PAYMENT', id: held.payment.id },
                amount: held.payment.amount,
                channel: 'BANK_TRANSFER',
                reference: `d1-${crypto.randomUUID()}`,
                reason: 'OUT_OF_FLOW_REFUND'
            },
            { clock: s.f.ports.clock }
        );

        // Assert
        await expectSettledAndLiftable(s, instance, settled.refundId);
    });
});

describe('HOS-2179 D1 safeguard 1: the held row never blocks nor fakes an activation', () => {
    it.skipIf(skip)(
        'activates a correct later payment after a held divergence, and credits only it',
        async () => {
            // Arrange
            const s = await pageSetup();
            const { instance, paymentPageId } = await boughtPage(s);
            const divergent = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
            await pagePriceIs(instance.productId, 12000);
            await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: divergent.chargeId },
                s.ports
            );
            await pagePriceIs(instance.productId, 10000);
            const correct = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });

            // Act
            const result = await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: correct.chargeId },
                s.ports
            );

            // Assert
            expect(result).toMatchObject({ outcome: 'ACTIVATED' });
            expect((await pageInstance(instance.id)).status).toBe('ACTIVE');
            const [activation] = await activationPagePayments(instance.id);
            expect(activation).toMatchObject({
                providerFactId: correct.chargeId,
                status: 'SUCCEEDED'
            });
            expect((await onlyHeld(instance.id)).payment.providerFactId).toBe(divergent.chargeId);
        }
    );

    it.skipIf(skip)(
        'does not activate with the held charge itself once the price matches it',
        async () => {
            // Arrange
            const s = await pageSetup();
            const { instance, paymentPageId } = await boughtPage(s);
            const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
            await pagePriceIs(instance.productId, 12000);
            await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: paid.chargeId },
                s.ports
            );
            await pagePriceIs(instance.productId, 10000);

            // Act
            const result = await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: paid.chargeId },
                s.ports
            );

            // Assert
            expect(result).toEqual({ outcome: 'AMOUNT_MISMATCH' });
            expect((await pageInstance(instance.id)).status).toBe('PENDING_AUTHORIZATION');
            expect(await activationPagePayments(instance.id)).toHaveLength(0);
            expect(await pageMarks(instance.id)).toEqual([
                { reason: 'DIVERGENCIA_DE_MONTO', liftedAt: null }
            ]);
        }
    );

    it.skipIf(skip)(
        'calls a second payment on an abandoned purchase late, not a duplicate of the held one',
        async () => {
            // Arrange
            const { s, instance, paid, again } = await paidAfterAbandon({ twice: true });
            if (!again) throw new Error('second payment missing');
            await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: paid.chargeId },
                s.ports
            );

            // Act
            const result = await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: again.chargeId },
                s.ports
            );

            // Assert
            expect(result).toEqual({ outcome: 'LATE_PAYMENT' });
            expect(await pageMarks(instance.id)).toEqual([
                { reason: 'ORDEN_PAGADA_SIN_INSTANCIA', liftedAt: null }
            ]);
            expect(
                (await heldPagePayments(instance.id)).map((row) => row.payment.providerFactId)
            ).toEqual([paid.chargeId, again.chargeId]);
        }
    );

    it.skipIf(skip)(
        'confirms the activating payment again after a price change instead of marking it',
        async () => {
            // Arrange
            const s = await pageSetup();
            const { instance, paymentPageId } = await boughtPage(s);
            const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
            await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: paid.chargeId },
                s.ports
            );
            await pagePriceIs(instance.productId, 12000);

            // Act
            const result = await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: paid.chargeId },
                s.ports
            );

            // Assert
            expect(result).toEqual({ outcome: 'ALREADY_CONFIRMED' });
            expect(await pageMarks(instance.id)).toEqual([]);
            expect(await heldPagePayments(instance.id)).toHaveLength(0);
        }
    );
});

describe('HOS-2179 D1 safeguard 2: the revocation refunds the payment that activated', () => {
    it.skipIf(skip)('picks the activating payment, not the newer held duplicate', async () => {
        // Arrange
        const { s, instance, first } = await activatedWithDuplicate();
        const [activation] = await activationPagePayments(instance.id);
        if (!activation) throw new Error('activation payment missing');

        // Act
        const { refunds: requested } = await getServiceTestDb().transaction((tx) =>
            requestOneTimeAddonRefunds({
                tx,
                cancelled: [
                    {
                        instanceId: instance.id,
                        ownerId: instance.ownerId,
                        clause: 'ORPHANED',
                        coverageVerticals: [],
                        complementSubscriptionId: null,
                        providerCancellation: null
                    }
                ],
                now: s.f.ports.clock.now(),
                clock: s.f.ports.clock
            })
        );

        // Assert
        expect(requested).toEqual([
            {
                instanceId: instance.id,
                refundId: expect.any(String),
                paymentId: activation.id,
                amount: 10000
            }
        ]);
        expect(activation.providerFactId).toBe(first.chargeId);
    });
});

describe('HOS-2179 D1 safeguard 3: the held row never counts as credited revenue', () => {
    it.skipIf(skip)('issues no receipt and no coverage, so it is never revenue', async () => {
        // Arrange
        const { instance } = await activatedWithDuplicate();
        const held = await onlyHeld(instance.id);
        const [activation] = await activationPagePayments(instance.id);
        if (!activation) throw new Error('activation payment missing');
        const db = getServiceTestDb();
        const receiptsOf = (paymentId: string) =>
            db.select().from(receipts).where(eq(receipts.paymentId, paymentId));
        const coverageOf = (paymentId: string) =>
            db.select().from(coveredPeriods).where(eq(coveredPeriods.paymentId, paymentId));

        // Assert
        // The credited-payments check does list it since HOS-2391, but only to re-read it for
        // a chargeback (addon-one-time-page-held-chargeback.test.ts); it never credits it.
        // The activating payment went through P1: it has its receipt.
        expect(await receiptsOf(activation.id)).toHaveLength(1);
        expect(await receiptsOf(held.payment.id)).toHaveLength(0);
        expect(await coverageOf(held.payment.id)).toHaveLength(0);
        expect(held.payment.promoChargesRecorded).toBe(false);
        const [stored] = await db
            .select({ addonInstanceId: payments.addonInstanceId })
            .from(payments)
            .innerJoin(addonInstances, eq(addonInstances.id, payments.addonInstanceId))
            .where(eq(payments.id, held.payment.id));
        expect(stored?.addonInstanceId).toBe(instance.id);
    });
});
