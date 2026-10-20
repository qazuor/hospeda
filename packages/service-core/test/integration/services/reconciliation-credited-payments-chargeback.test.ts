/**
 * TEST:B11:27 (AC:B11:27), the half "by the check": a credited payment the
 * provider gives as charged back goes to the one internal chargeback interface
 * and nothing else. Split from reconciliation-credited-payments.test.ts.
 */

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import {
    chargebackMarks,
    deliverChargeNotice,
    paymentOfCharge,
    retireChargebackFixtures,
    untouchedState
} from './support/chargeback-fixtures.js';
import {
    creditedCharge,
    markOpenedEvents,
    outOfFlowMarks,
    providerRefund,
    seededPaymentIds,
    sweep
} from './support/credited-payments-fixtures.js';
import { hungRows } from './support/mark-payment-fixtures.js';
import { seedAdminActor, settleOnPayment } from './support/refund-fixtures.js';

const skip = !isServiceTestDbAvailable();

afterEach(async () => {
    seededPaymentIds.clear();
    vi.restoreAllMocks();
    await retireChargebackFixtures();
});
afterAll(closeServiceTestPool);

describe('TEST:B11:27 AC:B11:27 by the check: a chargeback is detected and marked, and nothing else', () => {
    it.skipIf(skip)(
        '(j) a SUCCEEDED payment charged back (and refunded): reason 17, never 18, nothing else moves',
        async () => {
            // Arrange
            const { fixture, chargeId, payment } = await creditedCharge();
            await providerRefund(fixture, chargeId, 10_000);
            await fixture.provider.chargeBack({ chargeId });
            const before = await untouchedState(fixture);

            // Act
            const summary = await sweep(fixture);

            // Assert
            const marks = await chargebackMarks(fixture.started.subscriptionId);
            expect(marks).toHaveLength(1);
            expect(
                (await hungRows({ markId: marks[0]?.id as string })).map((r) => r.payment_id)
            ).toEqual([payment.id]);
            expect(await outOfFlowMarks(fixture.started.subscriptionId)).toHaveLength(0);
            expect(await paymentOfCharge(chargeId)).toEqual(payment);
            const after = await untouchedState(fixture);
            expect(after.subscription).toEqual(before.subscription);
            expect(after.coverage).toEqual(before.coverage);
            expect(after.mailCount).toBe(before.mailCount);
            expect(after.subscriptionEvents).toBe(before.subscriptionEvents);
            expect(summary.creditedPayments).toMatchObject({ chargebacks: 1, outOfFlowRefunds: 0 });
        }
    );

    it.skipIf(skip)(
        '(k) a REFUNDED payment charged back: reason 17, it stays REFUNDED',
        async () => {
            // Arrange
            const admin = await seedAdminActor();
            const { fixture, chargeId, payment } = await creditedCharge();
            await settleOnPayment(admin, { fixture, payment }, { amount: 10_000 });
            await providerRefund(fixture, chargeId, 10_000);
            await fixture.provider.chargeBack({ chargeId });

            // Act
            await sweep(fixture);

            // Assert
            const marks = await chargebackMarks(fixture.started.subscriptionId);
            expect(marks).toHaveLength(1);
            expect(
                (await hungRows({ markId: marks[0]?.id as string })).map((r) => r.payment_id)
            ).toEqual([payment.id]);
            expect((await paymentOfCharge(chargeId)).status).toBe('REFUNDED');
        }
    );

    it.skipIf(skip)('(l) a second run opens no other mark', async () => {
        // Arrange
        const { fixture, chargeId } = await creditedCharge();
        await fixture.provider.chargeBack({ chargeId });
        await sweep(fixture);
        vi.restoreAllMocks();
        const before = await markOpenedEvents(fixture.started.subscriptionId);

        // Act
        const second = await sweep(fixture);

        // Assert
        expect(second.complete).toBe(true);
        expect(await chargebackMarks(fixture.started.subscriptionId)).toHaveLength(1);
        expect(await markOpenedEvents(fixture.started.subscriptionId)).toBe(before);
    });

    it.skipIf(skip)(
        '(m) a double of the interface sees one call per charged-back payment and run, as the job',
        async () => {
            // Arrange
            const detect = vi.fn(async () => ({ outcome: 'MARKED' as const }));
            const charged = await creditedCharge();
            await charged.fixture.provider.chargeBack({ chargeId: charged.chargeId });
            await creditedCharge(charged.fixture);

            // Act
            await sweep(charged.fixture, { chargebacks: { detect } });

            // Assert
            expect(detect).toHaveBeenCalledTimes(1);
            expect(detect).toHaveBeenCalledWith(
                expect.objectContaining({
                    payment: expect.objectContaining({ id: charged.payment.id }),
                    actor: 'job'
                })
            );
            expect(await chargebackMarks(charged.fixture.started.subscriptionId)).toHaveLength(0);
        }
    );

    it.skipIf(skip)(
        '(n) the notice and then the sweep reach the same interface: one mark, one hung row',
        async () => {
            // Arrange
            const { fixture, chargeId } = await creditedCharge();
            await fixture.provider.chargeBack({ chargeId });
            expect(await deliverChargeNotice(fixture, chargeId)).toEqual({
                ack: 'OK',
                outcome: 'CHARGEBACK_MARKED'
            });

            // Act
            const summary = await sweep(fixture);

            // Assert
            expect(summary.complete).toBe(true);
            const marks = await chargebackMarks(fixture.started.subscriptionId);
            expect(marks).toHaveLength(1);
            expect(await hungRows({ markId: marks[0]?.id as string })).toHaveLength(1);
        }
    );
});
