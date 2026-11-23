/**
 * HOS-2179 D1, owner decision (option 3): a page-charge mark of a one-time addon
 * (DIVERGENCIA_DE_MONTO, COBRO_DUPLICADO, mark 23) holds the charge's own `payment` row, and that
 * money is closed only through a refund. Action 7 refuses to resolve it without a refund, the
 * list flags the mark with `liftRequiresRefund`, any other mark still lifts as before, and once a
 * refund settles the held payment the same mark lifts. Runs with the fake, lies on.
 */
import { eq, reconciliationMarkPayments, reconciliationMarks, refunds } from '@repo/db';
import type { NoticeDelivery } from '@repo/payments';
import { FAKE_NOTICE_CHANNEL_HEADER } from '@repo/payments/fake';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { confirmOneTimePagePayment } from '../../../src/services/billing/addon/addon-instance-a2-one-time-page';
import { abandonOneTimeAddon } from '../../../src/services/billing/addon/expire-addon-authorization-windows-one-time';
import { receiveProviderDelivery } from '../../../src/services/billing/notice/receive-provider-delivery.service';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger';
import { listActionableReconciliationMarks } from '../../../src/services/billing/reconciliation/actionable-marks';
import { liftReconciliationMarkByAdmin } from '../../../src/services/billing/reconciliation/lift-reconciliation-mark-by-admin.service';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { retirePurchaseFixtures } from './support/addon-purchase-fixtures';
import {
    activationPagePayments,
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

/** Hands every due Webhooks delivery to the receiver, wired as the API wires it. */
async function deliverDue(s: Setup) {
    const due = s.f.fake
        .takeDeliveries()
        .deliveries.filter(
            (delivery: NoticeDelivery) =>
                delivery.headers[FAKE_NOTICE_CHANNEL_HEADER] !== 'secondary'
        );
    for (const delivery of due)
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
        );
}

/** A held charge on a fresh purchase, for one of the three page-charge reasons. */
async function heldChargeFor(reason: 'DIVERGENCIA_DE_MONTO' | 'COBRO_DUPLICADO' | 'MARK_23') {
    const s = await pageSetup();
    const { instance, paymentPageId } = await boughtPage(s);
    const first = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
    if (reason === 'DIVERGENCIA_DE_MONTO') {
        await pagePriceIs(instance.productId, 12000);
        await confirmOneTimePagePayment(
            { instanceId: instance.id, chargeId: first.chargeId },
            s.ports
        );
    } else if (reason === 'COBRO_DUPLICADO') {
        const second = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        await confirmOneTimePagePayment(
            { instanceId: instance.id, chargeId: first.chargeId },
            s.ports
        );
        await confirmOneTimePagePayment(
            { instanceId: instance.id, chargeId: second.chargeId },
            s.ports
        );
    } else {
        await abandonOneTimeAddon(
            {
                instanceId: instance.id,
                expectedProviderOrderId: null,
                now: s.f.ports.clock.now()
            },
            { billingFacts: undefined }
        );
        await confirmOneTimePagePayment(
            { instanceId: instance.id, chargeId: first.chargeId },
            s.ports
        );
    }
    const held = await heldPagePayments(instance.id);
    expect(held).toHaveLength(1);
    const [row] = held;
    if (!row) throw new Error('held payment missing');
    s.f.fake.takeDeliveries();
    return { s, instance, held: row };
}

/** The mark row, read fresh. */
async function markRow(markId: string) {
    const [mark] = await getServiceTestDb()
        .select()
        .from(reconciliationMarks)
        .where(eq(reconciliationMarks.id, markId));
    if (!mark) throw new Error('mark missing');
    return mark;
}

/** The listed entry of one open mark, paging the actionable list. */
async function listed(markId: string) {
    for (let page = 1; page < 100; page++) {
        const result = await listActionableReconciliationMarks({ page, pageSize: 100 });
        const found = result.items.find((item) => item.markId === markId);
        if (found) return found;
        if (page * 100 >= result.total) break;
    }
    throw new Error('mark not listed');
}

/** Action 7 by a person who may lift marks. */
async function liftByAdmin(
    s: Setup,
    markId: string,
    resolveWithoutRefund: readonly { readonly source: 'PAYMENT'; readonly id: string }[]
) {
    const person = await seedAdminActor([PermissionEnum.BILLING_LIFT_RECONCILIATION_MARK]);
    const mark = await markRow(markId);
    return liftReconciliationMarkByAdmin(
        { actor: person, markId, expectedVersion: mark.version, resolveWithoutRefund },
        { clock: s.f.ports.clock }
    );
}

describe('HOS-2179 D1 a held-charge mark closes only through a refund', () => {
    for (const reason of ['DIVERGENCIA_DE_MONTO', 'COBRO_DUPLICADO', 'MARK_23'] as const) {
        it.skipIf(skip)(`${reason}: action 7 refuses to resolve the held charge`, async () => {
            // Arrange
            const { s, held } = await heldChargeFor(reason);
            const before = await markRow(held.markId);

            // Act
            const withoutRefund = liftByAdmin(s, held.markId, [
                { source: 'PAYMENT', id: held.payment.id }
            ]);

            // Assert
            await expect(withoutRefund).rejects.toMatchObject({
                reason: 'MARK_CLOSES_ONLY_BY_REFUND'
            });
            await expect(liftByAdmin(s, held.markId, [])).rejects.toMatchObject({
                reason: 'MARK_HAS_UNRESOLVED_PAYMENTS'
            });
            const after = await markRow(held.markId);
            expect(after).toMatchObject({ liftedAt: null, version: before.version });
            const [link] = await getServiceTestDb()
                .select()
                .from(reconciliationMarkPayments)
                .where(eq(reconciliationMarkPayments.markId, held.markId));
            expect(link).toMatchObject({ resolvedAt: null, refundId: null });
            expect((await listed(held.markId)).liftRequiresRefund).toBe(true);
        });
    }

    it.skipIf(skip)('still lets action 7 resolve and lift any other mark', async () => {
        // Arrange: an activated purchase whose activation payment hangs from a CONTRACARGO mark.
        const s = await pageSetup();
        const { instance, paymentPageId } = await boughtPage(s);
        const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        await confirmOneTimePagePayment(
            { instanceId: instance.id, chargeId: paid.chargeId },
            s.ports
        );
        const [activation] = await activationPagePayments(instance.id);
        if (!activation) throw new Error('activation payment missing');
        const opened = await openReconciliationMark(
            {
                subject: { kind: 'ADDON_INSTANCE', addonInstanceId: instance.id },
                reason: 'CONTRACARGO',
                actor: { type: 'job' },
                correlationId: crypto.randomUUID(),
                detail: [{ field: 'provider.charge_id', new: paid.chargeId }],
                payment: { source: 'PAYMENT', id: activation.id }
            },
            { markPayments: createPaymentReconciliationMarkPayments(s.f.ports.clock) }
        );
        expect((await listed(opened.mark.id)).liftRequiresRefund).toBe(false);

        // Act
        const lifted = await liftByAdmin(s, opened.mark.id, [
            { source: 'PAYMENT', id: activation.id }
        ]);

        // Assert
        expect(lifted.resolvedWithoutRefund).toEqual([{ source: 'PAYMENT', id: activation.id }]);
        expect((await markRow(opened.mark.id)).liftedAt).not.toBeNull();
    });

    it.skipIf(skip)('lifts the held-charge mark once a refund settles its payment', async () => {
        // Arrange
        const { s, held } = await heldChargeFor('COBRO_DUPLICADO');
        const { id: refundId } = await proposedRefund(held.payment.id);
        s.f.fake.takeDeliveries();
        const refunder = await seedAdminActor([PermissionEnum.BILLING_REFUND]);
        await confirmRefund(
            { actor: refunder, refundId },
            { clock: s.f.ports.clock, provider: s.f.fake }
        );
        await deliverDue(s);
        const [refund] = await getServiceTestDb()
            .select()
            .from(refunds)
            .where(eq(refunds.id, refundId));
        expect(refund?.status).toBe('EXECUTED');
        expect((await listed(held.markId)).liftRequiresRefund).toBe(false);

        // Act
        const lifted = await liftByAdmin(s, held.markId, []);

        // Assert
        expect(lifted.resolvedWithoutRefund).toEqual([]);
        expect((await markRow(held.markId)).liftedAt).not.toBeNull();
    });
});
