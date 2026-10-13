import type { DrizzleClient } from '@repo/db';
import { inArray, refundCalls, refunds } from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import { requestRefund } from '../../../src/services/billing/refund/request-refund.service.js';
import { settleExternalRefund } from '../../../src/services/billing/refund/settle-external-refund.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    creditedPayment,
    manualPaymentWithCoverage,
    moneySnapshot,
    pendingPayment,
    refundById,
    refundsOfManualPayment,
    refundsOfPayment,
    seedAdminActor
} from './support/refund-fixtures.js';

afterAll(closeServiceTestPool);

async function callsOf(refundIds: readonly string[]) {
    return getServiceTestDb()
        .select()
        .from(refundCalls)
        .where(inArray(refundCalls.refundId, [...refundIds]));
}

describe('TEST:B5:6 AC:B5:9 RF1 is born REQUESTED and moves nothing', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'AC:B5:9 (a) on a credited payment: REQUESTED with amount, reason and payment_id; payment, subscription and coverage untouched',
        async () => {
            // Arrange
            const { fixture, payment } = await creditedPayment();
            const scope = { paymentId: payment.id, subscriptionId: fixture.started.subscriptionId };
            const before = await moneySnapshot(scope);

            // Act
            const { refundId } = await requestRefund(
                {
                    source: { kind: 'PAYMENT', id: payment.id },
                    amount: 10000,
                    reason: 'REVOCATION'
                },
                { clock: fixture.clock }
            );

            // Assert
            expect(await moneySnapshot(scope)).toEqual(before);
            expect(before.payment?.status).toBe('SUCCEEDED');
            expect(before.coverage).toHaveLength(1);
            expect(await refundById(refundId)).toMatchObject({
                status: 'REQUESTED',
                amount: 10000,
                reason: 'REVOCATION',
                paymentId: payment.id,
                manualPaymentId: null,
                executedVia: null,
                externalChannel: null,
                externalRef: null,
                settledBy: null,
                confirmedBy: null,
                version: 1
            });
            expect(await callsOf([refundId])).toEqual([]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'AC:B5:9 (b) on a REGISTERED manual payment: REQUESTED with manual_payment_id; coverage untouched',
        async () => {
            // Arrange
            const { fixture, manual } = await manualPaymentWithCoverage();
            const scope = {
                manualPaymentId: manual.id,
                subscriptionId: fixture.started.subscriptionId
            };
            const before = await moneySnapshot(scope);

            // Act
            const { refundId } = await requestRefund(
                {
                    source: { kind: 'MANUAL_PAYMENT', id: manual.id },
                    amount: 25000,
                    reason: 'MARK_PROPOSAL'
                },
                { clock: fixture.clock }
            );

            // Assert
            expect(await moneySnapshot(scope)).toEqual(before);
            expect(before.coverage[0]?.releasedAt).toBeNull();
            expect(await refundById(refundId)).toMatchObject({
                status: 'REQUESTED',
                amount: 25000,
                reason: 'MARK_PROPOSAL',
                paymentId: null,
                manualPaymentId: manual.id,
                executedVia: null,
                settledBy: null
            });
            expect(await callsOf([refundId])).toEqual([]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'AC:B5:9 (c) rejects REFUND_EXCEEDS_BALANCE over a payment with an EXECUTED partial',
        async () => {
            // Arrange
            const { fixture, payment } = await creditedPayment();
            const admin = await seedAdminActor();
            await settleExternalRefund(
                {
                    actor: admin,
                    source: { kind: 'PAYMENT', id: payment.id },
                    amount: 4000,
                    channel: 'BANK_TRANSFER',
                    reference: `op-${crypto.randomUUID()}`,
                    reason: 'OUT_OF_FLOW_REFUND'
                },
                { clock: fixture.clock }
            );

            // Act
            const attempt = requestRefund(
                { source: { kind: 'PAYMENT', id: payment.id }, amount: 6001, reason: 'REVOCATION' },
                { clock: fixture.clock }
            );

            // Assert
            await expect(attempt).rejects.toMatchObject({
                code: 'VALIDATION_ERROR',
                reason: 'REFUND_EXCEEDS_BALANCE'
            });
            expect(await refundsOfPayment(payment.id)).toHaveLength(1);
            const exact = await requestRefund(
                { source: { kind: 'PAYMENT', id: payment.id }, amount: 6000, reason: 'REVOCATION' },
                { clock: fixture.clock }
            );
            expect((await refundById(exact.refundId))?.status).toBe('REQUESTED');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'AC:B5:9 (d) rejects PAYMENT_NOT_REFUNDABLE on a PENDING payment and an AWAITING manual payment',
        async () => {
            // Arrange
            const { fixture, payment } = await pendingPayment();
            const { manual } = await manualPaymentWithCoverage('AWAITING');

            // Act
            const onPayment = requestRefund(
                { source: { kind: 'PAYMENT', id: payment.id }, amount: 100, reason: 'REVOCATION' },
                { clock: fixture.clock }
            );
            const onManual = requestRefund(
                {
                    source: { kind: 'MANUAL_PAYMENT', id: manual.id },
                    amount: 100,
                    reason: 'MARK_PROPOSAL'
                },
                { clock: fixture.clock }
            );

            // Assert
            await expect(onPayment).rejects.toMatchObject({
                code: 'ALREADY_EXISTS',
                reason: 'PAYMENT_NOT_REFUNDABLE'
            });
            await expect(onManual).rejects.toMatchObject({
                code: 'ALREADY_EXISTS',
                reason: 'PAYMENT_NOT_REFUNDABLE'
            });
            expect(await refundsOfPayment(payment.id)).toEqual([]);
            expect(await refundsOfManualPayment(manual.id)).toEqual([]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'AC:B5:9 (e) runs in the caller transaction: a rollback leaves no row',
        async () => {
            // Arrange
            const { fixture, payment } = await creditedPayment();
            let refundId: string | null = null;

            // Act
            const outer = getServiceTestDb().transaction(async (tx) => {
                const created = await requestRefund(
                    {
                        source: { kind: 'PAYMENT', id: payment.id },
                        amount: 10000,
                        reason: 'REVOCATION'
                    },
                    { clock: fixture.clock, tx: tx as unknown as DrizzleClient }
                );
                refundId = created.refundId;
                const [visible] = await tx
                    .select()
                    .from(refunds)
                    .where(inArray(refunds.id, [created.refundId]));
                expect(visible?.status).toBe('REQUESTED');
                throw new Error('rollback outer transaction');
            });

            // Assert
            await expect(outer).rejects.toThrow('rollback outer transaction');
            expect(refundId).not.toBeNull();
            expect(await refundsOfPayment(payment.id)).toEqual([]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'AC:B5:9 rejects a non-positive or fractional amount and a missing source',
        async () => {
            // Arrange
            const { fixture, payment } = await creditedPayment();

            // Act / Assert
            for (const amount of [0, -5, 10.5])
                await expect(
                    requestRefund(
                        {
                            source: { kind: 'PAYMENT', id: payment.id },
                            amount,
                            reason: 'REVOCATION'
                        },
                        { clock: fixture.clock }
                    )
                ).rejects.toMatchObject({
                    code: 'VALIDATION_ERROR',
                    reason: 'REFUND_AMOUNT_INVALID'
                });
            await expect(
                requestRefund(
                    {
                        source: { kind: 'PAYMENT', id: crypto.randomUUID() },
                        amount: 100,
                        reason: 'REVOCATION'
                    },
                    { clock: fixture.clock }
                )
            ).rejects.toMatchObject({ code: 'NOT_FOUND', reason: 'REFUND_SOURCE_NOT_FOUND' });
            expect(await refundsOfPayment(payment.id)).toEqual([]);
        }
    );
});
