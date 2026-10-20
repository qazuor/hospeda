/**
 * TEST:B11:27 (AC:B11:27), the half "by the notice": at the cut, a chargeback
 * read on a credited payment only opens reason 17 `CONTRACARGO` with the payment
 * hung, through the one internal chargeback interface. The half "by the check"
 * (the sweep) is run 2 of HOS-1605.
 */
import { reconciliationMarkModel } from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { ChargebackDetection } from '../../../src/services/billing/reconciliation/chargeback/chargeback-detection.js';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import {
    approvedCharge,
    type ChargebackFixture,
    chargebackFixture,
    chargebackMarks,
    deliverChargeNotice,
    paymentOfCharge,
    recordCharge,
    retireChargebackFixtures,
    untouchedState
} from './support/chargeback-fixtures.js';
import { hungRows, resolveHungPayments } from './support/mark-payment-fixtures.js';
import { seedAdminActor, settleOnPayment } from './support/refund-fixtures.js';

afterEach(retireChargebackFixtures);
afterAll(closeServiceTestPool);

/** A subscription with a 10 000 charge credited through `recordChargeFact`. */
async function credited(): Promise<{
    readonly fixture: ChargebackFixture;
    readonly chargeId: string;
    readonly paymentId: string;
}> {
    const fixture = await chargebackFixture();
    const chargeId = await approvedCharge(fixture);
    const result = await recordCharge(fixture, chargeId);
    expect(result.outcome).toBe('CREDITED');
    const payment = await paymentOfCharge(chargeId);
    expect(payment.status).toBe('SUCCEEDED');
    return { fixture, chargeId, paymentId: payment.id };
}

describe('TEST:B11:27 AC:B11:27 by the notice: a chargeback is detected and marked, and nothing else', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        '(a) a SUCCEEDED payment: one reason-17 mark with the payment hung, nothing else moves',
        async () => {
            // Arrange
            const { fixture, chargeId, paymentId } = await credited();
            const before = await untouchedState(fixture);
            const paymentBefore = await paymentOfCharge(chargeId);
            await fixture.provider.chargeBack({ chargeId });

            // Act
            const result = await deliverChargeNotice(fixture, chargeId);

            // Assert
            expect(result).toEqual({ ack: 'OK', outcome: 'CHARGEBACK_MARKED' });
            const marks = await chargebackMarks(fixture.started.subscriptionId);
            expect(marks).toHaveLength(1);
            expect(marks[0]?.liftedAt).toBeNull();
            const hung = await hungRows({ markId: marks[0]?.id as string });
            expect(hung.map((row) => row.payment_id)).toEqual([paymentId]);
            const paymentAfter = await paymentOfCharge(chargeId);
            expect(paymentAfter.status).toBe('SUCCEEDED');
            expect(paymentAfter.refundedAmount).toBe(paymentBefore.refundedAmount);
            const after = await untouchedState(fixture);
            expect(after.subscription).toEqual(before.subscription);
            expect(after.coverage).toEqual(before.coverage);
            expect(after.mailCount).toBe(before.mailCount);
            expect(after.subscriptionEvents).toBe(before.subscriptionEvents);
            expect(after.markOpenedEvents).toBe(before.markOpenedEvents + 1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(b) the second read does not open another mark nor hang the payment again',
        async () => {
            // Arrange
            const { fixture, chargeId } = await credited();
            await fixture.provider.chargeBack({ chargeId });
            await deliverChargeNotice(fixture, chargeId);
            const afterFirst = await untouchedState(fixture);

            // Act
            const again = await deliverChargeNotice(fixture, chargeId);
            const recorded = await recordCharge(fixture, chargeId);

            // Assert
            expect(again).toEqual({ ack: 'OK', outcome: 'CHARGEBACK_MARKED' });
            expect(recorded).toMatchObject({
                outcome: 'CHARGEBACK_DETECTED',
                detection: { outcome: 'ALREADY_MARKED' }
            });
            const marks = await chargebackMarks(fixture.started.subscriptionId);
            expect(marks).toHaveLength(1);
            expect(await hungRows({ markId: marks[0]?.id as string })).toHaveLength(1);
            const afterSecond = await untouchedState(fixture);
            expect(afterSecond.markOpenedEvents).toBe(afterFirst.markOpenedEvents);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(c) once its mark was lifted, a third read does not open another one (H6)',
        async () => {
            // Arrange
            const { fixture, chargeId } = await credited();
            await fixture.provider.chargeBack({ chargeId });
            await deliverChargeNotice(fixture, chargeId);
            const [mark] = await chargebackMarks(fixture.started.subscriptionId);
            if (!mark) throw new Error('expected the reason-17 mark');
            await resolveHungPayments({ markId: mark.id });
            const current = await reconciliationMarkModel.findById({ markId: mark.id });
            const lifted = await reconciliationMarkModel.lift({
                markId: mark.id,
                expectedVersion: current?.version as number,
                liftedBy: fixture.user.id,
                now: fixture.clock.now()
            });
            expect(lifted.outcome).toBe('LIFTED');
            const beforeThird = await untouchedState(fixture);

            // Act
            const recorded = await recordCharge(fixture, chargeId);

            // Assert
            expect(recorded).toMatchObject({
                outcome: 'CHARGEBACK_DETECTED',
                detection: { outcome: 'ALREADY_MARKED' }
            });
            const marks = await chargebackMarks(fixture.started.subscriptionId);
            expect(marks).toHaveLength(1);
            expect(marks[0]?.liftedAt).not.toBeNull();
            const afterThird = await untouchedState(fixture);
            expect(afterThird.markOpenedEvents).toBe(beforeThird.markOpenedEvents);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(d) a PARTIALLY_REFUNDED and a REFUNDED payment each open their mark and keep their state',
        async () => {
            const admin = await seedAdminActor();
            for (const [amount, status] of [
                [3_000, 'PARTIALLY_REFUNDED'],
                [10_000, 'REFUNDED']
            ] as const) {
                // Arrange
                const { fixture, chargeId, paymentId } = await credited();
                const payment = await paymentOfCharge(chargeId);
                await settleOnPayment(admin, { fixture, payment }, { amount });
                expect((await paymentOfCharge(chargeId)).status).toBe(status);
                await fixture.provider.chargeBack({ chargeId });

                // Act
                const result = await deliverChargeNotice(fixture, chargeId);

                // Assert
                expect(result).toEqual({ ack: 'OK', outcome: 'CHARGEBACK_MARKED' });
                const marks = await chargebackMarks(fixture.started.subscriptionId);
                expect(marks).toHaveLength(1);
                expect(
                    (await hungRows({ markId: marks[0]?.id as string })).map((r) => r.payment_id)
                ).toEqual([paymentId]);
                const after = await paymentOfCharge(chargeId);
                expect(after.status).toBe(status);
                expect(after.refundedAmount).toBe(amount);
            }
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(e) a chargeback on a charge we never credited: no mark, the payment stays PENDING without coverage',
        async () => {
            // Arrange
            const fixture = await chargebackFixture();
            const chargeId = await approvedCharge(fixture);
            await fixture.provider.chargeBack({ chargeId });
            const before = await untouchedState(fixture);

            // Act
            const result = await deliverChargeNotice(fixture, chargeId);

            // Assert
            expect(result).toEqual({ ack: 'OK', outcome: 'CHARGEBACK_ON_UNCREDITED' });
            expect(await chargebackMarks(fixture.started.subscriptionId)).toHaveLength(0);
            expect((await paymentOfCharge(chargeId)).status).toBe('PENDING');
            const after = await untouchedState(fixture);
            expect(after.coverage).toEqual(before.coverage);
            expect(after.markOpenedEvents).toBe(before.markOpenedEvents);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(f) a double of the interface sees one call per read of a charged-back charge, none otherwise',
        async () => {
            // Arrange
            const detect = vi.fn(async () => ({ outcome: 'MARKED' as const }));
            const chargebacks: ChargebackDetection = { detect };
            const { fixture, chargeId, paymentId } = await credited();
            await fixture.provider.chargeBack({ chargeId });
            const clean = await approvedCharge(fixture);

            // Act
            await deliverChargeNotice(fixture, chargeId, { chargebacks });
            await recordCharge(fixture, chargeId, { chargebacks });
            await deliverChargeNotice(fixture, clean, { chargebacks });

            // Assert
            expect(detect).toHaveBeenCalledTimes(2);
            for (const [input] of detect.mock.calls as unknown as [
                Parameters<ChargebackDetection['detect']>[0]
            ][])
                expect(input).toMatchObject({ payment: { id: paymentId }, actor: 'provider' });
            expect(await chargebackMarks(fixture.started.subscriptionId)).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'fail closed: a charge refunded in full credits nothing on a payment we never credited',
        async () => {
            // Arrange
            const fixture = await chargebackFixture();
            const chargeId = await approvedCharge(fixture);
            await fixture.provider.refund({
                chargeId,
                amount: { amountMinor: 10_000, currency: 'ARS' },
                reference: `refund-${chargeId}`
            });
            const before = await untouchedState(fixture);

            // Act
            const result = await deliverChargeNotice(fixture, chargeId);

            // Assert
            expect(result).toEqual({ ack: 'OK', outcome: 'REFUNDED_NOT_CREDITED' });
            expect((await paymentOfCharge(chargeId)).status).toBe('PENDING');
            const after = await untouchedState(fixture);
            expect(after.coverage).toEqual(before.coverage);
            expect(after.subscription).toEqual(before.subscription);
        }
    );
});
