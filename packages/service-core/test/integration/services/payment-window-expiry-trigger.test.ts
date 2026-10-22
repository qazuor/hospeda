import { coveredPeriods, emailOutbox, eq, payments, receipts, subscriptions } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { afterAll, describe, expect, it } from 'vitest';
import { expireLapsedPayments } from '../../../src/services/billing/payment/expire-lapsed-payments.service.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { graceWithFailedCycle } from './support/grace-fixtures.js';
import { paymentFixture } from './support/payment-fixtures.js';

afterAll(closeServiceTestPool);
const beforeCancelNotice = { beforeCancel: async () => 'SENT' as const };

async function renewal() {
    const fixture = await graceWithFailedCycle();
    const [payment] = await getServiceTestDb()
        .select()
        .from(payments)
        .where(eq(payments.providerFactId, fixture.chargeId));
    if (!payment) throw new Error('failed-cycle payment missing');
    const read = await fixture.provider.readCharge({ chargeId: fixture.chargeId });
    if (!read.snapshot.expiresAt) throw new Error('renewal fixture has no provider window');
    return { fixture, payment, expiresAt: Date.parse(read.snapshot.expiresAt) };
}

async function readPayment(paymentId: string) {
    const [payment] = await getServiceTestDb()
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId));
    if (!payment) throw new Error(`payment ${paymentId} missing`);
    return payment;
}

function pastWindow(
    fixture: { clock: { now(): Date; advance(input: { ms: number }): void } },
    expiresAt: number
) {
    fixture.clock.advance({ ms: Math.max(1, expiresAt - fixture.clock.now().getTime() + 1) });
}

describe('TEST:1709:1 AC:1709:1 AC:1709:3 closed renewal window', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:1709:1 AC:1709:1 AC:1709:3 fails only the payment and preserves adjacent rows',
        async () => {
            const { fixture, payment, expiresAt } = await renewal();
            const [subscriptionBefore] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            const coveredBefore = await getServiceTestDb()
                .select()
                .from(coveredPeriods)
                .where(eq(coveredPeriods.paymentId, payment.id));
            const receiptsBefore = await getServiceTestDb()
                .select()
                .from(receipts)
                .where(eq(receipts.paymentId, payment.id));
            const mailBefore = await getServiceTestDb()
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, fixture.user.id));
            expect(expiresAt).toBeGreaterThan(0);
            pastWindow(fixture, expiresAt);
            const summary = await expireLapsedPayments({}, fixture);
            const after = await readPayment(payment.id);
            const [subscriptionAfter] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            expect(after).toEqual({
                ...payment,
                status: 'FAILED',
                version: payment.version + 1,
                updatedAt: expect.any(Date)
            });
            expect(subscriptionAfter).toEqual(subscriptionBefore);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(coveredPeriods)
                    .where(eq(coveredPeriods.paymentId, payment.id))
            ).toEqual(coveredBefore);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(receipts)
                    .where(eq(receipts.paymentId, payment.id))
            ).toEqual(receiptsBefore);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(emailOutbox)
                    .where(eq(emailOutbox.recipientUserId, fixture.user.id))
            ).toEqual(mailBefore);
            expect(summary.failed).toBeGreaterThanOrEqual(1);
        }
    );
});

describe('TEST:1709:2 AC:1709:1 AC:1709:2 open renewal window', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:1709:2 AC:1709:1 AC:1709:2 leaves an open row alone, then fails it after expiry',
        async () => {
            const { fixture, payment, expiresAt } = await renewal();
            fixture.advanceToAttempt(3);
            expect(fixture.clock.now().getTime()).toBeLessThan(expiresAt);
            const before = await readPayment(payment.id);
            await expireLapsedPayments({}, fixture);
            expect(await readPayment(payment.id)).toEqual(before);
            pastWindow(fixture, expiresAt);
            await expireLapsedPayments({}, fixture);
            expect(await readPayment(payment.id)).toEqual({
                ...before,
                status: 'FAILED',
                version: before.version + 1,
                updatedAt: expect.any(Date)
            });
        }
    );
});

describe('TEST:1709:3 AC:1709:2 signup without provider window', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:1709:3 AC:1709:2 AC:1734:1 P8 fails the first rejected record',
        async () => {
            const fixture = await paymentFixture();
            const { chargeId } = await fixture.provider.declineCharge({
                authorizationId: fixture.started.authorizationId,
                declineReason: 'declined'
            });
            const recorded = await recordChargeFact(
                { chargeId },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice,
                    coverageNotices: fixture.coverageNotices
                }
            );
            expect(recorded.outcome).toBe('DECLINED');
            const [payment] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, chargeId));
            if (!payment) throw new Error('signup payment missing');
            const read = await fixture.provider.readCharge({ chargeId });
            expect(read.snapshot.expiresAt).toBeNull();
            const before = await readPayment(payment.id);
            fixture.clock.advance({ ms: 70 * 86_400_000 });
            await expireLapsedPayments({}, fixture);
            expect(before).toMatchObject({ status: 'FAILED', version: 2 });
            expect(await readPayment(payment.id)).toEqual(before);
        }
    );
});

describe('TEST:1709:4 AC:1709:2 approved retry', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:1709:4 AC:1709:2 does not fail a retry that was approved',
        async () => {
            const fixture = await graceWithFailedCycle({ approveOnAttempt: 2 });
            const [payment] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, fixture.chargeId));
            if (!payment) throw new Error('approved-cycle payment missing');
            const read = await fixture.provider.readCharge({ chargeId: fixture.chargeId });
            expect(read.snapshot.expiresAt).not.toBeNull();
            pastWindow(fixture, Date.parse(read.snapshot.expiresAt ?? ''));
            const before = await readPayment(payment.id);
            const summary = await expireLapsedPayments({}, fixture);
            expect(await readPayment(payment.id)).toEqual(before);
            expect(summary.open).toBeGreaterThanOrEqual(1);
        }
    );
});

describe('TEST:1709:5 AC:1709:2 per-payment read failure', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:1709:5 AC:1709:2 continues after one provider read throws',
        async () => {
            const first = await renewal();
            const second = await renewal();
            pastWindow(first.fixture, first.expiresAt);
            pastWindow(second.fixture, second.expiresAt);
            const provider: PaymentProvider = new Proxy(first.fixture.provider, {
                get(target, property, receiver) {
                    if (property === 'readCharge') {
                        return async ({ chargeId }: { readonly chargeId: string }) => {
                            if (chargeId === first.payment.providerFactId)
                                throw new Error('intentional provider read failure');
                            if (chargeId === second.payment.providerFactId)
                                return second.fixture.provider.readCharge({ chargeId });
                            return target.readCharge({ chargeId });
                        };
                    }
                    const value = Reflect.get(target, property, receiver);
                    return typeof value === 'function' ? value.bind(target) : value;
                }
            });
            const firstBefore = await readPayment(first.payment.id);
            const summary = await expireLapsedPayments(
                {},
                { provider, clock: first.fixture.clock }
            );
            expect(await readPayment(first.payment.id)).toEqual(firstBefore);
            expect(await readPayment(second.payment.id)).toEqual({
                ...second.payment,
                status: 'FAILED',
                version: second.payment.version + 1,
                updatedAt: expect.any(Date)
            });
            expect(summary.errors).toBeGreaterThanOrEqual(1);
        }
    );
});

describe('TEST:1709:6 AC:1709:3 repeated run', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:1709:6 AC:1709:3 keeps the first P2 result unchanged on a second run',
        async () => {
            const { fixture, payment, expiresAt } = await renewal();
            pastWindow(fixture, expiresAt);
            await expireLapsedPayments({}, fixture);
            const afterFirst = await readPayment(payment.id);
            await expireLapsedPayments({}, fixture);
            expect(await readPayment(payment.id)).toEqual(afterFirst);
        }
    );
});

describe('TEST:1709:7 AC:1709:4 complete keyset pagination', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:1709:7 AC:1709:4 visits every candidate across one-row pages',
        async () => {
            const rows = [await renewal(), await renewal(), await renewal()];
            for (const row of rows) pastWindow(row.fixture, row.expiresAt);
            const provider: PaymentProvider = new Proxy(rows[0]!.fixture.provider, {
                get(target, property, receiver) {
                    if (property === 'readCharge') {
                        return async ({ chargeId }: { readonly chargeId: string }) => {
                            const owner = rows.find(
                                (row) => row.payment.providerFactId === chargeId
                            );
                            return owner
                                ? owner.fixture.provider.readCharge({ chargeId })
                                : target.readCharge({ chargeId });
                        };
                    }
                    const value = Reflect.get(target, property, receiver);
                    return typeof value === 'function' ? value.bind(target) : value;
                }
            });
            const summary = await expireLapsedPayments(
                { pageSize: 1 },
                { provider, clock: rows[0]!.fixture.clock }
            );
            for (const row of rows) {
                const actual = await readPayment(row.payment.id);
                expect(actual).toEqual({
                    ...row.payment,
                    status: 'FAILED',
                    version: row.payment.version + 1,
                    updatedAt: expect.any(Date)
                });
            }
            expect(summary.failed).toBeGreaterThanOrEqual(3);
        }
    );
});
