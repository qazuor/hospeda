// HOS-1680: the refundable balance of a payment discounts every refund that already claims it
// (REQUESTED, CONFIRMED, EXECUTED; never FAILED), read with the payment locked and inside the
// caller's transaction. RF1 and RF4 share it; a REFUNDED or CHARGED_BACK payment is not
// refundable. Every rejection leaves nothing written.
import type { DrizzleClient } from '@repo/db';
import { eq, payments, refunds } from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import { requestRefund } from '../../../src/services/billing/refund/request-refund.service.js';
import {
    closeServiceTestPool,
    getServiceTestDb,
    getServiceTestPool,
    isServiceTestDbAvailable
} from './helpers.js';
import {
    type CreditedPayment,
    creditedPayment,
    paymentRow,
    refundById,
    refundsOfPayment,
    seedAdminActor,
    settleOnPayment
} from './support/refund-fixtures.js';

afterAll(closeServiceTestPool);

const live = !isServiceTestDbAvailable();

/** RF1 on the credited payment, in its own transaction unless `tx` is given. */
function rf1(credited: CreditedPayment, amount: number, tx?: DrizzleClient) {
    return requestRefund(
        { source: { kind: 'PAYMENT', id: credited.payment.id }, amount, reason: 'REVOCATION' },
        { clock: credited.fixture.clock, ...(tx ? { tx } : {}) }
    );
}

/** Seed a refund row directly (CONFIRMED/FAILED have no production writer yet: B6). */
async function seedRefund(
    paymentId: string,
    amount: number,
    status: 'REQUESTED' | 'CONFIRMED' | 'FAILED'
) {
    await getServiceTestDb().insert(refunds).values({
        paymentId,
        amount,
        reason: 'REVOCATION',
        status
    });
}

/** What a rejection must leave as it was: the refund rows and the payment row. */
async function snapshot(paymentId: string) {
    return { refunds: await refundsOfPayment(paymentId), payment: await paymentRow(paymentId) };
}

const EXCEEDS = { code: 'VALIDATION_ERROR', reason: 'REFUND_EXCEEDS_BALANCE' };

/** The sessions parked behind `pid`, directly or behind another parked session. */
const PARKED_BEHIND = `WITH direct AS (
         SELECT pid FROM pg_stat_activity WHERE $1 = ANY (pg_blocking_pids(pid))
     )
     SELECT count(*)::int AS parked FROM pg_stat_activity
     WHERE pid IN (SELECT pid FROM direct)
        OR pg_blocking_pids(pid) && ARRAY(SELECT pid FROM direct)`;

/**
 * Polls until at least `atLeast` sessions are parked behind the lock holder `pid`.
 *
 * @returns Whether the barrier was observed before the polling ran out (~5 s).
 */
async function waitUntilParked(pid: number | undefined, atLeast: number): Promise<boolean> {
    for (let poll = 0; poll < 100; poll++) {
        const parked = await getServiceTestPool().query<{ parked: number }>(PARKED_BEHIND, [pid]);
        if ((parked.rows[0]?.parked ?? 0) >= atLeast) return true;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
}

/** Awaits a promise and returns its outcome: never a rejection. */
async function settle<T>(promise: Promise<T>): Promise<PromiseSettledResult<T>> {
    try {
        return { status: 'fulfilled', value: await promise };
    } catch (reason: unknown) {
        return { status: 'rejected', reason };
    }
}

/**
 * Holds the payment row from another connection until both acts are parked behind it (or
 * behind each other), so their reads of the balance overlap (molde of
 * `subscription-revocation-guards.test.ts`, `withBarrierOnPayment`). If the two acts are
 * never seen parked, the barrier was not armed and the test fails instead of passing on
 * an unproven order.
 */
async function withBarrierOnPayment<T>(paymentId: string, run: () => Promise<T>): Promise<T> {
    const barrier = await getServiceTestPool().connect();
    try {
        await barrier.query('BEGIN');
        await barrier.query('SELECT id FROM payment WHERE id = $1 FOR UPDATE', [paymentId]);
        const pid = (await barrier.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]
            ?.pid;
        const running = settle(run());
        const armed = await waitUntilParked(pid, 2);
        await barrier.query(armed ? 'COMMIT' : 'ROLLBACK');
        const outcome = await running;
        if (!armed) throw new Error('lock barrier not observed: the two acts never parked');
        if (outcome.status === 'rejected') throw outcome.reason;
        return outcome.value;
    } finally {
        barrier.release();
    }
}

describe('TEST:1680:1 AC-1680:1 the refundable balance discounts every non-FAILED refund', () => {
    it.skipIf(live)(
        '(a) an RF1 REQUESTED for the total: a second RF1 for 1 or for the total is rejected',
        async () => {
            // Arrange
            const credited = await creditedPayment();
            await rf1(credited, 10000);
            const before = await snapshot(credited.payment.id);

            // Act / Assert
            await expect(rf1(credited, 1)).rejects.toMatchObject(EXCEEDS);
            await expect(rf1(credited, 10000)).rejects.toMatchObject(EXCEEDS);
            expect(await snapshot(credited.payment.id)).toEqual(before);
            expect(before.refunds).toHaveLength(1);
        }
    );

    it.skipIf(live)('(b) an open REQUESTED for 4000: 6001 is rejected, 6000 is born', async () => {
        // Arrange
        const credited = await creditedPayment();
        await rf1(credited, 4000);
        const before = await snapshot(credited.payment.id);

        // Act
        const over = rf1(credited, 6001);

        // Assert
        await expect(over).rejects.toMatchObject(EXCEEDS);
        expect(await snapshot(credited.payment.id)).toEqual(before);
        const exact = await rf1(credited, 6000);
        expect((await refundById(exact.refundId))?.status).toBe('REQUESTED');
    });

    it.skipIf(live)('(c) a CONFIRMED refund for the total: an RF1 for 1 is rejected', async () => {
        // Arrange
        const credited = await creditedPayment();
        await seedRefund(credited.payment.id, 10000, 'CONFIRMED');
        const before = await snapshot(credited.payment.id);

        // Act
        const attempt = rf1(credited, 1);

        // Assert
        await expect(attempt).rejects.toMatchObject(EXCEEDS);
        expect(await snapshot(credited.payment.id)).toEqual(before);
    });

    it.skipIf(live)(
        '(d) a FAILED refund for the total claims nothing: an RF1 for the total is born',
        async () => {
            // Arrange
            const credited = await creditedPayment();
            await seedRefund(credited.payment.id, 10000, 'FAILED');

            // Act
            const { refundId } = await rf1(credited, 10000);

            // Assert
            expect(await refundById(refundId)).toMatchObject({
                status: 'REQUESTED',
                amount: 10000
            });
            expect(await refundsOfPayment(credited.payment.id)).toHaveLength(2);
        }
    );

    it.skipIf(live)(
        '(e) EXECUTED 4000 and REQUESTED 3000 add up: 3001 is rejected, 3000 is born',
        async () => {
            // Arrange
            const credited = await creditedPayment();
            const admin = await seedAdminActor();
            await settleOnPayment(admin, credited, { amount: 4000 });
            await rf1(credited, 3000);
            const before = await snapshot(credited.payment.id);

            // Act
            const over = rf1(credited, 3001);

            // Assert
            await expect(over).rejects.toMatchObject(EXCEEDS);
            expect(await snapshot(credited.payment.id)).toEqual(before);
            const exact = await rf1(credited, 3000);
            expect((await refundById(exact.refundId))?.status).toBe('REQUESTED');
        }
    );

    it.skipIf(live)(
        "(f) inside the caller's transaction: its own uncommitted REQUESTED is discounted",
        async () => {
            // Arrange
            const credited = await creditedPayment();
            const before = await snapshot(credited.payment.id);
            let rejection: unknown = null;

            // Act
            const outer = getServiceTestDb().transaction(async (tx) => {
                await tx.insert(refunds).values({
                    paymentId: credited.payment.id,
                    amount: 10000,
                    reason: 'REVOCATION',
                    status: 'REQUESTED'
                });
                const attempt = await settle(rf1(credited, 1, tx as unknown as DrizzleClient));
                rejection = attempt.status === 'rejected' ? attempt.reason : null;
                throw new Error('rollback outer transaction');
            });

            // Assert
            await expect(outer).rejects.toThrow('rollback outer transaction');
            expect(rejection).toMatchObject(EXCEEDS);
            expect(await snapshot(credited.payment.id)).toEqual(before);
            expect(before.refunds).toEqual([]);
        }
    );
});

describe('TEST:1680:2 AC-1680:2 a REFUNDED or CHARGED_BACK payment is not refundable', () => {
    for (const status of ['REFUNDED', 'CHARGED_BACK'] as const) {
        it.skipIf(live)(`a ${status} payment: an RF1 for 1 is PAYMENT_NOT_REFUNDABLE`, async () => {
            // Arrange
            const credited = await creditedPayment();
            await getServiceTestDb()
                .update(payments)
                .set({ status })
                .where(eq(payments.id, credited.payment.id));
            const before = await snapshot(credited.payment.id);

            // Act
            const attempt = rf1(credited, 1);

            // Assert
            await expect(attempt).rejects.toMatchObject({
                code: 'ALREADY_EXISTS',
                reason: 'PAYMENT_NOT_REFUNDABLE'
            });
            expect(await snapshot(credited.payment.id)).toEqual(before);
            expect(before.refunds).toEqual([]);
        });
    }

    it.skipIf(live)('a PARTIALLY_REFUNDED payment with balance admits an RF1', async () => {
        // Arrange
        const credited = await creditedPayment();
        const admin = await seedAdminActor();
        await settleOnPayment(admin, credited, { amount: 4000 });
        expect((await paymentRow(credited.payment.id))?.status).toBe('PARTIALLY_REFUNDED');

        // Act
        const { refundId } = await rf1(credited, 6000);

        // Assert
        expect(await refundById(refundId)).toMatchObject({ status: 'REQUESTED', amount: 6000 });
    });
});

describe('TEST:1680:3 AC-1680:3 two RF1 for the total at once leave one', () => {
    it.skipIf(live)(
        '(g) two concurrent RF1 for the total: one wins, the other is REFUND_EXCEEDS_BALANCE',
        async () => {
            // Arrange
            const credited = await creditedPayment();

            // Act
            const outcomes = await withBarrierOnPayment(credited.payment.id, () =>
                Promise.allSettled([rf1(credited, 10000), rf1(credited, 10000)])
            );

            // Assert
            const rejected = outcomes.filter(
                (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected'
            );
            expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
            expect(rejected).toHaveLength(1);
            expect(rejected[0]?.reason).toMatchObject(EXCEEDS);
            const rows = await refundsOfPayment(credited.payment.id);
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({ status: 'REQUESTED', amount: 10000 });
        }
    );

    it.skipIf(live)(
        '(h) another flow holds the payment and commits a REQUESTED for the total: the waiting RF1 is rejected',
        async () => {
            // Arrange: another transaction holds the payment and inserts its own REQUESTED
            const credited = await creditedPayment();
            const other = await getServiceTestPool().connect();
            let outcome: PromiseSettledResult<unknown>;
            try {
                await other.query('BEGIN');
                await other.query('SELECT id FROM payment WHERE id = $1 FOR UPDATE', [
                    credited.payment.id
                ]);
                await other.query(
                    "INSERT INTO refund (payment_id, amount, reason, status) VALUES ($1, 10000, 'REVOCATION', 'REQUESTED')",
                    [credited.payment.id]
                );
                const pid = (await other.query<{ pid: number }>('SELECT pg_backend_pid() AS pid'))
                    .rows[0]?.pid;

                // Act
                const running = settle(rf1(credited, 10000));
                const armed = await waitUntilParked(pid, 1);
                await other.query(armed ? 'COMMIT' : 'ROLLBACK');
                outcome = await running;
                if (!armed) throw new Error('lock barrier not observed: the RF1 never parked');
            } finally {
                other.release();
            }

            // Assert
            expect(outcome).toMatchObject({ status: 'rejected', reason: EXCEEDS });
            expect(await refundsOfPayment(credited.payment.id)).toHaveLength(1);
        }
    );
});

describe('TEST:1680:5 D-1 RF4 uses the same balance and does not count the row it closes', () => {
    it.skipIf(live)(
        '(i) an open REQUESTED for the total: SETTLE_SEPARATELY 3000 is rejected, nothing written',
        async () => {
            // Arrange
            const credited = await creditedPayment();
            const admin = await seedAdminActor();
            const { refundId } = await rf1(credited, 10000);
            const before = await snapshot(credited.payment.id);

            // Act
            const attempt = settleOnPayment(admin, credited, {
                amount: 3000,
                onAmountMismatch: 'SETTLE_SEPARATELY'
            });

            // Assert
            await expect(attempt).rejects.toMatchObject(EXCEEDS);
            expect(await snapshot(credited.payment.id)).toEqual(before);
            expect((await refundById(refundId))?.status).toBe('REQUESTED');
        }
    );

    it.skipIf(live)(
        '(j) an open REQUESTED for 6000: SETTLE_SEPARATELY 3000 is born, then RF1 fits only 1000',
        async () => {
            // Arrange
            const credited = await creditedPayment();
            const admin = await seedAdminActor();
            const { refundId } = await rf1(credited, 6000);

            // Act
            const settled = await settleOnPayment(admin, credited, {
                amount: 3000,
                onAmountMismatch: 'SETTLE_SEPARATELY'
            });

            // Assert
            expect(settled.closedRequestedRefundId).toBeNull();
            expect(await refundById(settled.refundId)).toMatchObject({
                status: 'EXECUTED',
                amount: 3000
            });
            expect((await refundById(refundId))?.status).toBe('REQUESTED');
            const before = await snapshot(credited.payment.id);
            await expect(rf1(credited, 1001)).rejects.toMatchObject(EXCEEDS);
            expect(await snapshot(credited.payment.id)).toEqual(before);
            const exact = await rf1(credited, 1000);
            expect((await refundById(exact.refundId))?.status).toBe('REQUESTED');
        }
    );

    it.skipIf(live)(
        '(k) RF4 for the total closes the open REQUESTED for the total: it does not count itself',
        async () => {
            // Arrange
            const credited = await creditedPayment();
            const admin = await seedAdminActor();
            const { refundId } = await rf1(credited, 10000);

            // Act
            const settled = await settleOnPayment(admin, credited, { amount: 10000 });

            // Assert
            expect(settled.closedRequestedRefundId).toBe(refundId);
            expect(settled.refundId).toBe(refundId);
            expect((await refundById(refundId))?.status).toBe('EXECUTED');
            expect((await paymentRow(credited.payment.id))?.status).toBe('REFUNDED');
            expect(await refundsOfPayment(credited.payment.id)).toHaveLength(1);
        }
    );

    it.skipIf(live)(
        '(l) CLOSE_WITH_SETTLED_AMOUNT 5000 closes the open REQUESTED for the total',
        async () => {
            // Arrange
            const credited = await creditedPayment();
            const admin = await seedAdminActor();
            const { refundId } = await rf1(credited, 10000);

            // Act
            const settled = await settleOnPayment(admin, credited, {
                amount: 5000,
                onAmountMismatch: 'CLOSE_WITH_SETTLED_AMOUNT'
            });

            // Assert
            expect(settled.closedRequestedRefundId).toBe(refundId);
            expect(await refundById(refundId)).toMatchObject({ status: 'EXECUTED', amount: 5000 });
            expect((await paymentRow(credited.payment.id))?.status).toBe('PARTIALLY_REFUNDED');
            expect(await refundsOfPayment(credited.payment.id)).toHaveLength(1);
        }
    );
});
