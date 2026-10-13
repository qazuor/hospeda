import { coveredPeriods, eq } from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import { requestRefund } from '../../../src/services/billing/refund/request-refund.service.js';
import { settleExternalRefund } from '../../../src/services/billing/refund/settle-external-refund.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    creditedPayment,
    manualPaymentWithCoverage,
    paymentRow,
    refundById,
    refundsOfManualPayment,
    refundsOfPayment,
    seedAdminActor,
    settleOnPayment
} from './support/refund-fixtures.js';

afterAll(closeServiceTestPool);

async function coverageOfPayment(paymentId: string) {
    const [row] = await getServiceTestDb()
        .select()
        .from(coveredPeriods)
        .where(eq(coveredPeriods.paymentId, paymentId));
    return row;
}

describe('TEST:B5:6 AC:B5:10 RF4 settles an out-of-flow refund born EXECUTED', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'AC:B5:10 (a) total by bank transfer: EXECUTED, external, who and where; P3 releases the coverage',
        async () => {
            // Arrange
            const credited = await creditedPayment();
            const admin = await seedAdminActor();
            const reference = `transfer-${crypto.randomUUID()}`;

            // Act
            const result = await settleOnPayment(admin, credited, { reference });

            // Assert
            expect(result).toMatchObject({
                subjectId: credited.fixture.user.id,
                closedRequestedRefundId: null,
                paymentOutcome: 'P3',
                coverageReleased: true
            });
            expect(await refundById(result.refundId)).toMatchObject({
                status: 'EXECUTED',
                executedVia: 'EXTERNAL',
                externalChannel: 'BANK_TRANSFER',
                externalRef: reference,
                settledBy: admin.id,
                confirmedBy: null,
                amount: 10000,
                reason: 'OUT_OF_FLOW_REFUND',
                paymentId: credited.payment.id
            });
            expect(await paymentRow(credited.payment.id)).toMatchObject({
                status: 'REFUNDED',
                refundedAmount: 10000
            });
            expect((await coverageOfPayment(credited.payment.id))?.releasedAt).toEqual(
                credited.fixture.clock.now()
            );
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'AC:B5:10 (b) a 4000 panel partial is P4 with coverage open; a 6000 second partial is P5 to REFUNDED',
        async () => {
            // Arrange
            const credited = await creditedPayment();
            const admin = await seedAdminActor();

            // Act
            const first = await settleOnPayment(admin, credited, {
                amount: 4000,
                channel: 'PROVIDER_PANEL',
                reference: `panel-${crypto.randomUUID()}`
            });
            const afterFirst = await paymentRow(credited.payment.id);
            const coverageAfterFirst = await coverageOfPayment(credited.payment.id);
            const second = await settleOnPayment(admin, credited, {
                amount: 6000,
                channel: 'PROVIDER_PANEL',
                reference: `panel-${crypto.randomUUID()}`
            });

            // Assert
            expect(first).toMatchObject({ paymentOutcome: 'P4', coverageReleased: false });
            expect(afterFirst).toMatchObject({
                status: 'PARTIALLY_REFUNDED',
                refundedAmount: 4000
            });
            expect(coverageAfterFirst?.releasedAt).toBeNull();
            expect(second).toMatchObject({ paymentOutcome: 'P5', coverageReleased: true });
            expect(await paymentRow(credited.payment.id)).toMatchObject({
                status: 'REFUNDED',
                refundedAmount: 10000
            });
            expect(
                (await refundsOfPayment(credited.payment.id)).map((row) => row.externalChannel)
            ).toEqual(['PROVIDER_PANEL', 'PROVIDER_PANEL']);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'AC:B5:10 (c) a manual payment: TOTAL releases its coverage, PARTIAL does not',
        async () => {
            // Arrange
            const total = await manualPaymentWithCoverage();
            const partial = await manualPaymentWithCoverage();
            const admin = await seedAdminActor();
            const settle = (
                target: Awaited<ReturnType<typeof manualPaymentWithCoverage>>,
                manualPaymentScope: 'TOTAL' | 'PARTIAL'
            ) =>
                settleExternalRefund(
                    {
                        actor: admin,
                        source: { kind: 'MANUAL_PAYMENT', id: target.manual.id },
                        amount: 25000,
                        channel: 'BANK_TRANSFER',
                        reference: `manual-${crypto.randomUUID()}`,
                        reason: 'MANUAL_PAYMENT_REFUND',
                        manualPaymentScope
                    },
                    { clock: target.fixture.clock }
                );
            const coverage = async (id: string | null) =>
                (
                    await getServiceTestDb()
                        .select()
                        .from(coveredPeriods)
                        .where(eq(coveredPeriods.id, id ?? crypto.randomUUID()))
                )[0];

            // Act
            const totalResult = await settle(total, 'TOTAL');
            const partialResult = await settle(partial, 'PARTIAL');

            // Assert
            expect(totalResult).toMatchObject({
                paymentOutcome: null,
                coverageReleased: true,
                subjectId: total.fixture.user.id
            });
            expect(await refundsOfManualPayment(total.manual.id)).toEqual([
                expect.objectContaining({
                    status: 'EXECUTED',
                    executedVia: 'EXTERNAL',
                    externalChannel: 'BANK_TRANSFER',
                    settledBy: admin.id,
                    manualPaymentId: total.manual.id,
                    paymentId: null
                })
            ]);
            expect((await coverage(total.coverageId))?.releasedAt).toEqual(
                total.fixture.clock.now()
            );
            expect(partialResult).toMatchObject({ paymentOutcome: null, coverageReleased: false });
            expect((await coverage(partial.coverageId))?.releasedAt).toBeNull();
        }
    );
});

describe('TEST:B5:6 AC:B5:41 RF4 closes the open REQUESTED of RF1', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'AC:B5:41 (d) same amount by panel: THAT row becomes EXECUTED, keeps its reason, no second row',
        async () => {
            // Arrange
            const credited = await creditedPayment();
            const admin = await seedAdminActor();
            const { refundId } = await requestRefund(
                {
                    source: { kind: 'PAYMENT', id: credited.payment.id },
                    amount: 10000,
                    reason: 'REVOCATION'
                },
                { clock: credited.fixture.clock }
            );
            const reference = `panel-${crypto.randomUUID()}`;

            // Act
            const result = await settleOnPayment(admin, credited, {
                channel: 'PROVIDER_PANEL',
                reference
            });

            // Assert
            expect(result).toMatchObject({
                refundId,
                closedRequestedRefundId: refundId,
                paymentOutcome: 'P3'
            });
            const rows = await refundsOfPayment(credited.payment.id);
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({
                id: refundId,
                status: 'EXECUTED',
                version: 2,
                reason: 'REVOCATION',
                executedVia: 'EXTERNAL',
                externalChannel: 'PROVIDER_PANEL',
                externalRef: reference,
                settledBy: admin.id,
                confirmedBy: null
            });
            expect((await paymentRow(credited.payment.id))?.status).toBe('REFUNDED');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'AC:B5:41 (e) a different amount without a choice is REQUESTED_AMOUNT_MISMATCH and changes nothing',
        async () => {
            // Arrange
            const credited = await creditedPayment();
            const admin = await seedAdminActor();
            const { refundId } = await requestRefund(
                {
                    source: { kind: 'PAYMENT', id: credited.payment.id },
                    amount: 10000,
                    reason: 'REVOCATION'
                },
                { clock: credited.fixture.clock }
            );
            const requestedBefore = await refundById(refundId);
            const paymentBefore = await paymentRow(credited.payment.id);

            // Act
            const attempt = () => settleOnPayment(admin, credited, { amount: 5000 });

            // Assert
            await expect(attempt()).rejects.toMatchObject({
                code: 'ALREADY_EXISTS',
                reason: 'REQUESTED_AMOUNT_MISMATCH',
                message: 'Settled amount 5000 differs from the requested 10000'
            });
            expect(await refundsOfPayment(credited.payment.id)).toEqual([requestedBefore]);
            expect(await paymentRow(credited.payment.id)).toEqual(paymentBefore);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'AC:B5:41 (f) CLOSE_WITH_SETTLED_AMOUNT closes the same row for the settled amount: P4',
        async () => {
            // Arrange
            const credited = await creditedPayment();
            const admin = await seedAdminActor();
            const { refundId } = await requestRefund(
                {
                    source: { kind: 'PAYMENT', id: credited.payment.id },
                    amount: 10000,
                    reason: 'REVOCATION'
                },
                { clock: credited.fixture.clock }
            );

            // Act
            const result = await settleOnPayment(admin, credited, {
                amount: 5000,
                onAmountMismatch: 'CLOSE_WITH_SETTLED_AMOUNT'
            });

            // Assert
            expect(result).toMatchObject({ refundId, closedRequestedRefundId: refundId });
            expect(await refundsOfPayment(credited.payment.id)).toEqual([
                expect.objectContaining({ id: refundId, status: 'EXECUTED', amount: 5000 })
            ]);
            expect(await paymentRow(credited.payment.id)).toMatchObject({
                status: 'PARTIALLY_REFUNDED',
                refundedAmount: 5000
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'AC:B5:41 (g) SETTLE_SEPARATELY gives birth to another EXECUTED row and leaves the REQUESTED open',
        async () => {
            // Arrange
            const credited = await creditedPayment();
            const admin = await seedAdminActor();
            // HOS-1680: the open REQUESTED claims part of the balance; the separate settlement must fit in the rest.
            const { refundId } = await requestRefund(
                {
                    source: { kind: 'PAYMENT', id: credited.payment.id },
                    amount: 6000,
                    reason: 'REVOCATION'
                },
                { clock: credited.fixture.clock }
            );

            // Act
            const result = await settleOnPayment(admin, credited, {
                amount: 3000,
                onAmountMismatch: 'SETTLE_SEPARATELY'
            });

            // Assert
            expect(result.refundId).not.toBe(refundId);
            expect(result.closedRequestedRefundId).toBeNull();
            expect((await refundById(refundId))?.status).toBe('REQUESTED');
            expect(await refundById(result.refundId)).toMatchObject({
                status: 'EXECUTED',
                amount: 3000,
                reason: 'OUT_OF_FLOW_REFUND'
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'AC:B5:41 (h) two open REQUESTED: ambiguous without refundId; with it, closes that one',
        async () => {
            // Arrange
            const credited = await creditedPayment();
            const admin = await seedAdminActor();
            const request = (amount: number) =>
                requestRefund(
                    {
                        source: { kind: 'PAYMENT', id: credited.payment.id },
                        amount,
                        reason: 'MARK_PROPOSAL'
                    },
                    { clock: credited.fixture.clock }
                );
            const first = await request(4000);
            const second = await request(6000);

            // Act
            const ambiguous = settleOnPayment(admin, credited, { amount: 6000 });

            // Assert
            await expect(ambiguous).rejects.toMatchObject({
                code: 'ALREADY_EXISTS',
                reason: 'OPEN_REQUESTS_AMBIGUOUS'
            });
            const named = await settleOnPayment(admin, credited, {
                amount: 6000,
                refundId: second.refundId
            });
            expect(named.closedRequestedRefundId).toBe(second.refundId);
            expect((await refundById(second.refundId))?.status).toBe('EXECUTED');
            expect((await refundById(first.refundId))?.status).toBe('REQUESTED');
            expect(await refundsOfPayment(credited.payment.id)).toHaveLength(2);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'AC:B5:41 (i) a refundId of another payment is REFUND_NOT_FOUND; of an EXECUTED row, REFUND_NOT_OPEN',
        async () => {
            // Arrange
            const credited = await creditedPayment();
            const other = await creditedPayment();
            const admin = await seedAdminActor();
            const foreign = await requestRefund(
                {
                    source: { kind: 'PAYMENT', id: other.payment.id },
                    amount: 1000,
                    reason: 'REVOCATION'
                },
                { clock: other.fixture.clock }
            );
            const executed = await settleOnPayment(admin, credited, { amount: 1000 });

            // Act
            const onForeign = () =>
                settleOnPayment(admin, credited, {
                    amount: 1000,
                    refundId: foreign.refundId
                });
            const onExecuted = () =>
                settleOnPayment(admin, credited, {
                    amount: 1000,
                    refundId: executed.refundId
                });

            // Assert
            await expect(onForeign()).rejects.toMatchObject({
                code: 'NOT_FOUND',
                reason: 'REFUND_NOT_FOUND'
            });
            await expect(onExecuted()).rejects.toMatchObject({
                code: 'ALREADY_EXISTS',
                reason: 'REFUND_NOT_OPEN'
            });
            expect(await refundsOfPayment(credited.payment.id)).toHaveLength(1);
            expect((await refundById(foreign.refundId))?.status).toBe('REQUESTED');
        }
    );
});
