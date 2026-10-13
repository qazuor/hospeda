import { emailOutbox, eq } from '@repo/db';
import { type LogEntry, registerHook, unregisterHook } from '@repo/logger';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { exitGraceOnCreditedPayment } from '../../../src/services/billing/subscription/exit-grace.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    domainEventsOf,
    openMarksOf,
    paymentFor,
    predecessorInGrace,
    refundsOf,
    retainInOwnTransaction,
    retentionsOf,
    retireSuccessionCases,
    type SeededSuccession,
    subscriptionRow
} from './support/succession-retention-fixtures.js';

afterAll(closeServiceTestPool);

const HOOK = 'b74b-retained-payment-test';
const seeded: SeededSuccession[] = [];

/** Retentions first, then marks, outbox and rows (HOS-1561): nothing open outlives a case. */
afterEach(async () => {
    unregisterHook(HOOK);
    await retireSuccessionCases(seeded.splice(0));
});

/** The outbox rows of the user that name the arrears suspension notice. */
async function arrearsNotices(userId: string) {
    const rows = await getServiceTestDb()
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.recipientUserId, userId));
    return rows.filter((row) => JSON.stringify(row).includes('ARREARS_SUSPENSION'));
}

describe('TEST:B7:10 — S19 retains the unpaid-period payment (AC:B7:16)', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'a — predecessor in GRACE_PERIOD: the recycled quota is retained, still in grace with its clock, no mark, no refund, no notice, no event',
        async () => {
            // Arrange
            const s = await predecessorInGrace({ approveOnAttempt: 2 });
            seeded.push(s.seeded);
            const before = await subscriptionRow(s.subscriptionId);
            const eventsBefore = await domainEventsOf(s.subscriptionId);
            s.fixture.advanceToAttempt(2);

            // Act
            const result = await recordChargeFact({ chargeId: s.fixture.chargeId }, s.chargePorts);

            // Assert
            expect(result).toMatchObject({
                outcome: 'CREDITED',
                exit: { outcome: 'RETAINED_FOR_S19', subscriptionId: s.subscriptionId }
            });
            const payment = await paymentFor(s.fixture.chargeId);
            const retentions = await retentionsOf(s.subscriptionId);
            expect(retentions).toHaveLength(1);
            expect(retentions[0]).toMatchObject({
                paymentId: payment.id,
                manualPaymentId: null,
                unpaidSince: s.graceStartedAt,
                releasedAt: null,
                releaseReason: null
            });
            const row = await subscriptionRow(s.subscriptionId);
            expect(row.status).toBe('GRACE_PERIOD');
            expect(row.graceStartedAt).toEqual(before.graceStartedAt);
            expect(row.graceEndsAt).toEqual(before.graceEndsAt);
            expect(await openMarksOf(s.subscriptionId)).toHaveLength(0);
            expect(await refundsOf(payment.id)).toHaveLength(0);
            expect(s.coverageSeen).toEqual([]);
            expect(await domainEventsOf(s.subscriptionId)).toEqual(eventsBefore);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'b — predecessor in SUSPENDED (charge in flight at S6): S7 retains it, still SUSPENDED, no mark',
        async () => {
            // Arrange: S6 cancels the authorization; the retry of attempt 3 lands afterwards.
            const s = await predecessorInGrace({ approveOnAttempt: 3 });
            seeded.push(s.seeded);
            s.expireClock();
            expect(await s.runS6()).toMatchObject({ outcome: 'SUSPENDED', cancelCall: 'SENT' });
            const suspended = await subscriptionRow(s.subscriptionId);
            s.fixture.advanceToAttempt(3);
            const coverageBefore = s.coverageSeen.length;

            // Act
            const result = await recordChargeFact({ chargeId: s.fixture.chargeId }, s.chargePorts);

            // Assert
            expect(result).toMatchObject({
                outcome: 'CREDITED',
                reactivation: { outcome: 'RETAINED_FOR_S19', subscriptionId: s.subscriptionId }
            });
            const payment = await paymentFor(s.fixture.chargeId);
            const retentions = await retentionsOf(s.subscriptionId);
            expect(retentions).toHaveLength(1);
            expect(retentions[0]).toMatchObject({
                paymentId: payment.id,
                unpaidSince: s.graceStartedAt,
                releasedAt: null
            });
            expect(await subscriptionRow(s.subscriptionId)).toEqual(suspended);
            expect(await openMarksOf(s.subscriptionId)).toHaveLength(0);
            expect(await refundsOf(payment.id)).toHaveLength(0);
            expect(s.coverageSeen).toHaveLength(coverageBefore);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'c — the expired clock does not suspend while a retention is open (the sweep and S6 with their real default)',
        async () => {
            // Arrange
            const s = await predecessorInGrace();
            seeded.push(s.seeded);
            const retained = await paymentFor(s.fixture.initialChargeId);
            await retainInOwnTransaction({
                subscriptionId: s.subscriptionId,
                paymentId: retained.id,
                unpaidSince: s.graceStartedAt,
                now: s.fixture.clock.now()
            });
            s.expireClock();

            // Act
            await s.runCheck();
            const direct = await s.runS6();

            // Assert
            expect(direct).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'RETAINED_PAYMENT' });
            expect(s.beforeCancel).not.toHaveBeenCalled();
            expect(s.cancel).not.toHaveBeenCalled();
            expect(await s.authorizationStatus()).not.toBe('cancelled');
            expect(await arrearsNotices(s.fixture.user.id)).toHaveLength(0);
            const row = await subscriptionRow(s.subscriptionId);
            expect(row.status).toBe('GRACE_PERIOD');
            expect(row.graceEndsAt).toEqual(s.graceEndsAt);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'd — the race: a retention that appears after S6 guard and before its write keeps the row in grace and logs an error',
        async () => {
            // Arrange
            const s = await predecessorInGrace();
            seeded.push(s.seeded);
            const retained = await paymentFor(s.fixture.initialChargeId);
            s.setBeforeCancel(async () => {
                await retainInOwnTransaction({
                    subscriptionId: s.subscriptionId,
                    paymentId: retained.id,
                    unpaidSince: s.graceStartedAt,
                    now: s.fixture.clock.now()
                });
            });
            const errors: LogEntry[] = [];
            registerHook(HOOK, (entry) => {
                if (entry.level === 'ERROR' && entry.category === 'suspend-for-arrears')
                    errors.push(entry);
            });
            s.expireClock();

            // Act
            const result = await s.runS6();

            // Assert
            expect(result).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'RETAINED_PAYMENT' });
            expect(s.beforeCancel).toHaveBeenCalledTimes(1);
            expect(s.cancel).toHaveBeenCalledTimes(1);
            const row = await subscriptionRow(s.subscriptionId);
            expect(row.status).toBe('GRACE_PERIOD');
            expect(row.graceEndsAt).toEqual(s.graceEndsAt);
            expect(s.coverageSeen.filter((event) => event.change === 'REMOVED')).toHaveLength(0);
            expect(errors).toHaveLength(1);
            expect(
                (await retentionsOf(s.subscriptionId)).filter((r) => !r.releasedAt)
            ).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'j — replay: the same notice twice, S5 again and the sweep leave ONE open retention and no mark',
        async () => {
            // Arrange
            const s = await predecessorInGrace({ approveOnAttempt: 2 });
            seeded.push(s.seeded);
            s.fixture.advanceToAttempt(2);
            const first = await recordChargeFact({ chargeId: s.fixture.chargeId }, s.chargePorts);
            expect(first).toMatchObject({ exit: { outcome: 'RETAINED_FOR_S19' } });
            const payment = await paymentFor(s.fixture.chargeId);

            // Act
            await recordChargeFact({ chargeId: s.fixture.chargeId }, s.chargePorts);
            const again = await exitGraceOnCreditedPayment(
                { paymentId: payment.id },
                { provider: s.chargePorts.provider, clock: s.fixture.clock }
            );
            s.expireClock();
            await s.runCheck();

            // Assert
            expect(again).toEqual({
                outcome: 'RETAINED_FOR_S19',
                subscriptionId: s.subscriptionId
            });
            const open = (await retentionsOf(s.subscriptionId)).filter((r) => !r.releasedAt);
            expect(open).toHaveLength(1);
            expect(open[0]?.paymentId).toBe(payment.id);
            expect((await subscriptionRow(s.subscriptionId)).status).toBe('GRACE_PERIOD');
            expect(await openMarksOf(s.subscriptionId)).toHaveLength(0);
            expect(s.cancel).not.toHaveBeenCalled();
        }
    );
});
