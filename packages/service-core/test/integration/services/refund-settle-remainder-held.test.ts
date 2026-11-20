/**
 * HOS-2406: the refund a page-charge mark proposes (MARK_PROPOSAL), accepted only in part by the
 * provider. Recording the manual remainder closes the held charge exactly as a normal execution:
 * the held payment is resolved with this refund, and the mark can then be lifted with action 7.
 */
import { PermissionEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { settleRefundRemainder } from '../../../src/services/billing/refund/settle-refund-remainder.service.js';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import {
    heldLink,
    heldWithCallLessConfirmedRefund,
    liftByAdmin,
    markRow,
    refundsOf
} from './support/held-charge-refund-fixtures.js';
import { paymentRow, seedAdminActor } from './support/refund-fixtures.js';
import { seedProviderCalls } from './support/refund-remainder-fixtures.js';

afterAll(closeServiceTestPool);

const skip = !isServiceTestDbAvailable();

describe('HOS-2406 the manual remainder closes a held page charge', () => {
    it.skipIf(skip)(
        'resolves the held payment with the refund, squares the payment, and the mark lifts',
        async () => {
            // Arrange
            const { s, held, proposal, person } =
                await heldWithCallLessConfirmedRefund('COBRO_DUPLICADO');
            const accepted = Math.floor(proposal.amount / 2);
            const remainder = proposal.amount - accepted;
            await seedProviderCalls({
                refundId: proposal.id,
                confirmedBy: person.id,
                calls: [{ kind: 'ACCEPTED', amount: accepted }],
                at: s.f.ports.clock.now()
            });
            expect((await heldLink(held.payment.id)).resolvedAt).toBeNull();
            const settler = await seedAdminActor([PermissionEnum.BILLING_SETTLE_EXTERNAL]);

            // Act
            const result = await settleRefundRemainder(
                {
                    actor: settler,
                    refundId: proposal.id,
                    amount: remainder,
                    reference: `mp-panel-${crypto.randomUUID()}`
                },
                { clock: s.f.ports.clock }
            );

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
            const { s, held, proposal, person } =
                await heldWithCallLessConfirmedRefund('DIVERGENCIA_DE_MONTO');
            await seedProviderCalls({
                refundId: proposal.id,
                confirmedBy: person.id,
                calls: [{ kind: 'ACCEPTED', amount: 1 }],
                at: s.f.ports.clock.now()
            });
            const settler = await seedAdminActor([PermissionEnum.BILLING_SETTLE_EXTERNAL]);

            // Act
            const settled = settleRefundRemainder(
                {
                    actor: settler,
                    refundId: proposal.id,
                    amount: proposal.amount,
                    reference: `mp-panel-${crypto.randomUUID()}`
                },
                { clock: s.f.ports.clock }
            );

            // Assert
            await expect(settled).rejects.toMatchObject({ reason: 'REMAINDER_AMOUNT_MISMATCH' });
            expect((await heldLink(held.payment.id)).resolvedAt).toBeNull();
            expect((await markRow(held.markId)).liftedAt).toBeNull();
        }
    );
});
