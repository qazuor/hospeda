// HOS-1676, AC:1676:5 (TEST:1676:5): the refund gate of GUARD:G-R1-D and S19 serialize on the
// PAYMENT (Coord-305/316, H-12). The gate (`assertRetainedPaymentRefundable`, after
// `lockRefundSource`) locks the payment, not the subscription, so S19 locks the payment too.
// Each case runs two real transactions on two pool connections.
//
// Cleanup: `retireSuccessionCases` deletes the retentions and refunds BEFORE anything that
// points at the payments, lifts the marks and takes the rows to CANCELLED; the users'
// `coverage_loss` rows go with them.
import { setTimeout as delay } from 'node:timers/promises';
import { coverageLosses, eq, inArray, subscriptions } from '@repo/db';
import { type LogEntry, registerHook, unregisterHook } from '@repo/logger';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { requestRefund } from '../../../src/services/billing/refund/request-refund.service.js';
import { retainPaymentForSuccession } from '../../../src/services/billing/subscription/succession-retained-payment.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    paymentFor,
    predecessorInGrace,
    refundsOf,
    retainInOwnTransaction,
    retentionsOf,
    retireSuccessionCases,
    type SeededSuccession
} from './support/succession-retention-fixtures.js';

/** How long a blocked transaction must stay blocked to count as waiting on the lock. */
const BLOCKED_MS = 1_500;
const HOOK = 'hos1676-retained-refund-race';
const seeded: SeededSuccession[] = [];

afterAll(closeServiceTestPool);
afterEach(async () => {
    unregisterHook(HOOK);
    const cases = seeded.splice(0);
    await retireSuccessionCases(cases);
    if (cases.length > 0)
        await getServiceTestDb()
            .delete(coverageLosses)
            .where(
                inArray(
                    coverageLosses.userId,
                    cases.map((own) => own.userId)
                )
            );
});

type Settled =
    | { readonly kind: 'RESOLVED'; readonly value: unknown }
    | { readonly kind: 'REJECTED'; readonly error: unknown };

/** Observes a promise without letting its rejection escape. */
async function settle(promise: Promise<unknown>): Promise<Settled> {
    try {
        return { kind: 'RESOLVED', value: await promise };
    } catch (error) {
        return { kind: 'REJECTED', error };
    }
}

/** Whether `settled` is still pending after `ms`. */
async function stillPending(settled: Promise<Settled>, ms = BLOCKED_MS): Promise<boolean> {
    const first = await Promise.race([settled, delay(ms, 'PENDING' as const)]);
    return first === 'PENDING';
}

/** A one-shot gate: `open()` releases every `wait()`. */
function gate() {
    let open: () => void = () => {};
    const opened = new Promise<void>((resolve) => {
        open = resolve;
    });
    return { open: () => open(), wait: () => opened };
}

/** A predecessor in GRACE_PERIOD with a live successor and its credited initial payment. */
async function retainableCase() {
    const s = await predecessorInGrace();
    seeded.push(s.seeded);
    const payment = await paymentFor(s.fixture.initialChargeId);
    expect(payment.status).toBe('SUCCEEDED');
    const rf1 = (tx?: Parameters<typeof requestRefund>[1]['tx']) =>
        requestRefund(
            {
                source: { kind: 'PAYMENT', id: payment.id },
                amount: payment.amount,
                reason: 'MARK_PROPOSAL'
            },
            { clock: s.fixture.clock, ...(tx ? { tx } : {}) }
        );
    return { s, payment, rf1 };
}

describe('TEST:1676:5 the refund gate and S19 serialize on the payment', () => {
    it('TEST:1676:5 (i) S19 locks the payment first ⇒ RF1 waits for its commit and is rejected RETAINED_PAYMENT_SUCCESSION_OPEN, with no refund', {
        timeout: 30_000
    }, async () => {
        const { s, payment, rf1 } = await retainableCase();
        const retained = gate();
        const commitS19 = gate();

        const t1 = settle(
            getServiceTestDb().transaction(async (tx) => {
                await tx
                    .select({ id: subscriptions.id })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, s.subscriptionId))
                    .for('update');
                const result = await retainPaymentForSuccession({
                    subscriptionId: s.subscriptionId,
                    payment: { source: 'PAYMENT', id: payment.id },
                    unpaidSince: s.graceStartedAt,
                    now: s.fixture.clock.now(),
                    tx
                });
                retained.open();
                await commitS19.wait();
                return result;
            })
        );
        try {
            await retained.wait();
            const t2 = settle(rf1());

            expect(await stillPending(t2)).toBe(true);

            commitS19.open();
            expect(await t1).toEqual({ kind: 'RESOLVED', value: { outcome: 'RETAINED' } });
            const refund = await t2;
            expect(refund.kind).toBe('REJECTED');
            expect(refund.kind === 'REJECTED' ? refund.error : null).toMatchObject({
                reason: 'RETAINED_PAYMENT_SUCCESSION_OPEN'
            });
            expect(await refundsOf(payment.id)).toEqual([]);
            expect(
                (await retentionsOf(s.subscriptionId)).map((row) => [row.paymentId, row.releasedAt])
            ).toEqual([[payment.id, null]]);
        } finally {
            commitS19.open();
            await t1;
        }
    });

    it('TEST:1676:5 (ii) RF1 locks the payment first ⇒ S19 waits, then retains anyway with a warn (H-13 A); a later RF1 is rejected', {
        timeout: 30_000
    }, async () => {
        const { s, payment, rf1 } = await retainableCase();
        const warnings: LogEntry[] = [];
        registerHook(HOOK, (entry) => {
            if (entry.level === 'WARN' && entry.category === 'succession-retained-payment')
                warnings.push(entry);
        });
        const requested = gate();
        const commitRf1 = gate();

        const t2 = settle(
            getServiceTestDb().transaction(async (tx) => {
                const result = await rf1(tx);
                requested.open();
                await commitRf1.wait();
                return result;
            })
        );
        try {
            await requested.wait();
            const t1 = settle(
                retainInOwnTransaction({
                    subscriptionId: s.subscriptionId,
                    paymentId: payment.id,
                    unpaidSince: s.graceStartedAt,
                    now: s.fixture.clock.now()
                })
            );

            expect(await stillPending(t1)).toBe(true);

            commitRf1.open();
            expect((await t2).kind).toBe('RESOLVED');
            expect(await t1).toEqual({ kind: 'RESOLVED', value: { outcome: 'RETAINED' } });
            expect((await refundsOf(payment.id)).map((row) => row.status)).toEqual(['REQUESTED']);
            expect((await retentionsOf(s.subscriptionId)).map((row) => row.releasedAt)).toEqual([
                null
            ]);
            expect(warnings).toHaveLength(1);

            // With a REQUESTED refund open and the retention open, the gate rejects first.
            await expect(rf1()).rejects.toMatchObject({
                reason: 'RETAINED_PAYMENT_SUCCESSION_OPEN'
            });
            expect(await refundsOf(payment.id)).toHaveLength(1);
        } finally {
            commitRf1.open();
            await t2;
        }
    });

    it('TEST:1676:5 (iii) control, no concurrency: S19 and then RF1 ⇒ rejected, no refund, no warn', {
        timeout: 30_000
    }, async () => {
        const { s, payment, rf1 } = await retainableCase();
        const warnings: LogEntry[] = [];
        registerHook(HOOK, (entry) => {
            if (entry.level === 'WARN' && entry.category === 'succession-retained-payment')
                warnings.push(entry);
        });

        expect(
            await retainInOwnTransaction({
                subscriptionId: s.subscriptionId,
                paymentId: payment.id,
                unpaidSince: s.graceStartedAt,
                now: s.fixture.clock.now()
            })
        ).toEqual({ outcome: 'RETAINED' });
        await expect(rf1()).rejects.toMatchObject({
            reason: 'RETAINED_PAYMENT_SUCCESSION_OPEN'
        });

        expect(await refundsOf(payment.id)).toEqual([]);
        expect(warnings).toEqual([]);
    });
});
