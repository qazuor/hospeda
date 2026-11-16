/**
 * HOS-2223: S1 decides a successor's window on "has the predecessor a credited charge?".
 * P1 crediting the first charge between that decision and the successor's insert must not
 * leave a window chosen on stale facts. Both flows serialize on the predecessor's row lock:
 * S1 re-decides under `FOR UPDATE` in its insert transaction, and P1 takes `FOR UPDATE`
 * before opening the covered period.
 */
import { coveredPeriods, eq, payments, receipts, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { creditPayment } from '../../../src/services/billing/payment/credit-payment.service.js';
import {
    scheduleSuccessorFirstCharge,
    startSuccession
} from '../../../src/services/billing/subscription/start-succession.service.js';
import {
    closeServiceTestPool,
    getServiceTestDb,
    getServiceTestPool,
    isServiceTestDbAvailable
} from './helpers.js';
import { retirePlanChanges, seedPlanChange } from './support/plan-change-fixtures.js';

const createdPaymentIds: string[] = [];

afterEach(async () => {
    const db = getServiceTestDb();
    for (const id of createdPaymentIds.splice(0))
        await db.delete(receipts).where(eq(receipts.paymentId, id));
    await retirePlanChanges();
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('HOS-2223 succession and P1 serialize', () => {
    it('re-decides the window in the insert transaction when a charge was credited meanwhile', async () => {
        // Arrange: no credited charge and a near first-charge date, so the first decision is
        // the full window. The schedule port runs between that decision and the insert, and
        // stands in for a P1 that committed there without moving the date (sweep lag).
        const now = new Date('2026-10-11T05:00:00.000Z');
        const seeded = await seedPlanChange({
            nextChargeAt: new Date(now.getTime() + 60 * 60 * 1000)
        });
        const db = getServiceTestDb();
        const firstChargeSchedule: NonNullable<
            Parameters<typeof startSuccession>[1]['firstChargeSchedule']
        > = async (input) => {
            await db.insert(coveredPeriods).values({
                subscriptionId: seeded.predecessor.id,
                periodStart: now,
                manualPaymentId: null,
                paymentId: await pendingPayment(seeded.predecessor.id, 'SUCCEEDED'),
                creditedAt: now
            });
            return scheduleSuccessorFirstCharge(input);
        };

        // Act
        const attempt = startSuccession(
            {
                userId: seeded.user.id,
                predecessorSubscriptionId: seeded.predecessor.id,
                billingOptionId: seeded.targetBillingOptionId,
                returnUrl: seeded.input.returnUrl
            },
            { ...seeded.ports, clock: { now: () => now }, firstChargeSchedule }
        );

        // Assert
        await expect(attempt).rejects.toMatchObject({ reason: 'SUCCESSION_WINDOW_TOO_SHORT' });
        const successors = await db
            .select({ id: subscriptions.id })
            .from(subscriptions)
            .where(eq(subscriptions.succeedsId, seeded.predecessor.id));
        expect(successors).toHaveLength(0);
    });

    it('makes P1 take the subscription row lock before it opens the covered period', async () => {
        // Arrange: a pending charge on the predecessor, and another session holding its row.
        const seeded = await seedPlanChange({ nextChargeAt: new Date('2026-10-12T15:00:00.000Z') });
        const paymentId = await pendingPayment(seeded.predecessor.id, 'PENDING');
        const holder = await getServiceTestPool().connect();
        let credit: Promise<unknown> | undefined;
        let waitingQuery: string | null = null;
        try {
            await holder.query('BEGIN');
            await holder.query('SELECT id FROM subscription WHERE id = $1 FOR UPDATE', [
                seeded.predecessor.id
            ]);
            const holderPid = (
                await holder.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
            ).rows[0]?.pid;

            // Act: credit the charge while the row is held.
            credit = creditPayment(
                { paymentId, chargeCreatedAt: new Date('2026-10-11T05:00:00.000Z') },
                { clock: { now: () => new Date('2026-10-11T05:00:00.000Z') } }
            );
            for (let attempt = 0; attempt < 150 && waitingQuery === null; attempt++) {
                const waiting = await getServiceTestPool().query<{ query: string }>(
                    `SELECT query FROM pg_stat_activity
                     WHERE wait_event_type = 'Lock' AND pid <> $1 AND query ILIKE '%subscription%'`,
                    [holderPid]
                );
                waitingQuery = waiting.rows[0]?.query ?? null;
                if (waitingQuery === null) await new Promise((resolve) => setTimeout(resolve, 20));
            }
        } finally {
            await holder.query('ROLLBACK');
            holder.release();
        }
        await credit;

        // Assert: P1 blocked on the explicit row lock, not later on the next-charge update.
        expect(waitingQuery).toMatch(/for update/i);
        const opened = await getServiceTestDb()
            .select({ id: coveredPeriods.id })
            .from(coveredPeriods)
            .where(eq(coveredPeriods.paymentId, paymentId));
        expect(opened).toHaveLength(1);
    });

    it('takes the subscription before the payment, so S19 order (subscription → payment) cannot deadlock it', async () => {
        // Arrange: a pending charge, and a session that follows S19's order: it holds the
        // subscription row, and once P1 is waiting, it asks for the payment row.
        const seeded = await seedPlanChange({ nextChargeAt: new Date('2026-10-12T15:00:00.000Z') });
        const paymentId = await pendingPayment(seeded.predecessor.id, 'PENDING');
        const holder = await getServiceTestPool().connect();
        let credit: Promise<unknown> | undefined;
        let holderPaymentLock: Error | null = null;
        try {
            await holder.query('BEGIN');
            await holder.query('SELECT id FROM subscription WHERE id = $1 FOR UPDATE', [
                seeded.predecessor.id
            ]);
            const holderPid = (
                await holder.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
            ).rows[0]?.pid;
            credit = creditPayment(
                { paymentId, chargeCreatedAt: new Date('2026-10-11T05:00:00.000Z') },
                { clock: { now: () => new Date('2026-10-11T05:00:00.000Z') } }
            );
            credit.catch(() => undefined);
            let waiting = false;
            for (let attempt = 0; attempt < 150 && !waiting; attempt++) {
                const rows = await getServiceTestPool().query(
                    `SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND pid <> $1`,
                    [holderPid]
                );
                waiting = (rows.rowCount ?? 0) > 0;
                if (!waiting) await new Promise((resolve) => setTimeout(resolve, 20));
            }
            expect(waiting).toBe(true);

            // Act: S19's second lock, while P1 is waiting.
            try {
                await holder.query('SELECT id FROM payment WHERE id = $1 FOR UPDATE', [paymentId]);
            } catch (error) {
                holderPaymentLock = error as Error;
            }
        } finally {
            await holder.query('ROLLBACK');
            holder.release();
        }

        // Assert: neither side was chosen as a deadlock victim, and P1 still credited.
        expect(holderPaymentLock).toBeNull();
        await expect(credit).resolves.toMatchObject({ outcome: 'CREDITED' });
    });
});

async function pendingPayment(
    subscriptionId: string,
    status: 'PENDING' | 'SUCCEEDED'
): Promise<string> {
    const [payment] = await getServiceTestDb()
        .insert(payments)
        .values({
            subscriptionId,
            amount: 250000,
            currency: 'ARS',
            status,
            provider: 'fake',
            providerFactId: crypto.randomUUID(),
            factAt: new Date('2026-10-11T05:00:00.000Z')
        })
        .returning({ id: payments.id });
    if (!payment) throw new Error('Payment fixture missing');
    createdPaymentIds.push(payment.id);
    return payment.id;
}
