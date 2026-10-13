import { type ReconciliationMarkReason, reconciliationMarkModel } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger.js';
import { liftReconciliationMark } from '../../../src/services/billing/reconciliation/lift-reconciliation-mark.service.js';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service.js';
import type {
    HangablePayment,
    ReconciliationMarkPayments
} from '../../../src/services/billing/reconciliation/reconciliation-mark-payments.port.js';
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

const realPort = () => createPaymentReconciliationMarkPayments(clock);
const admin = (id: string) => ({ type: 'admin' as const, id });

/** S14 through the real port: opens the reason, hanging the payment when one is given. */
async function open(input: {
    readonly subscriptionId: string;
    readonly userId: string;
    readonly reason: ReconciliationMarkReason;
    readonly payment?: HangablePayment;
}) {
    return openReconciliationMark(
        {
            subject: { kind: 'SUBSCRIPTION', subscriptionId: input.subscriptionId },
            reason: input.reason,
            ...(input.payment ? { payment: input.payment } : {}),
            actor: admin(input.userId),
            correlationId: crypto.randomUUID()
        },
        { markPayments: realPort() }
    );
}

/** The predicate (f) of G-R1-F, read directly through the real port inside a transaction. */
async function countUnresolved(markId: string): Promise<number> {
    return getServiceTestDb().transaction((tx) => realPort().countUnresolved({ markId, tx }));
}

async function liftedAt(markId: string): Promise<Date | null> {
    const row = await getServiceTestPool().query<{ lifted_at: Date | null }>(
        'SELECT lifted_at FROM reconciliation_mark WHERE id = $1',
        [markId]
    );
    return row.rows[0]?.lifted_at ?? null;
}

describe('TEST:B5:20 — S15 guard over reconciliation_mark_payment (AC:B5:38)', () => {
    it('(a) rejects lifting a mark with an unresolved provider payment hung on it', async () => {
        const { subscriptionId, userId } = await markPaymentFixture();
        const payment = await seedProviderPayment({ subscriptionId });
        const opened = await open({ subscriptionId, userId, reason: 'COBRO_DUPLICADO', payment });

        await expect(
            liftReconciliationMark(
                { markId: opened.mark.id, expectedVersion: opened.mark.version, liftedBy: userId },
                { clock, markPayments: realPort() }
            )
        ).rejects.toMatchObject({ reason: 'MARK_HAS_UNRESOLVED_PAYMENTS' });
        expect(await liftedAt(opened.mark.id)).toBeNull();
        const unresolved = await countUnresolved(opened.mark.id);
        expect(typeof unresolved).toBe('number');
        expect(unresolved).toBe(1);
    });

    it('(b) rejects lifting a mark with an unresolved manual payment hung on it', async () => {
        const { subscriptionId, userId } = await markPaymentFixture();
        const payment = await seedManualPayment({ subscriptionId });
        const opened = await open({ subscriptionId, userId, reason: 'COBRO_DUPLICADO', payment });

        await expect(
            liftReconciliationMark(
                { markId: opened.mark.id, expectedVersion: opened.mark.version, liftedBy: userId },
                { clock, markPayments: realPort() }
            )
        ).rejects.toMatchObject({ reason: 'MARK_HAS_UNRESOLVED_PAYMENTS' });
        expect(await liftedAt(opened.mark.id)).toBeNull();
        expect(await countUnresolved(opened.mark.id)).toBe(1);
    });

    it('(c) rejects when one of N hung payments is still unresolved', async () => {
        const { subscriptionId, userId } = await markPaymentFixture();
        const first = await seedProviderPayment({ subscriptionId });
        const second = await seedManualPayment({ subscriptionId });
        await open({ subscriptionId, userId, reason: 'COBRO_DUPLICADO', payment: first });
        const accumulated = await open({
            subscriptionId,
            userId,
            reason: 'COBRO_DUPLICADO',
            payment: second
        });
        await getServiceTestPool().query(
            'UPDATE reconciliation_mark_payment SET resolved_at = $2 WHERE mark_id = $1 AND payment_id = $3',
            [accumulated.mark.id, clock.now(), first.id]
        );

        await expect(
            liftReconciliationMark(
                {
                    markId: accumulated.mark.id,
                    expectedVersion: accumulated.mark.version,
                    liftedBy: userId
                },
                { clock, markPayments: realPort() }
            )
        ).rejects.toMatchObject({ reason: 'MARK_HAS_UNRESOLVED_PAYMENTS' });
        expect(await hungRows({ markId: accumulated.mark.id })).toHaveLength(2);
        expect(await countUnresolved(accumulated.mark.id)).toBe(1);
        expect(await liftedAt(accumulated.mark.id)).toBeNull();
    });

    it('(d) lifts once every hung payment is resolved', async () => {
        const { subscriptionId, userId } = await markPaymentFixture();
        const first = await seedProviderPayment({ subscriptionId });
        const second = await seedManualPayment({ subscriptionId });
        await open({ subscriptionId, userId, reason: 'COBRO_DUPLICADO', payment: first });
        const accumulated = await open({
            subscriptionId,
            userId,
            reason: 'COBRO_DUPLICADO',
            payment: second
        });
        await getServiceTestPool().query(
            'UPDATE reconciliation_mark_payment SET resolved_at = $2 WHERE mark_id = $1',
            [accumulated.mark.id, clock.now()]
        );
        expect(await countUnresolved(accumulated.mark.id)).toBe(0);

        await expect(
            liftReconciliationMark(
                {
                    markId: accumulated.mark.id,
                    expectedVersion: accumulated.mark.version,
                    liftedBy: userId
                },
                { clock, markPayments: realPort() }
            )
        ).resolves.toMatchObject({
            outcome: 'LIFTED',
            mark: { id: accumulated.mark.id, liftedBy: userId, liftedAt: clock.now() }
        });
        expect(await liftedAt(accumulated.mark.id)).toEqual(clock.now());
    });

    it('(e) lifts a mark with no hung payment', async () => {
        const { subscriptionId, userId } = await markPaymentFixture();
        const opened = await open({ subscriptionId, userId, reason: 'DIVERGENCIA_DE_MONTO' });
        expect(await countUnresolved(opened.mark.id)).toBe(0);

        await expect(
            liftReconciliationMark(
                { markId: opened.mark.id, expectedVersion: opened.mark.version, liftedBy: userId },
                { clock, markPayments: realPort() }
            )
        ).resolves.toMatchObject({
            outcome: 'LIFTED',
            mark: { liftedBy: userId, liftedAt: clock.now() }
        });
    });

    it('(f) an unresolved payment on ANOTHER open mark of the same row does not block this one', async () => {
        const { subscriptionId, userId } = await markPaymentFixture();
        const payment = await seedProviderPayment({ subscriptionId });
        const other = await open({ subscriptionId, userId, reason: 'COBRO_DUPLICADO', payment });
        const target = await open({ subscriptionId, userId, reason: 'DIVERGENCIA_DE_MONTO' });

        await expect(
            liftReconciliationMark(
                { markId: target.mark.id, expectedVersion: target.mark.version, liftedBy: userId },
                { clock, markPayments: realPort() }
            )
        ).resolves.toMatchObject({ outcome: 'LIFTED' });
        expect(await liftedAt(other.mark.id)).toBeNull();
        expect(await countUnresolved(other.mark.id)).toBe(1);
    });

    // S15 only READ the mark (a plain SELECT takes no row lock), so the racing S14 on
    // another connection is never blocked: it bumps the version and hangs its payment
    // and commits. S15 then writes `lifted_at` with `WHERE version = expectedVersion`,
    // which no longer matches, so the write fails by version. On reread the guard sees
    // the payment S14 hung and no longer holds.
    it('(g) S14 hanging a payment between the S15 read and write makes the lift fail by version, and the reread guard holds', async () => {
        const { subscriptionId, userId } = await markPaymentFixture();
        const opened = await open({ subscriptionId, userId, reason: 'COBRO_DUPLICADO' });
        const racingPayment = await seedProviderPayment({ subscriptionId });
        const real = realPort();
        let racedOutcome: string | null = null;
        const racingPort: ReconciliationMarkPayments = {
            hang: (input) => real.hang(input),
            async countUnresolved(input) {
                const unresolved = await real.countUnresolved(input);
                const raced = await open({
                    subscriptionId,
                    userId,
                    reason: 'COBRO_DUPLICADO',
                    payment: racingPayment
                });
                racedOutcome = raced.outcome;
                return unresolved;
            }
        };

        await expect(
            liftReconciliationMark(
                { markId: opened.mark.id, expectedVersion: opened.mark.version, liftedBy: userId },
                { clock, markPayments: racingPort }
            )
        ).rejects.toMatchObject({ reason: 'MARK_VERSION_CONFLICT' });
        expect(racedOutcome).toBe('ACCUMULATED');

        const reread = await reconciliationMarkModel.findById({ markId: opened.mark.id });
        if (!reread) throw new Error('No mark after the version conflict');
        expect(reread.version).toBe(opened.mark.version + 1);
        await expect(
            liftReconciliationMark(
                { markId: reread.id, expectedVersion: reread.version, liftedBy: userId },
                { clock, markPayments: realPort() }
            )
        ).rejects.toMatchObject({ reason: 'MARK_HAS_UNRESOLVED_PAYMENTS' });
        expect(await liftedAt(opened.mark.id)).toBeNull();
        const rows = await hungRows({ markId: opened.mark.id });
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ payment_id: racingPayment.id, resolved_at: null });
    });

    it('(h) the same race with a manual payment', async () => {
        const { subscriptionId, userId } = await markPaymentFixture();
        const opened = await open({ subscriptionId, userId, reason: 'COBRO_DUPLICADO' });
        const racingPayment = await seedManualPayment({ subscriptionId });
        const real = realPort();
        const racingPort: ReconciliationMarkPayments = {
            hang: (input) => real.hang(input),
            async countUnresolved(input) {
                const unresolved = await real.countUnresolved(input);
                await open({
                    subscriptionId,
                    userId,
                    reason: 'COBRO_DUPLICADO',
                    payment: racingPayment
                });
                return unresolved;
            }
        };

        await expect(
            liftReconciliationMark(
                { markId: opened.mark.id, expectedVersion: opened.mark.version, liftedBy: userId },
                { clock, markPayments: racingPort }
            )
        ).rejects.toMatchObject({ reason: 'MARK_VERSION_CONFLICT' });
        const reread = await reconciliationMarkModel.findById({ markId: opened.mark.id });
        if (!reread) throw new Error('No mark after the version conflict');
        await expect(
            liftReconciliationMark(
                { markId: reread.id, expectedVersion: reread.version, liftedBy: userId },
                { clock, markPayments: realPort() }
            )
        ).rejects.toMatchObject({ reason: 'MARK_HAS_UNRESOLVED_PAYMENTS' });
        expect(await liftedAt(opened.mark.id)).toBeNull();
        expect(await hungRows({ markId: opened.mark.id })).toMatchObject([
            { manual_payment_id: racingPayment.id, resolved_at: null }
        ]);
    });
});
