import { domainEventModel, type ReconciliationMarkReason, reconciliationMarkModel } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger.js';
import { liftReconciliationMark } from '../../../src/services/billing/reconciliation/lift-reconciliation-mark.service.js';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service.js';
import type { HangablePayment } from '../../../src/services/billing/reconciliation/reconciliation-mark-payments.port.js';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers.js';
import {
    markPaymentClock as clock,
    hungRows,
    markPaymentFixture,
    retireMarkPaymentFixtures,
    seedManualPayment,
    seedProviderPayment
} from './support/mark-payment-fixtures.js';

afterAll(closeServiceTestPool);
afterEach(retireMarkPaymentFixtures);

const REASON: ReconciliationMarkReason = 'COBRO_DUPLICADO';
const realPort = () => createPaymentReconciliationMarkPayments(clock);

/** S14 through the real port, with its own correlation id. */
async function hang(input: {
    readonly subscriptionId: string;
    readonly userId: string;
    readonly payment?: HangablePayment;
    readonly correlationId?: string;
}) {
    return openReconciliationMark(
        {
            subject: { kind: 'SUBSCRIPTION', subscriptionId: input.subscriptionId },
            reason: REASON,
            ...(input.payment ? { payment: input.payment } : {}),
            actor: { type: 'admin', id: input.userId },
            correlationId: input.correlationId ?? crypto.randomUUID()
        },
        { markPayments: realPort() }
    );
}

async function markOpenedEvents(correlationId: string) {
    return (await domainEventModel.findByCorrelationId({ correlationId })).filter(
        (event) => event.eventType === 'reconciliation.mark_opened'
    );
}

async function openMarksWithReason(subscriptionId: string) {
    return (
        await reconciliationMarkModel.listOpen({
            subject: { kind: 'SUBSCRIPTION', subscriptionId }
        })
    ).filter((mark) => mark.reason === REASON);
}

/** Waits (bounded) until some backend updating `reconciliation_mark` holds an ungranted lock. */
async function waitForBlockedMarkUpdate({ timeoutMs = 5_000, everyMs = 50 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const blocked = await getServiceTestPool().query<{ n: number }>(
            `SELECT count(*)::int AS n
               FROM pg_locks l
               JOIN pg_stat_activity a ON a.pid = l.pid
              WHERE NOT l.granted
                AND a.datname = current_database()
                AND a.query ILIKE 'update "reconciliation_mark"%'`
        );
        if ((blocked.rows[0]?.n ?? 0) > 0) return true;
        await new Promise((resolve) => setTimeout(resolve, everyMs));
    }
    return false;
}

describe('TEST:B5:19 — S14 hangs a payment on the open mark (AC:B5:37)', () => {
    it('(a) a second case with the same reason hangs its payment on the open mark and bumps its version', async () => {
        const { subscriptionId, userId } = await markPaymentFixture();
        const p1 = await seedProviderPayment({ subscriptionId });
        const p2 = await seedProviderPayment({ subscriptionId });
        const firstCorrelation = crypto.randomUUID();
        const secondCorrelation = crypto.randomUUID();

        const first = await hang({
            subscriptionId,
            userId,
            payment: p1,
            correlationId: firstCorrelation
        });
        const second = await hang({
            subscriptionId,
            userId,
            payment: p2,
            correlationId: secondCorrelation
        });

        expect(first.outcome).toBe('OPENED');
        expect(second).toMatchObject({ outcome: 'ACCUMULATED', paymentHung: true });
        expect(second.mark.id).toBe(first.mark.id);
        expect(second.mark.version).toBe(first.mark.version + 1);
        const rows = await hungRows({ markId: first.mark.id });
        expect(rows.map((row) => row.payment_id).sort()).toEqual([p1.id, p2.id].sort());
        for (const row of rows) expect(row.hung_at).toEqual(clock.now());
        expect((await openMarksWithReason(subscriptionId)).map((mark) => mark.id)).toEqual([
            first.mark.id
        ]);
        const firstEvents = await markOpenedEvents(firstCorrelation);
        const secondEvents = await markOpenedEvents(secondCorrelation);
        expect(firstEvents).toHaveLength(1);
        expect(secondEvents).toHaveLength(1);
        expect(secondEvents[0]?.changes).toEqual(
            expect.arrayContaining([
                { field: 'reconciliation_mark.id', new: first.mark.id },
                { field: 'reconciliation_mark.outcome', new: 'ACCUMULATED' }
            ])
        );
    });

    it('(b) a manual payment accumulates on the open mark the same way', async () => {
        const { subscriptionId, userId } = await markPaymentFixture();
        const p1 = await seedProviderPayment({ subscriptionId });
        const manual = await seedManualPayment({ subscriptionId });

        const first = await hang({ subscriptionId, userId, payment: p1 });
        const second = await hang({ subscriptionId, userId, payment: manual });

        expect(second).toMatchObject({ outcome: 'ACCUMULATED', paymentHung: true });
        expect(second.mark.id).toBe(first.mark.id);
        expect(second.mark.version).toBe(first.mark.version + 1);
        const rows = await hungRows({ markId: first.mark.id });
        expect(rows).toHaveLength(2);
        expect(rows).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ payment_id: p1.id, manual_payment_id: null }),
                expect.objectContaining({ payment_id: null, manual_payment_id: manual.id })
            ])
        );
        expect(await openMarksWithReason(subscriptionId)).toHaveLength(1);
    });

    it('(c) the same payment hung twice on the same mark is rejected and S14 rolls back whole', async () => {
        const { subscriptionId, userId } = await markPaymentFixture();
        const p1 = await seedProviderPayment({ subscriptionId });
        const p2 = await seedProviderPayment({ subscriptionId });
        const manual = await seedManualPayment({ subscriptionId });
        await hang({ subscriptionId, userId, payment: p1 });
        await hang({ subscriptionId, userId, payment: p2 });
        const accumulated = await hang({ subscriptionId, userId, payment: manual });
        const markId = accumulated.mark.id;

        for (const repeated of [p2, manual]) {
            const correlationId = crypto.randomUUID();
            await expect(
                hang({ subscriptionId, userId, payment: repeated, correlationId })
            ).rejects.toMatchObject({ reason: 'MARK_PAYMENT_ALREADY_HUNG' });
            const rows = await hungRows({ markId });
            expect(
                rows.filter((row) => (row.payment_id ?? row.manual_payment_id) === repeated.id)
            ).toHaveLength(1);
            expect(rows).toHaveLength(3);
            expect((await reconciliationMarkModel.findById({ markId }))?.version).toBe(
                accumulated.mark.version
            );
            expect(await markOpenedEvents(correlationId)).toHaveLength(0);
        }
    });

    it('(d) after S15 lifted the mark, S14 opens a new one and hangs the payment there', async () => {
        const { subscriptionId, userId } = await markPaymentFixture();
        const opened = await hang({ subscriptionId, userId });
        await liftReconciliationMark(
            { markId: opened.mark.id, expectedVersion: opened.mark.version, liftedBy: userId },
            { clock, markPayments: realPort() }
        );
        const payment = await seedProviderPayment({ subscriptionId });

        const reopened = await hang({ subscriptionId, userId, payment });

        expect(reopened).toMatchObject({ outcome: 'OPENED', paymentHung: true });
        expect(reopened.mark.id).not.toBe(opened.mark.id);
        expect(await hungRows({ markId: reopened.mark.id })).toMatchObject([
            { payment_id: payment.id }
        ]);
        expect(await hungRows({ markId: opened.mark.id })).toHaveLength(0);
    });

    it('(e) S15 lifting the mark IN THE MIDDLE makes S14 open a new mark for its payment', async () => {
        const { subscriptionId, userId } = await markPaymentFixture();
        const opened = await hang({ subscriptionId, userId });
        const payment = await seedProviderPayment({ subscriptionId });

        let signalLifted: () => void = () => undefined;
        const lifted = new Promise<void>((resolve) => {
            signalLifted = resolve;
        });
        let releaseCommit: () => void = () => undefined;
        const commitGate = new Promise<void>((resolve) => {
            releaseCommit = resolve;
        });
        // S15 writes lifted_at and holds its transaction open (written, not committed).
        const s15 = getServiceTestDb().transaction(async (tx) => {
            await liftReconciliationMark(
                {
                    markId: opened.mark.id,
                    expectedVersion: opened.mark.version,
                    liftedBy: userId,
                    tx
                },
                { clock, markPayments: realPort() }
            );
            signalLifted();
            await commitGate;
        });
        await lifted;

        // S14 on another connection still sees the mark open; its version bump blocks on S15's row lock.
        const s14 = hang({ subscriptionId, userId, payment });
        s14.catch(() => undefined);
        const sawBlocked = await waitForBlockedMarkUpdate();
        releaseCommit();
        await s15;
        expect(sawBlocked).toBe(true);

        const result = await s14;
        expect(result).toMatchObject({ outcome: 'OPENED', paymentHung: true });
        expect(result.mark.id).not.toBe(opened.mark.id);
        expect(await hungRows({ markId: result.mark.id })).toMatchObject([
            { payment_id: payment.id }
        ]);
        expect(await hungRows({ markId: opened.mark.id })).toHaveLength(0);
        const old = await reconciliationMarkModel.findById({ markId: opened.mark.id });
        expect(old?.liftedAt).toEqual(clock.now());
    });
});
