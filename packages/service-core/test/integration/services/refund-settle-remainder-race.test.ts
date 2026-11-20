/**
 * HOS-2406: the panel reference pre-check can lose a race. With it disabled, the versioned close
 * reaches `uq_refund_provider_panel_reference` (23505) and the settlement still answers the typed
 * EXTERNAL_REFERENCE_ALREADY_SETTLED, rolling everything back.
 */
import { PermissionEnum } from '@repo/schemas';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import {
    creditedPayment,
    paymentRow,
    refundById,
    seedAdminActor,
    settleOnPayment
} from './support/refund-fixtures.js';
import {
    panelRefund,
    partiallyAcceptedRefund,
    settleRemainder
} from './support/refund-remainder-fixtures.js';

// The pre-check sees nothing, as when a concurrent settlement commits between it and the close.
vi.mock('../../../src/services/billing/refund/refund-action14', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('../../../src/services/billing/refund/refund-action14')
    >()),
    assertPanelReferenceUnused: async () => undefined
}));

afterAll(closeServiceTestPool);

const skip = !isServiceTestDbAvailable();

describe('HOS-2406 a panel reference that loses the race', () => {
    it.skipIf(skip)('maps the unique violation to EXTERNAL_REFERENCE_ALREADY_SETTLED', async () => {
        // Arrange
        const arranged = await partiallyAcceptedRefund();
        const reference = await panelRefund(arranged);
        const other = await creditedPayment(10000);
        const settler = await seedAdminActor([PermissionEnum.BILLING_SETTLE_EXTERNAL]);
        await settleOnPayment(settler, other, {
            amount: 1000,
            channel: 'PROVIDER_PANEL',
            reference
        });

        // Act
        const settled = settleRemainder(arranged.settler, arranged, { reference });

        // Assert
        await expect(settled).rejects.toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'EXTERNAL_REFERENCE_ALREADY_SETTLED'
        });
        expect(await refundById(arranged.refundId)).toMatchObject({
            status: 'CONFIRMED',
            externalRef: null
        });
        expect(await paymentRow(arranged.credited.payment.id)).toMatchObject({
            refundedAmount: 0
        });
    });
});
