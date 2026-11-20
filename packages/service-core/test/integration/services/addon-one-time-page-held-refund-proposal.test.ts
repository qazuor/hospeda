/**
 * HOS-2179 D1, owner follow-up: when a page-charge mark (DIVERGENCIA_DE_MONTO, COBRO_DUPLICADO,
 * mark 23) hangs the held payment, the same transaction proposes the refund of the whole held
 * amount: one `REQUESTED` refund, reason `MARK_PROPOSAL`, whoever opened the mark (A2 or the
 * sweep), and only one even when the notice and the sweep open it at once. The list proposes
 * REFUND for every held-charge mark. No notice, sweep pass or refund job executes it: it stays
 * `REQUESTED` until a person confirms it (action 13). Runs with the fake, lies on.
 */
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { listActionableReconciliationMarks } from '../../../src/services/billing/reconciliation/actionable-marks';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service';
import { executeRefundFromProviderRead } from '../../../src/services/billing/refund/execute-refund.service';
import { resendUnansweredRefundCalls } from '../../../src/services/billing/refund/resend-refund-call.service';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers';
import { retirePurchaseFixtures } from './support/addon-purchase-fixtures';
import {
    deliver,
    HELD_CHARGE_CASES,
    heldChargeFor,
    heldLink,
    liftByAdmin,
    markRow,
    paidWithoutLiveInstance,
    refundsOf,
    sweepCreditedPayments,
    sweepPagePayments,
    takeDue
} from './support/held-charge-refund-fixtures';
import { heldPagePayments, retirePageMarks } from './support/one-time-page-fixtures';
import { seedAdminActor } from './support/refund-fixtures';

const skip = !isServiceTestDbAvailable();

afterEach(async () => {
    vi.restoreAllMocks();
    await retirePageMarks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

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

describe('HOS-2179 D1 a held-charge mark proposes its refund', () => {
    for (const reason of HELD_CHARGE_CASES) {
        it.skipIf(skip)(
            `${reason}: one REQUESTED MARK_PROPOSAL refund for the whole held amount`,
            async () => {
                // Arrange + Act
                const { held } = await heldChargeFor(reason);

                // Assert
                const proposals = await refundsOf(held.payment.id);
                expect(proposals).toHaveLength(1);
                expect(proposals[0]).toMatchObject({
                    status: 'REQUESTED',
                    reason: 'MARK_PROPOSAL',
                    amount: held.payment.amount,
                    confirmedBy: null
                });
                expect((await listed(held.markId)).defaultProposal).toBe('REFUND');
            }
        );
    }

    it.skipIf(skip)('the sweep that opens mark 23 proposes the refund too', async () => {
        // Arrange
        const { s, instance } = await paidWithoutLiveInstance();
        s.f.fake.takeDeliveries();

        // Act
        await sweepPagePayments(s, [instance.id]);

        // Assert
        const [held] = await heldPagePayments(instance.id);
        if (!held) throw new Error('held payment missing');
        expect(held.reason).toBe('ORDEN_PAGADA_SIN_INSTANCIA');
        const proposals = await refundsOf(held.payment.id);
        expect(proposals.map(({ status, reason }) => ({ status, reason }))).toEqual([
            { status: 'REQUESTED', reason: 'MARK_PROPOSAL' }
        ]);
    });

    it.skipIf(skip)('a notice and the sweep opening mark 23 at once leave one refund', async () => {
        // Arrange
        const { s, instance } = await paidWithoutLiveInstance();
        const deliveries = takeDue(s);

        // Act
        const [outcomes, summary] = await Promise.all([
            deliver(s, deliveries),
            sweepPagePayments(s, [instance.id])
        ]);

        // Assert: both entries succeed, one row is held, one refund is proposed.
        expect(outcomes).toContain('ADDON_LATE_PAYMENT_MARKED');
        expect(summary.pagePayments?.failures).toEqual([]);
        const held = await heldPagePayments(instance.id);
        expect(held).toHaveLength(1);
        const [row] = held;
        if (!row) throw new Error('held payment missing');
        expect(await refundsOf(row.payment.id)).toHaveLength(1);
    });

    it.skipIf(skip)(
        'a confirmed proposal executes on the notice, resolves the payment and lets the mark lift',
        async () => {
            // Arrange
            const { s, held } = await heldChargeFor('DIVERGENCIA_DE_MONTO');
            const [proposal] = await refundsOf(held.payment.id);
            if (!proposal) throw new Error('proposal missing');
            const person = await seedAdminActor([PermissionEnum.BILLING_REFUND]);

            // Act
            await confirmRefund(
                { actor: person, refundId: proposal.id },
                { clock: s.f.ports.clock, provider: s.f.fake }
            );
            await deliver(s, takeDue(s));
            const lifted = await liftByAdmin(s, held.markId);

            // Assert
            expect((await refundsOf(held.payment.id))[0]?.status).toBe('EXECUTED');
            expect(await heldLink(held.payment.id)).toMatchObject({ refundId: proposal.id });
            expect(lifted).toBeDefined();
            expect((await markRow(held.markId)).liftedAt).not.toBeNull();
        }
    );
});

describe('HOS-2179 D1 nothing executes a proposed refund on its own', () => {
    it.skipIf(skip)(
        'stays REQUESTED through a repeated notice, both sweep passes and the refund jobs',
        async () => {
            // Arrange
            const { s, instance, held, deliveries } = await heldChargeFor('MARK_23');
            expect(deliveries.length).toBeGreaterThan(0);
            const [proposal] = await refundsOf(held.payment.id);
            if (!proposal) throw new Error('proposal missing');

            // Act
            await deliver(s, deliveries);
            await sweepPagePayments(s, [instance.id]);
            await sweepCreditedPayments(s, [held.payment.id]);
            const resent = await resendUnansweredRefundCalls(
                { refundId: proposal.id },
                { provider: s.f.fake, clock: s.f.ports.clock }
            );
            const read = await executeRefundFromProviderRead(
                { refundId: proposal.id },
                { provider: s.f.fake, clock: s.f.ports.clock }
            );

            // Assert
            expect(resent.outcomes).toEqual([]);
            expect(read.outcome).toBe('NOT_CONFIRMED');
            const after = await refundsOf(held.payment.id);
            expect(after).toHaveLength(1);
            expect(after[0]).toMatchObject({
                id: proposal.id,
                status: 'REQUESTED',
                version: proposal.version
            });
            expect(await heldLink(held.payment.id)).toMatchObject({
                resolvedAt: null,
                refundId: null
            });
        }
    );
});
