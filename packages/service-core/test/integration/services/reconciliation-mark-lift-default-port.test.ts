import { eq, reconciliationMarkModel, reconciliationMarkPayments } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger.js';
import { liftReconciliationMark } from '../../../src/services/billing/reconciliation/lift-reconciliation-mark.service.js';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    markPaymentClock as clock,
    markPaymentFixture,
    retireMarkPaymentFixtures,
    seedProviderPayment
} from './support/mark-payment-fixtures.js';

afterAll(closeServiceTestPool);
afterEach(retireMarkPaymentFixtures);

describe('TEST:1697:7 AC:1697:2 S15 default ledger port', () => {
    it('rejects a real unresolved hung payment without an injected port, then lifts after resolution', async () => {
        const { subscriptionId, userId } = await markPaymentFixture();
        const payment = await seedProviderPayment({ subscriptionId });
        const { mark } = await openReconciliationMark(
            {
                subject: { kind: 'SUBSCRIPTION', subscriptionId },
                reason: 'COBRO_DUPLICADO',
                payment,
                actor: { type: 'admin', id: userId },
                correlationId: crypto.randomUUID()
            },
            { markPayments: createPaymentReconciliationMarkPayments(clock) }
        );
        const lift = () =>
            liftReconciliationMark(
                { markId: mark.id, expectedVersion: mark.version, liftedBy: userId },
                { clock }
            );

        await expect(lift()).rejects.toMatchObject({ reason: 'MARK_HAS_UNRESOLVED_PAYMENTS' });
        expect((await reconciliationMarkModel.findById({ markId: mark.id }))?.liftedAt).toBeNull();
        await getServiceTestDb()
            .update(reconciliationMarkPayments)
            .set({ resolvedAt: clock.now() })
            .where(eq(reconciliationMarkPayments.paymentId, payment.id));
        await expect(lift()).resolves.toMatchObject({ outcome: 'LIFTED' });
    });
});
