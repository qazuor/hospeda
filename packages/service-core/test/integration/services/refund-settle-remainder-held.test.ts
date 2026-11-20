/**
 * HOS-2406: the refund a page-charge mark proposes (MARK_PROPOSAL), accepted only in part by the
 * provider. Recording the manual remainder closes the held charge exactly as a normal execution:
 * the held payment is resolved with this refund, and the mark can then be lifted with action 7.
 */
import { and, emailOutbox, eq } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { LATE_PAYMENT_REFUNDED_TEMPLATE } from '../../../src/services/billing/refund/late-payment-refund-notice.js';
import { settleRefundRemainder } from '../../../src/services/billing/refund/settle-refund-remainder.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    type HeldChargeCase,
    heldLink,
    heldWithCallLessConfirmedRefund,
    liftByAdmin,
    markRow,
    refundsOf
} from './support/held-charge-refund-fixtures.js';
import { paymentRow, seedAdminActor } from './support/refund-fixtures.js';
import {
    refundAcceptedAtFake,
    refundAtFake,
    seedProviderCalls
} from './support/refund-remainder-fixtures.js';

afterAll(closeServiceTestPool);

const skip = !isServiceTestDbAvailable();

/**
 * The mark's proposal, confirmed with no call, then accepted only for `accepted` at the fake (a
 * real credited refund on the held charge). Returns the arranged charge and a settler.
 */
async function partiallyAcceptedProposal(reason: HeldChargeCase, accepted?: number) {
    const arranged = await heldWithCallLessConfirmedRefund(reason);
    const { s, held, proposal, person } = arranged;
    const acceptedAmount = accepted ?? Math.floor(proposal.amount / 2);
    await seedProviderCalls({
        refundId: proposal.id,
        confirmedBy: person.id,
        calls: await refundAcceptedAtFake({
            provider: s.f.fake,
            chargeId: held.payment.providerFactId,
            calls: [{ kind: 'ACCEPTED', amount: acceptedAmount }]
        }),
        at: s.f.ports.clock.now()
    });
    const settler = await seedAdminActor([PermissionEnum.BILLING_SETTLE_EXTERNAL]);
    return { ...arranged, acceptedAmount, settler };
}

/** Settles `amount` of the proposal with a real panel refund of `panelAmount` at the fake. */
async function settleProposal(
    arranged: Awaited<ReturnType<typeof partiallyAcceptedProposal>>,
    amount: number,
    panelAmount = amount
) {
    const { s, held, proposal, settler } = arranged;
    const reference = await refundAtFake({
        provider: s.f.fake,
        chargeId: held.payment.providerFactId,
        amount: panelAmount
    });
    return settleRefundRemainder(
        { actor: settler, refundId: proposal.id, amount, reference },
        { provider: s.f.fake, clock: s.f.ports.clock }
    );
}

describe('HOS-2406 the manual remainder closes a held page charge', () => {
    it.skipIf(skip)(
        'resolves the held payment with the refund, squares the payment, and the mark lifts',
        async () => {
            // Arrange
            const arranged = await partiallyAcceptedProposal('COBRO_DUPLICADO');
            const { s, held, proposal, acceptedAmount: accepted } = arranged;
            const remainder = proposal.amount - accepted;
            expect((await heldLink(held.payment.id)).resolvedAt).toBeNull();

            // Act
            const result = await settleProposal(arranged, remainder);

            // Assert
            expect(result).toMatchObject({ acceptedAmount: accepted, remainderAmount: remainder });
            expect(await refundsOf(held.payment.id)).toEqual([
                expect.objectContaining({
                    id: proposal.id,
                    status: 'EXECUTED',
                    reason: 'MARK_PROPOSAL'
                })
            ]);
            expect(await heldLink(held.payment.id)).toMatchObject({
                refundId: proposal.id,
                resolvedAt: s.f.ports.clock.now()
            });
            expect((await paymentRow(held.payment.id))?.refundedAmount).toBe(proposal.amount);
            await liftByAdmin(s, held.markId);
            expect((await markRow(held.markId)).liftedAt).not.toBeNull();
        }
    );

    it.skipIf(skip)(
        'a rejected remainder leaves the held payment hung and the mark open',
        async () => {
            // Arrange
            const arranged = await partiallyAcceptedProposal('DIVERGENCIA_DE_MONTO', 1);
            const { held, proposal } = arranged;

            // Act
            const settled = settleProposal(arranged, proposal.amount, proposal.amount - 1);

            // Assert
            await expect(settled).rejects.toMatchObject({ reason: 'REMAINDER_AMOUNT_MISMATCH' });
            expect((await heldLink(held.payment.id)).resolvedAt).toBeNull();
            expect((await markRow(held.markId)).liftedAt).toBeNull();
        }
    );

    it.skipIf(skip)('closing a late charge held by mark 23 mails its buyer once', async () => {
        // Arrange
        const arranged = await partiallyAcceptedProposal('MARK_23');
        const { instance, proposal, acceptedAmount } = arranged;

        // Act
        await settleProposal(arranged, proposal.amount - acceptedAmount);

        // Assert
        const mails = await getServiceTestDb()
            .select()
            .from(emailOutbox)
            .where(
                and(
                    eq(emailOutbox.template, LATE_PAYMENT_REFUNDED_TEMPLATE),
                    eq(emailOutbox.recipientUserId, instance.ownerId)
                )
            );
        expect(mails).toHaveLength(1);
    });
});
