/**
 * HOS-2179 D1, owner follow-up: the refund a page-charge mark proposes is never declined. The
 * held money leaves the mark when that refund executes, by a chargeback, or by action 14 (which
 * closes the REQUESTED proposal or answers a FAILED one).
 * - A chargeback (read by the notice, by the sweep, or by action 13 itself) resolves the held
 *   payment without a refund and fails the waiting proposal, so the mark can be lifted.
 * - Action 13's decline refuses with `REFUND_CLOSES_HELD_CHARGE`; any other refund still declines.
 * - A refund the provider rejected for good, or one past the provider's window, still reaches
 *   action 14, whose settlement resolves the held payment.
 * Runs with the fake, lies on.
 */
import type { PaymentProvider, RefundInput } from '@repo/payments';
import { PaymentProviderError } from '@repo/payments';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service';
import { declineRefund } from '../../../src/services/billing/refund/decline-refund.service';
import { requestRefund } from '../../../src/services/billing/refund/request-refund.service';
import { settleExternalRefund } from '../../../src/services/billing/refund/settle-external-refund.service';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers';
import { purchaseNow, retirePurchaseFixtures } from './support/addon-purchase-fixtures';
import {
    deliver,
    type HeldChargeCase,
    type HeldChargeSetup,
    heldChargeFor,
    heldLink,
    heldWithCallLessConfirmedRefund,
    liftByAdmin,
    markRow,
    refundsOf,
    sweepCreditedPayments,
    takeDue
} from './support/held-charge-refund-fixtures';
import { activationPagePayments, retirePageMarks } from './support/one-time-page-fixtures';
import { seedAdminActor } from './support/refund-fixtures';

const DAY_MS = 86_400_000;
const skip = !isServiceTestDbAvailable();

afterEach(async () => {
    vi.restoreAllMocks();
    await retirePageMarks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

/** The held charge with its proposed refund. */
async function heldWithProposal(reason: HeldChargeCase) {
    const arranged = await heldChargeFor(reason);
    const [proposal] = await refundsOf(arranged.held.payment.id);
    if (!proposal) throw new Error('proposal missing');
    return { ...arranged, proposal };
}

/** Asserts the held payment was resolved without a refund and the mark lifts with action 7. */
async function expectClosedByChargeback(
    s: HeldChargeSetup,
    held: { readonly markId: string; readonly payment: { readonly id: string } }
) {
    expect((await heldLink(held.payment.id)).resolvedAt).not.toBeNull();
    expect((await heldLink(held.payment.id)).refundId).toBeNull();
    expect((await refundsOf(held.payment.id)).map((refund) => refund.status)).toEqual(['FAILED']);
    await liftByAdmin(s, held.markId);
    expect((await markRow(held.markId)).liftedAt).not.toBeNull();
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

describe('HOS-2179 D1 a chargeback closes a held charge', () => {
    for (const reason of ['DIVERGENCIA_DE_MONTO', 'COBRO_DUPLICADO'] as const) {
        it.skipIf(skip)(`${reason}: read by the notice, the mark can be lifted`, async () => {
            // Arrange
            const { s, chargeId, held } = await heldWithProposal(reason);
            await s.f.fake.chargeBack({ chargeId });

            // Act: the notice, then the same notice again.
            const deliveries = takeDue(s);
            expect(deliveries.length).toBeGreaterThan(0);
            await deliver(s, deliveries);
            await deliver(s, deliveries);

            // Assert
            await expectClosedByChargeback(s, held);
        });
    }

    it.skipIf(skip)('MARK_23: read by the sweep, the mark can be lifted', async () => {
        // Arrange
        const { s, chargeId, held } = await heldWithProposal('MARK_23');
        await s.f.fake.chargeBack({ chargeId });
        s.f.fake.takeDeliveries();
        s.f.advanceTo(new Date(purchaseNow.getTime() + DAY_MS));

        // Act
        const summary = await sweepCreditedPayments(s, [held.payment.id]);

        // Assert
        expect(summary.failures).toEqual([]);
        await expectClosedByChargeback(s, held);
    });

    it.skipIf(skip)(
        'DIVERGENCIA_DE_MONTO: read by action 13, the mark can be lifted though its reason asks no refund confirmation',
        async () => {
            // Arrange
            const { s, chargeId, held, proposal } = await heldWithProposal('DIVERGENCIA_DE_MONTO');
            await s.f.fake.chargeBack({ chargeId });
            s.f.fake.takeDeliveries();
            const person = await seedAdminActor([PermissionEnum.BILLING_REFUND]);

            // Act
            const confirmed = await confirmRefund(
                { actor: person, refundId: proposal.id },
                { clock: s.f.ports.clock, provider: s.f.fake }
            );

            // Assert
            expect(confirmed).toMatchObject({ status: 'FAILED', outcome: 'CHARGED_BACK' });
            await expectClosedByChargeback(s, held);
        }
    );
});

describe('HOS-2179 D1 the proposed refund of a held charge is never declined', () => {
    it.skipIf(skip)('refuses with REFUND_CLOSES_HELD_CHARGE and leaves it open', async () => {
        // Arrange
        const { s, held, proposal } = await heldWithProposal('COBRO_DUPLICADO');
        const person = await seedAdminActor([PermissionEnum.BILLING_REFUND]);

        // Act
        const declined = declineRefund(
            { actor: person, refundId: proposal.id },
            { clock: s.f.ports.clock }
        );

        // Assert
        await expect(declined).rejects.toMatchObject({ reason: 'REFUND_CLOSES_HELD_CHARGE' });
        expect(await refundsOf(held.payment.id)).toEqual([proposal]);
    });

    it.skipIf(skip)(
        'refuses a CONFIRMED proposal with an accepted provider call, and leaves it CONFIRMED',
        async () => {
            // Arrange
            const { s, held, proposal } = await heldWithProposal('DIVERGENCIA_DE_MONTO');
            const person = await seedAdminActor([PermissionEnum.BILLING_REFUND]);
            const confirmed = await confirmRefund(
                { actor: person, refundId: proposal.id },
                { clock: s.f.ports.clock, provider: s.f.fake }
            );
            expect(confirmed.status).toBe('CONFIRMED');
            expect(confirmed.calls.length).toBeGreaterThan(0);

            // Act
            const declined = declineRefund(
                { actor: person, refundId: proposal.id },
                { clock: s.f.ports.clock }
            );

            // Assert
            await expect(declined).rejects.toMatchObject({ reason: 'REFUND_CLOSES_HELD_CHARGE' });
            expect((await refundsOf(held.payment.id))[0]?.status).toBe('CONFIRMED');
        }
    );

    it.skipIf(skip)(
        'declines a CONFIRMED proposal that sent nothing, with the warning, and action 14 answers it',
        async () => {
            // Arrange
            const { s, held, proposal, person } =
                await heldWithCallLessConfirmedRefund('COBRO_DUPLICADO');

            // Act
            const declined = await declineRefund(
                { actor: person, refundId: proposal.id },
                { clock: s.f.ports.clock }
            );

            // Assert
            expect(declined).toMatchObject({
                refundId: proposal.id,
                status: 'FAILED',
                warning: 'VERIFY_NO_PROVIDER_REFUND'
            });
            const settler = await seedAdminActor([PermissionEnum.BILLING_SETTLE_EXTERNAL]);
            const settled = await settleExternalRefund(
                {
                    actor: settler,
                    source: { kind: 'PAYMENT', id: held.payment.id },
                    amount: held.payment.amount,
                    channel: 'BANK_TRANSFER',
                    reference: `d1-${crypto.randomUUID()}`,
                    reason: 'OUT_OF_FLOW_REFUND',
                    refundId: proposal.id
                },
                { clock: s.f.ports.clock }
            );
            expect(settled.settledFailedRefundId).toBe(proposal.id);
            expect(await heldLink(held.payment.id)).toMatchObject({ refundId: settled.refundId });
            await liftByAdmin(s, held.markId);
            expect((await markRow(held.markId)).liftedAt).not.toBeNull();
        }
    );

    it.skipIf(skip)('answers 403 first to a person without the refund permission', async () => {
        // Arrange
        const { s, proposal } = await heldWithProposal('MARK_23');
        const stranger = await seedAdminActor([]);

        // Act
        const declined = declineRefund(
            { actor: stranger, refundId: proposal.id },
            { clock: s.f.ports.clock }
        );

        // Assert
        await expect(declined).rejects.toMatchObject({
            reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
        });
    });

    it.skipIf(skip)(
        'still declines a MARK_PROPOSAL refund of a payment no mark holds',
        async () => {
            // Arrange: the purchase's own activating payment, not a held row.
            const { s, instance } = await heldWithProposal('COBRO_DUPLICADO');
            const [activating] = await activationPagePayments(instance.id);
            if (!activating) throw new Error('activating payment missing');
            const { refundId } = await requestRefund(
                {
                    source: { kind: 'PAYMENT', id: activating.id },
                    amount: activating.amount,
                    reason: 'MARK_PROPOSAL'
                },
                { clock: s.f.ports.clock }
            );
            const person = await seedAdminActor([PermissionEnum.BILLING_REFUND]);

            // Act
            const declined = await declineRefund(
                { actor: person, refundId },
                { clock: s.f.ports.clock }
            );

            // Assert
            // A REQUESTED refund carries no warning.
            expect(declined).not.toHaveProperty('warning');
            expect(declined).toMatchObject({ refundId, status: 'FAILED' });
        }
    );
});

describe('HOS-2179 D1 action 14 still closes a held charge', () => {
    it.skipIf(skip)(
        'after the provider rejected the refund for good, a settlement by hand resolves it',
        async () => {
            // Arrange
            const { s, held, proposal } = await heldWithProposal('DIVERGENCIA_DE_MONTO');
            const rejecting = withRefund(s.f.fake, async () => {
                throw new PaymentProviderError({
                    code: 'REJECTED',
                    capability: 'refund',
                    message: 'Mercado Pago refund failed (401)',
                    cause: {
                        status: 401,
                        body: { message: 'Unauthorized use of live credentials' }
                    }
                });
            });
            const refunder = await seedAdminActor([PermissionEnum.BILLING_REFUND]);
            const confirmed = await confirmRefund(
                { actor: refunder, refundId: proposal.id },
                { clock: s.f.ports.clock, provider: rejecting }
            );
            expect(confirmed).toMatchObject({
                status: 'FAILED',
                outcome: 'PROVIDER_REJECTED_FAILED'
            });
            const settler = await seedAdminActor([PermissionEnum.BILLING_SETTLE_EXTERNAL]);

            // Act
            const settled = await settleExternalRefund(
                {
                    actor: settler,
                    source: { kind: 'PAYMENT', id: held.payment.id },
                    amount: held.payment.amount,
                    channel: 'BANK_TRANSFER',
                    reference: `d1-${crypto.randomUUID()}`,
                    reason: 'OUT_OF_FLOW_REFUND',
                    refundId: proposal.id
                },
                { clock: s.f.ports.clock }
            );

            // Assert
            expect(settled.settledFailedRefundId).toBe(proposal.id);
            expect(await heldLink(held.payment.id)).toMatchObject({ refundId: settled.refundId });
            await liftByAdmin(s, held.markId);
            expect((await markRow(held.markId)).liftedAt).not.toBeNull();
        }
    );

    it.skipIf(skip)(
        'past the provider window, action 14 closes the proposal itself and resolves it',
        async () => {
            // Arrange
            const { s, held, proposal } = await heldWithProposal('COBRO_DUPLICADO');
            s.f.advanceTo(new Date(purchaseNow.getTime() + 181 * DAY_MS));
            const refunder = await seedAdminActor([PermissionEnum.BILLING_REFUND]);
            await expect(
                confirmRefund(
                    { actor: refunder, refundId: proposal.id },
                    { clock: s.f.ports.clock, provider: s.f.fake }
                )
            ).rejects.toMatchObject({ reason: 'REFUND_PAST_PROVIDER_WINDOW' });
            const settler = await seedAdminActor([PermissionEnum.BILLING_SETTLE_EXTERNAL]);

            // Act
            const settled = await settleExternalRefund(
                {
                    actor: settler,
                    source: { kind: 'PAYMENT', id: held.payment.id },
                    amount: held.payment.amount,
                    channel: 'BANK_TRANSFER',
                    reference: `d1-${crypto.randomUUID()}`,
                    reason: 'STALE_CHARGE_REFUND',
                    refundId: proposal.id
                },
                { clock: s.f.ports.clock }
            );

            // Assert
            expect(settled).toMatchObject({
                refundId: proposal.id,
                closedRequestedRefundId: proposal.id
            });
            expect(await heldLink(held.payment.id)).toMatchObject({ refundId: proposal.id });
            await liftByAdmin(s, held.markId);
            expect((await markRow(held.markId)).liftedAt).not.toBeNull();
        }
    );
});
