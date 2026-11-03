import { coveredPeriods, eq, payments, reconciliationMarkPayments } from '@repo/db';
import { actStartInstant, assertFreshForAct } from '@repo/payments';
import { afterAll, describe, expect, it } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger.js';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service.js';
import { confirmRefund } from '../../../src/services/billing/refund/confirm-refund.service.js';
import { executeRefundFromProviderRead } from '../../../src/services/billing/refund/execute-refund.service.js';
import { requestRefund } from '../../../src/services/billing/refund/request-refund.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { refundConfirmFixture } from './support/refund-confirm-fixtures.js';
import {
    confirmedExecuteFixture,
    executeRows,
    totalHonestM13Fixture
} from './support/refund-execute-fixtures.js';

afterAll(closeServiceTestPool);
const skip = !isServiceTestDbAvailable();

describe('TEST:B6:4 AC:B6:5 provider refund execution', () => {
    it.skipIf(skip)(
        '(a) executes two accredited partials through P4 and writes PROVIDER',
        async () => {
            // Arrange
            const seeded = await confirmedExecuteFixture();
            const before = await executeRows(seeded.refundId, seeded.payment.id);
            expect(before.calls.map((call) => call.amount)).toEqual([5000, 2500, 2500]);
            expect(before.keys[0]?.result).toMatchObject({ outcome: 'REJECTED' });

            // Act
            const result = await executeRefundFromProviderRead(
                { refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
            );

            // Assert
            const after = await executeRows(seeded.refundId, seeded.payment.id);
            expect(result.outcome).toBe('EXECUTED');
            expect(result.paymentEffect?.outcome).toBe('P4');
            expect(after.refund).toMatchObject({
                status: 'EXECUTED',
                executedVia: 'PROVIDER',
                settledBy: null,
                version: before.refund!.version + 1
            });
            expect(after.payment).toMatchObject({
                status: 'PARTIALLY_REFUNDED',
                refundedAmount: 5000,
                version: before.payment!.version + 1
            });
        }
    );

    it.skipIf(skip)(
        '(b) keeps a partial rejection confirmed without moving the payment',
        async () => {
            // Arrange
            const seeded = await confirmedExecuteFixture();
            const accepted = (await executeRows(seeded.refundId, seeded.payment.id)).calls.filter(
                (call) => call.providerRefundId !== null
            );
            expect(accepted).toHaveLength(2);
            await seeded.fixture.provider.rejectRefund({
                chargeId: seeded.charge.chargeId,
                refundId: accepted[1]!.providerRefundId!
            });
            const before = await executeRows(seeded.refundId, seeded.payment.id);

            // Act
            const result = await executeRefundFromProviderRead(
                { refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
            );

            // Assert
            const after = await executeRows(seeded.refundId, seeded.payment.id);
            expect(result).toEqual({
                refundId: seeded.refundId,
                outcome: 'NOT_ACCREDITED_KEPT_CONFIRMED',
                paymentEffect: null
            });
            expect(after.refund).toMatchObject({
                status: 'CONFIRMED',
                version: before.refund!.version
            });
            expect({
                status: after.payment?.status,
                refundedAmount: after.payment?.refundedAmount,
                version: after.payment?.version
            }).toEqual({
                status: before.payment?.status,
                refundedAmount: before.payment?.refundedAmount,
                version: before.payment?.version
            });
        }
    );

    it.skipIf(skip)(
        '(c) ignores an unrelated panel refund even when the charge total matches',
        async () => {
            // Arrange
            const seeded = await refundConfirmFixture(10000, 10000);
            await confirmRefund(
                { actor: seeded.actor, refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
            );
            const accepted = (await executeRows(seeded.refundId, seeded.payment.id)).calls.filter(
                (call) => call.providerRefundId !== null
            );
            expect(accepted).toHaveLength(1);
            await seeded.fixture.provider.rejectRefund({
                chargeId: seeded.charge.chargeId,
                refundId: accepted[0]!.providerRefundId!
            });
            await seeded.fixture.provider.refund({
                chargeId: seeded.charge.chargeId,
                amount: { amountMinor: 10000, currency: 'ARS' },
                reference: `panel-${crypto.randomUUID()}`
            });
            const act = { kind: 'decision' as const, startedAt: seeded.fixture.clock.now() };
            actStartInstant({ act });
            const read = await seeded.fixture.provider.readCharge({
                chargeId: seeded.charge.chargeId
            });
            expect(assertFreshForAct({ read, act }).snapshot.refundedAmount.amountMinor).toBe(
                10000
            );
            const before = await executeRows(seeded.refundId, seeded.payment.id);

            // Act
            const result = await executeRefundFromProviderRead(
                { refundId: seeded.refundId },
                { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
            );

            // Assert
            const after = await executeRows(seeded.refundId, seeded.payment.id);
            expect(result.outcome).toBe('NOT_ACCREDITED_KEPT_CONFIRMED');
            expect(after.refund).toMatchObject({
                status: 'CONFIRMED',
                version: before.refund!.version
            });
            expect({
                status: after.payment?.status,
                refundedAmount: after.payment?.refundedAmount,
                version: after.payment?.version
            }).toEqual({
                status: before.payment?.status,
                refundedAmount: before.payment?.refundedAmount,
                version: before.payment?.version
            });
        }
    );

    it.skipIf(skip)('(d) executes a total refund through P3 and releases coverage', async () => {
        // Arrange
        const seeded = await totalHonestM13Fixture();
        const [coverage] = await getServiceTestDb()
            .select()
            .from(coveredPeriods)
            .where(eq(coveredPeriods.paymentId, seeded.payment.id));

        // Act
        const result = await executeRefundFromProviderRead(
            { refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider: seeded.provider }
        );

        // Assert
        const after = await executeRows(seeded.refundId, seeded.payment.id);
        const [released] = await getServiceTestDb()
            .select()
            .from(coveredPeriods)
            .where(eq(coveredPeriods.id, coverage!.id));
        expect(result.paymentEffect).toMatchObject({
            outcome: 'P3',
            status: 'REFUNDED',
            coverageReleased: true
        });
        expect(after.refund).toMatchObject({ status: 'EXECUTED', executedVia: 'PROVIDER' });
        expect(after.payment).toMatchObject({ status: 'REFUNDED', refundedAmount: 10000 });
        expect(released?.releasedAt).toEqual(seeded.fixture.clock.now());
    });

    it.skipIf(skip)('(e) excludes another open refund from the executed accumulation', async () => {
        // Arrange
        const seeded = await confirmedExecuteFixture();
        const other = await requestRefund(
            {
                source: { kind: 'PAYMENT', id: seeded.payment.id },
                amount: 1000,
                reason: 'REVOCATION'
            },
            { clock: seeded.fixture.clock }
        );

        // Act
        const result = await executeRefundFromProviderRead(
            { refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
        );

        // Assert
        const after = await executeRows(seeded.refundId, seeded.payment.id);
        expect(result.paymentEffect).toMatchObject({ outcome: 'P4', refundedAmount: 5000 });
        expect(after.payment?.refundedAmount).toBe(5000);
        const [otherRow] = await getServiceTestDb()
            .select()
            .from(payments)
            .where(eq(payments.id, seeded.payment.id));
        expect(otherRow?.status).toBe('PARTIALLY_REFUNDED');
        expect(other.refundId).toEqual(expect.any(String));
    });

    it.skipIf(skip)('(f) treats a repeated execution as a normal unchanged result', async () => {
        // Arrange
        const seeded = await confirmedExecuteFixture();
        const ports = { clock: seeded.fixture.clock, provider: seeded.fixture.provider };
        await executeRefundFromProviderRead({ refundId: seeded.refundId }, ports);
        const before = await executeRows(seeded.refundId, seeded.payment.id);

        // Act
        const result = await executeRefundFromProviderRead({ refundId: seeded.refundId }, ports);

        // Assert
        const after = await executeRows(seeded.refundId, seeded.payment.id);
        expect(result.outcome).toBe('NOT_CONFIRMED');
        expect({
            status: after.payment?.status,
            refundedAmount: after.payment?.refundedAmount,
            version: after.payment?.version
        }).toEqual({
            status: before.payment?.status,
            refundedAmount: before.payment?.refundedAmount,
            version: before.payment?.version
        });
    });

    it.skipIf(skip)('(i) resolves a hung reconciliation payment with this refund id', async () => {
        // Arrange
        const seeded = await confirmedExecuteFixture();
        const { mark } = await openReconciliationMark(
            {
                subject: {
                    kind: 'SUBSCRIPTION',
                    subscriptionId: seeded.fixture.started.subscriptionId
                },
                reason: 'COBRO_POSTERIOR_A_LA_BAJA',
                payment: { source: 'PAYMENT', id: seeded.payment.id },
                actor: { type: 'admin', id: seeded.actor.id },
                correlationId: crypto.randomUUID()
            },
            { markPayments: createPaymentReconciliationMarkPayments(seeded.fixture.clock) }
        );

        // Act
        await executeRefundFromProviderRead(
            { refundId: seeded.refundId },
            { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
        );

        // Assert
        const [hung] = await getServiceTestDb()
            .select()
            .from(reconciliationMarkPayments)
            .where(eq(reconciliationMarkPayments.markId, mark.id));
        expect(hung).toMatchObject({
            paymentId: seeded.payment.id,
            refundId: seeded.refundId,
            resolvedAt: seeded.fixture.clock.now()
        });
    });
});
