import { idempotencyKeys, refundCalls } from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import { requestRefund } from '../../../src/services/billing/refund/request-refund.service.js';
import { settleExternalRefund } from '../../../src/services/billing/refund/settle-external-refund.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    creditedPayment,
    manualPaymentWithCoverage,
    paymentRow,
    pendingPayment,
    refundsOfManualPayment,
    refundsOfPayment,
    seedAdminActor,
    settleOnPayment
} from './support/refund-fixtures.js';

afterAll(closeServiceTestPool);

describe('TEST:B5:6 AC:B5:12 a refund id lives in one row; balance and state guards', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'AC:B5:12 (j) a panel reference settles once (also against refund_call); a transfer receipt may repeat',
        async () => {
            // Arrange
            const credited = await creditedPayment();
            const other = await creditedPayment();
            const admin = await seedAdminActor();
            const panel = `panel-${crypto.randomUUID()}`;
            await settleOnPayment(admin, credited, {
                amount: 1000,
                channel: 'PROVIDER_PANEL',
                reference: panel
            });
            const called = `called-${crypto.randomUUID()}`;
            const host = await requestRefund(
                {
                    source: { kind: 'PAYMENT', id: other.payment.id },
                    amount: 500,
                    reason: 'REVOCATION'
                },
                { clock: other.fixture.clock }
            );
            const key = `refund-create-${crypto.randomUUID()}`;
            await getServiceTestDb()
                .insert(idempotencyKeys)
                .values({ key, operation: 'REFUND_CREATE', subjectId: host.refundId });
            await getServiceTestDb().insert(refundCalls).values({
                refundId: host.refundId,
                idempotencyKey: key,
                providerRefundId: called,
                amount: 500
            });
            const before = {
                credited: await refundsOfPayment(credited.payment.id),
                other: await refundsOfPayment(other.payment.id)
            };

            // Act
            const samePayment = () =>
                settleOnPayment(admin, credited, {
                    amount: 1000,
                    channel: 'PROVIDER_PANEL',
                    reference: panel
                });
            const otherPayment = () =>
                settleOnPayment(admin, other, {
                    amount: 1000,
                    channel: 'PROVIDER_PANEL',
                    reference: panel
                });
            const againstCall = () =>
                settleOnPayment(admin, credited, {
                    amount: 1000,
                    channel: 'PROVIDER_PANEL',
                    reference: called
                });

            // Assert
            for (const attempt of [samePayment, otherPayment, againstCall])
                await expect(attempt()).rejects.toMatchObject({
                    code: 'ALREADY_EXISTS',
                    reason: 'EXTERNAL_REFERENCE_ALREADY_SETTLED'
                });
            expect(await refundsOfPayment(credited.payment.id)).toEqual(before.credited);
            expect(await refundsOfPayment(other.payment.id)).toEqual(before.other);
            const receipt = `op-${crypto.randomUUID()}`;
            await settleOnPayment(admin, credited, { amount: 1000, reference: receipt });
            await settleOnPayment(admin, credited, { amount: 1000, reference: receipt });
            expect(
                (await refundsOfPayment(credited.payment.id)).filter(
                    (row) => row.externalRef === receipt
                )
            ).toHaveLength(2);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'AC:B5:10 (l) REFUND_EXCEEDS_BALANCE, PAYMENT_NOT_REFUNDABLE and MANUAL_PAYMENT_SCOPE_REQUIRED write nothing',
        async () => {
            // Arrange
            const credited = await creditedPayment();
            const pending = await pendingPayment();
            const manual = await manualPaymentWithCoverage();
            const admin = await seedAdminActor();
            await settleOnPayment(admin, credited, { amount: 4000 });
            const paymentBefore = await paymentRow(credited.payment.id);

            // Act
            const overBalance = () => settleOnPayment(admin, credited, { amount: 6001 });
            const notRefundable = () =>
                settleExternalRefund(
                    {
                        actor: admin,
                        source: { kind: 'PAYMENT', id: pending.payment.id },
                        amount: 100,
                        channel: 'BANK_TRANSFER',
                        reference: 'op-1',
                        reason: 'OUT_OF_FLOW_REFUND'
                    },
                    { clock: pending.fixture.clock }
                );
            const noScope = () =>
                settleExternalRefund(
                    {
                        actor: admin,
                        source: { kind: 'MANUAL_PAYMENT', id: manual.manual.id },
                        amount: 100,
                        channel: 'BANK_TRANSFER',
                        reference: 'op-1',
                        reason: 'MANUAL_PAYMENT_REFUND'
                    },
                    { clock: manual.fixture.clock }
                );
            const scopeOnPayment = () =>
                settleOnPayment(admin, credited, {
                    amount: 100,
                    manualPaymentScope: 'TOTAL'
                });

            // Assert
            await expect(overBalance()).rejects.toMatchObject({
                code: 'VALIDATION_ERROR',
                reason: 'REFUND_EXCEEDS_BALANCE'
            });
            await expect(notRefundable()).rejects.toMatchObject({
                code: 'ALREADY_EXISTS',
                reason: 'PAYMENT_NOT_REFUNDABLE'
            });
            await expect(noScope()).rejects.toMatchObject({
                code: 'VALIDATION_ERROR',
                reason: 'MANUAL_PAYMENT_SCOPE_REQUIRED'
            });
            await expect(scopeOnPayment()).rejects.toMatchObject({
                code: 'VALIDATION_ERROR',
                reason: 'MANUAL_PAYMENT_SCOPE_NOT_ALLOWED'
            });
            expect(await refundsOfPayment(credited.payment.id)).toHaveLength(1);
            expect(await paymentRow(credited.payment.id)).toEqual(paymentBefore);
            expect(await refundsOfPayment(pending.payment.id)).toEqual([]);
            expect(await refundsOfManualPayment(manual.manual.id)).toEqual([]);
        }
    );
});
