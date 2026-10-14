/**
 * TEST:B11:11 (AC:B11:12): the daily sweep re-reads every credited subscription
 * payment inside the PLAZO:18 window by id; a refund the provider shows beyond
 * what our flow claims opens reason 18 without suspending. The chargeback half
 * ("by the check" of TEST:B11:27) is in reconciliation-credited-payments-chargeback.test.ts.
 */
import { refunds } from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { requestRefund } from '../../../src/services/billing/refund/request-refund.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    paymentOfCharge,
    retireChargebackFixtures,
    untouchedState
} from './support/chargeback-fixtures.js';
import {
    creditedCharge,
    DAY_MS,
    markOpenedEvents,
    outOfFlowMarks,
    providerRefund,
    refundCount,
    seededPaymentIds,
    seedPayment,
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

describe('TEST:B11:11 AC:B11:12 credited payments refunded outside our flow', () => {
    it.skipIf(skip)(
        '(a) day 30, refunded in full at the provider: one reason 18 with the payment hung, no suspension',
        async () => {
            // Arrange
            const { fixture, chargeId, payment } = await creditedCharge();
            fixture.clock.advance({ ms: 30 * DAY_MS });
            await providerRefund(fixture, chargeId, 10_000);
            const before = await untouchedState(fixture);

            // Act
            const summary = await sweep(fixture);

            // Assert
            const marks = await outOfFlowMarks(fixture.started.subscriptionId);
            expect(marks).toHaveLength(1);
            expect(
                (await hungRows({ markId: marks[0]?.id as string })).map((r) => r.payment_id)
            ).toEqual([payment.id]);
            const after = await untouchedState(fixture);
            expect(after.subscription).toEqual(before.subscription);
            expect(after.subscription?.status).toBe('ACTIVE');
            expect(await paymentOfCharge(chargeId)).toEqual(payment);
            expect(await refundCount(payment.id)).toBe(0);
            expect(summary.creditedPayments?.outOfFlowRefunds).toBe(1);
            expect(summary.complete).toBe(true);
        }
    );

    it.skipIf(skip)(
        '(b) a PENDING refund of ours covers the provider refund; a smaller one does not',
        async () => {
            // Arrange: our REQUESTED refund covers what the provider refunded
            const covered = await creditedCharge();
            await requestRefund(
                {
                    source: { kind: 'PAYMENT', id: covered.payment.id },
                    amount: 10_000,
                    reason: 'REVOCATION'
                },
                { clock: covered.fixture.clock }
            );
            await providerRefund(covered.fixture, covered.chargeId, 10_000);

            // Act
            const coveredRun = await sweep(covered.fixture);

            // Assert: our flow waiting for its settlement, not an out-of-flow refund
            expect(coveredRun.complete).toBe(true);
            expect(coveredRun.creditedPayments).toMatchObject({ examined: 1, outOfFlowRefunds: 0 });
            expect(await outOfFlowMarks(covered.fixture.started.subscriptionId)).toHaveLength(0);

            // Arrange: a smaller REQUESTED refund (each fixture has its own fake)
            seededPaymentIds.clear();
            const short = await creditedCharge();
            await requestRefund(
                {
                    source: { kind: 'PAYMENT', id: short.payment.id },
                    amount: 4_000,
                    reason: 'REVOCATION'
                },
                { clock: short.fixture.clock }
            );
            await providerRefund(short.fixture, short.chargeId, 10_000);

            // Act
            const shortRun = await sweep(short.fixture);

            // Assert
            expect(shortRun.creditedPayments?.outOfFlowRefunds).toBe(1);
            expect(await outOfFlowMarks(short.fixture.started.subscriptionId)).toHaveLength(1);
        }
    );

    it.skipIf(skip)(
        '(c) an EXECUTED refund of ours equal to the provider refund is nothing; more at the provider opens 18',
        async () => {
            // Arrange
            const admin = await seedAdminActor();
            const { fixture, chargeId, payment } = await creditedCharge();
            await settleOnPayment(admin, { fixture, payment }, { amount: 3_000 });
            await providerRefund(fixture, chargeId, 3_000);

            // Act
            const first = await sweep(fixture);
            vi.restoreAllMocks();
            await providerRefund(fixture, chargeId, 1_000);
            const second = await sweep(fixture);

            // Assert
            expect(first.creditedPayments?.outOfFlowRefunds).toBe(0);
            expect(second.creditedPayments?.outOfFlowRefunds).toBe(1);
            expect(await outOfFlowMarks(fixture.started.subscriptionId)).toHaveLength(1);
        }
    );

    it.skipIf(skip)(
        '(d) a FAILED refund claims nothing: the provider refund opens 18',
        async () => {
            // Arrange
            const { fixture, chargeId, payment } = await creditedCharge();
            await getServiceTestDb().insert(refunds).values({
                paymentId: payment.id,
                amount: 10_000,
                reason: 'REVOCATION',
                status: 'FAILED'
            });
            await providerRefund(fixture, chargeId, 10_000);

            // Act
            const summary = await sweep(fixture);

            // Assert
            expect(summary.creditedPayments?.outOfFlowRefunds).toBe(1);
            expect(await outOfFlowMarks(fixture.started.subscriptionId)).toHaveLength(1);
        }
    );

    it.skipIf(skip)(
        '(e) less refunded at the provider than our EXECUTED refund is nothing',
        async () => {
            // Arrange
            const admin = await seedAdminActor();
            const { fixture, payment } = await creditedCharge();
            await settleOnPayment(admin, { fixture, payment }, { amount: 5_000 });

            // Act
            const summary = await sweep(fixture);

            // Assert
            expect(summary.creditedPayments).toMatchObject({ examined: 1, outOfFlowRefunds: 0 });
            expect(await outOfFlowMarks(fixture.started.subscriptionId)).toHaveLength(0);
        }
    );

    it.skipIf(skip)(
        '(f) the window: 31 days ago is not re-read, 29 days ago is; without deadline 18 nothing is read',
        async () => {
            // Arrange
            const old = await creditedCharge();
            old.fixture.clock.advance({ ms: 2 * DAY_MS });
            const recent = await creditedCharge(old.fixture);
            old.fixture.clock.advance({ ms: 29 * DAY_MS });
            await providerRefund(old.fixture, old.chargeId, 10_000);
            const readCharge = vi.spyOn(old.fixture.provider, 'readCharge');

            // Act
            const windowed = await sweep(old.fixture, { days: 30 });

            // Assert
            const reread = readCharge.mock.calls.map(([input]) => input.chargeId);
            expect(reread).toContain(recent.chargeId);
            expect(reread).not.toContain(old.chargeId);
            expect(await outOfFlowMarks(old.fixture.started.subscriptionId)).toHaveLength(0);
            expect(windowed.creditedPayments?.examined).toBe(1);

            // Act: no deadline 18 at all
            vi.restoreAllMocks();
            const reads = vi.spyOn(old.fixture.provider, 'readCharge');
            const missing = await sweep(old.fixture, { days: null });

            // Assert: fails closed, never an empty window
            expect(reads).not.toHaveBeenCalled();
            expect(missing.complete).toBe(false);
            expect(missing.creditedPayments?.failures).toEqual([
                expect.objectContaining({
                    paymentId: null,
                    message: expect.stringContaining('BILLING_DEADLINE_18_MISSING')
                })
            ]);
        }
    );

    it.skipIf(skip)('(g) PENDING, FAILED and CHARGED_BACK payments are not re-read', async () => {
        // Arrange
        const { fixture, chargeId } = await creditedCharge();
        const others = [
            await seedPayment(fixture, 'PENDING'),
            await seedPayment(fixture, 'FAILED'),
            await seedPayment(fixture, 'CHARGED_BACK')
        ];
        const readCharge = vi.spyOn(fixture.provider, 'readCharge');

        // Act
        const summary = await sweep(fixture);

        // Assert
        const reread = readCharge.mock.calls.map(([input]) => input.chargeId);
        expect(reread).toEqual([chargeId]);
        for (const other of others) expect(reread).not.toContain(other.providerFactId);
        expect(summary.complete).toBe(true);
    });

    it.skipIf(skip)(
        '(h) a second run with reason 18 open is no new mark, no failure and no new event',
        async () => {
            // Arrange
            const { fixture, chargeId } = await creditedCharge();
            await providerRefund(fixture, chargeId, 10_000);
            await sweep(fixture);
            vi.restoreAllMocks();
            const before = await markOpenedEvents(fixture.started.subscriptionId);

            // Act
            const second = await sweep(fixture);

            // Assert
            expect(second.complete).toBe(true);
            expect(second.creditedPayments).toMatchObject({ alreadyOpen: 1, failures: [] });
            expect(await outOfFlowMarks(fixture.started.subscriptionId)).toHaveLength(1);
            expect(await markOpenedEvents(fixture.started.subscriptionId)).toBe(before);
        }
    );

    it.skipIf(skip)(
        '(i) a payment the provider does not know fails the run, and the rest of the page goes on',
        async () => {
            // Arrange
            const { fixture, chargeId } = await creditedCharge();
            await providerRefund(fixture, chargeId, 10_000);
            const unknown = await seedPayment(fixture, 'SUCCEEDED');
            const ping = vi.fn(async () => undefined);

            // Act
            const summary = await sweep(fixture, { livenessPing: { ping } });

            // Assert
            expect(summary.complete).toBe(false);
            expect(summary.pinged).toBe(false);
            expect(ping).not.toHaveBeenCalled();
            expect(summary.creditedPayments?.failures).toEqual([
                expect.objectContaining({ paymentId: unknown.id })
            ]);
            expect(summary.creditedPayments?.outOfFlowRefunds).toBe(1);
            expect(summary.failures).toContainEqual(
                expect.objectContaining({ subscriptionId: fixture.started.subscriptionId })
            );
        }
    );
});
