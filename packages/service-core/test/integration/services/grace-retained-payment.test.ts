import {
    coverageLosses,
    emailOutbox,
    eq,
    reconciliationMarkPayments,
    subscriptions,
    successionRetainedPayments
} from '@repo/db';
import { type LogEntry, registerHook, unregisterHook } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import {
    noDeterminableRetainedPaymentBranch,
    retainedPaymentsFromLedger
} from '../../../src/services/billing/reconciliation/sweep/succession-retention-ports.js';
import { runZeroCallChecks } from '../../../src/services/billing/reconciliation/sweep/zero-call-checks.service.js';
import { requestRefund } from '../../../src/services/billing/refund/request-refund.service.js';
import { settleExternalRefund } from '../../../src/services/billing/refund/settle-external-refund.service.js';
import { exitGraceOnCreditedPayment } from '../../../src/services/billing/subscription/exit-grace.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { seedAdminActor } from './support/refund-fixtures.js';
import {
    domainEventsOf,
    expireSuccessorWindow,
    openMarksOf,
    paymentFor,
    predecessorInGrace,
    refundsOf,
    retainInOwnTransaction,
    retentionsOf,
    retireSuccessionCases,
    runS3,
    type SeededSuccession,
    seedStuckSuccessionMark,
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
            // The retention won, so S6 wrote nothing at all: not even HOS-1534's coverage_loss row.
            expect(row.userId).not.toBeNull();
            const losses = await getServiceTestDb()
                .select({ vertical: coverageLosses.vertical })
                .from(coverageLosses)
                .where(eq(coverageLosses.userId, row.userId ?? ''));
            expect(losses).toEqual([]);
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

    it.skipIf(!isServiceTestDbAvailable())(
        'e — branch 2 from GRACE_PERIOD: S3 abandons the successor and S5 reactivates the predecessor, closing the retention REEVALUATED',
        async () => {
            // Arrange
            const s = await predecessorInGrace({ approveOnAttempt: 2 });
            seeded.push(s.seeded);
            s.fixture.advanceToAttempt(2);
            const retained = await recordChargeFact(
                { chargeId: s.fixture.chargeId },
                s.chargePorts
            );
            expect(retained).toMatchObject({ exit: { outcome: 'RETAINED_FOR_S19' } });
            const payment = await paymentFor(s.fixture.chargeId);
            await expireSuccessorWindow(s);

            // Act
            const summary = await runS3(s);

            // Assert
            expect(summary).toMatchObject({ abandoned: 1, retainedReevaluated: 1 });
            expect((await subscriptionRow(s.successor.id)).status).toBe('ABANDONED');
            const row = await subscriptionRow(s.subscriptionId);
            expect(row.status).toBe('ACTIVE');
            expect(row.graceStartedAt).toBeNull();
            expect(row.graceEndsAt).toBeNull();
            const retentions = await retentionsOf(s.subscriptionId);
            expect(retentions).toHaveLength(1);
            expect(retentions[0]).toMatchObject({
                paymentId: payment.id,
                releaseReason: 'REEVALUATED'
            });
            expect(retentions[0]?.releasedAt).toBeInstanceOf(Date);
            expect(await openMarksOf(s.subscriptionId)).toHaveLength(0);
            expect(await refundsOf(payment.id)).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'e — branch 2 from SUSPENDED: S7 brings the predecessor back (CANCEL_SCHEDULED, authorization cancelled) and closes the retention REEVALUATED',
        async () => {
            // Arrange: S6 cancels the authorization; the in-flight retry is retained by S7.
            const s = await predecessorInGrace({ approveOnAttempt: 3 });
            seeded.push(s.seeded);
            s.expireClock();
            expect(await s.runS6()).toMatchObject({ outcome: 'SUSPENDED' });
            s.fixture.advanceToAttempt(3);
            const retained = await recordChargeFact(
                { chargeId: s.fixture.chargeId },
                s.chargePorts
            );
            expect(retained).toMatchObject({ reactivation: { outcome: 'RETAINED_FOR_S19' } });
            const payment = await paymentFor(s.fixture.chargeId);
            const [open] = await retentionsOf(s.subscriptionId);
            expect(open?.unpaidSince).toEqual(s.graceStartedAt);
            await expireSuccessorWindow(s);
            const coverageBefore = s.coverageSeen.length;

            // Act
            const summary = await runS3(s);

            // Assert
            expect(summary).toMatchObject({ abandoned: 1, retainedReevaluated: 1 });
            expect((await subscriptionRow(s.successor.id)).status).toBe('ABANDONED');
            const row = await subscriptionRow(s.subscriptionId);
            expect(row.status).toBe('CANCEL_SCHEDULED');
            expect(row.serviceEndsAt).toBeInstanceOf(Date);
            expect(row.graceStartedAt).toBeNull();
            const retentions = await retentionsOf(s.subscriptionId);
            expect(retentions).toHaveLength(1);
            expect(retentions[0]).toMatchObject({
                paymentId: payment.id,
                unpaidSince: s.graceStartedAt,
                releaseReason: 'REEVALUATED'
            });
            expect(retentions[0]?.releasedAt).toBeInstanceOf(Date);
            expect(await openMarksOf(s.subscriptionId)).toHaveLength(0);
            expect(s.coverageSeen.slice(coverageBefore).map((event) => event.change)).toContain(
                'ADDED'
            );
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'e — branch 2 with a failing condition (amount differs): still in grace, reason 7 with the payment hung, retention closed REEVALUATED',
        async () => {
            // Arrange
            const s = await predecessorInGrace({ approveOnAttempt: 2 });
            seeded.push(s.seeded);
            s.fixture.advanceToAttempt(2);
            await recordChargeFact({ chargeId: s.fixture.chargeId }, s.chargePorts);
            const payment = await paymentFor(s.fixture.chargeId);
            await (s.fixture.provider as PaymentProvider).changeAmount({
                authorizationId: s.fixture.started.authorizationId,
                amount: { amountMinor: 300000, currency: 'ARS' }
            });
            await expireSuccessorWindow(s);

            // Act
            const summary = await runS3(s);

            // Assert
            expect(summary).toMatchObject({ abandoned: 1, retainedReevaluated: 1 });
            expect((await subscriptionRow(s.subscriptionId)).status).toBe('GRACE_PERIOD');
            const marks = await openMarksOf(s.subscriptionId);
            expect(marks.map((mark) => mark.reason)).toEqual(['PAGO_TARDIO_RECHAZADO']);
            const hung = await getServiceTestDb()
                .select()
                .from(reconciliationMarkPayments)
                .where(eq(reconciliationMarkPayments.markId, marks[0]?.id ?? ''));
            expect(hung.map((link) => link.paymentId)).toEqual([payment.id]);
            const [retention] = await retentionsOf(s.subscriptionId);
            expect(retention).toMatchObject({
                paymentId: payment.id,
                releaseReason: 'REEVALUATED'
            });
            expect(await refundsOf(payment.id)).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'f — branch 3, the stuck succession: with the mark seeded and the successor live nothing closes the retention; S6 does not run and the refund is rejected',
        async () => {
            // Arrange
            const s = await predecessorInGrace({ approveOnAttempt: 2 });
            seeded.push(s.seeded);
            s.fixture.advanceToAttempt(2);
            await recordChargeFact({ chargeId: s.fixture.chargeId }, s.chargePorts);
            const payment = await paymentFor(s.fixture.chargeId);
            await seedStuckSuccessionMark(s.subscriptionId);
            s.expireClock();

            // Act
            const suspension = await s.runS6();
            const refund = requestRefund(
                {
                    source: { kind: 'PAYMENT', id: payment.id },
                    amount: payment.amount,
                    reason: 'MARK_PROPOSAL'
                },
                { clock: s.fixture.clock }
            );

            // Assert
            expect(suspension).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'RETAINED_PAYMENT' });
            await expect(refund).rejects.toMatchObject({
                reason: 'RETAINED_PAYMENT_SUCCESSION_OPEN'
            });
            expect(s.cancel).not.toHaveBeenCalled();
            expect((await subscriptionRow(s.subscriptionId)).status).toBe('GRACE_PERIOD');
            expect((await subscriptionRow(s.successor.id)).status).toBe('PENDING_AUTHORIZATION');
            const [retention] = await retentionsOf(s.subscriptionId);
            expect(retention).toMatchObject({
                paymentId: payment.id,
                releasedAt: null,
                releaseReason: null
            });
            expect((await openMarksOf(s.subscriptionId)).map((mark) => mark.reason)).toEqual([
                'CANCELACION_SIN_CONFIRMAR'
            ]);
            expect(await refundsOf(payment.id)).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'i — the gate: RF1 and RF4 on the retained payment are rejected while the predecessor is live, and go through once it is CANCELLED',
        async () => {
            // Arrange
            const s = await predecessorInGrace({ approveOnAttempt: 2 });
            seeded.push(s.seeded);
            s.fixture.advanceToAttempt(2);
            await recordChargeFact({ chargeId: s.fixture.chargeId }, s.chargePorts);
            const payment = await paymentFor(s.fixture.chargeId);
            const admin = await seedAdminActor();
            const rf1 = () =>
                requestRefund(
                    {
                        source: { kind: 'PAYMENT', id: payment.id },
                        amount: 1000,
                        reason: 'MARK_PROPOSAL'
                    },
                    { clock: s.fixture.clock }
                );
            const rf4 = () =>
                settleExternalRefund(
                    {
                        actor: admin,
                        source: { kind: 'PAYMENT', id: payment.id },
                        amount: 1000,
                        channel: 'BANK_TRANSFER',
                        reference: `op-${crypto.randomUUID()}`,
                        reason: 'OUT_OF_FLOW_REFUND'
                    },
                    { clock: s.fixture.clock }
                );

            // Act + Assert: the predecessor is live (GRACE_PERIOD) and its retention is open.
            await expect(rf1()).rejects.toMatchObject({
                reason: 'RETAINED_PAYMENT_SUCCESSION_OPEN'
            });
            await expect(rf4()).rejects.toMatchObject({
                reason: 'RETAINED_PAYMENT_SUCCESSION_OPEN'
            });
            expect(await refundsOf(payment.id)).toHaveLength(0);

            // Arrange: branches 1, 5 and 6 leave the predecessor CANCELLED (seeded).
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
                .where(eq(subscriptions.id, s.subscriptionId));

            // Act
            const requested = await rf1();
            const settled = await rf4();

            // Assert
            const refunds = await refundsOf(payment.id);
            // RF4 may close the open RF1 instead of creating another row (AC:B5:41).
            expect(new Set(refunds.map((refund) => refund.id))).toEqual(
                new Set([requested.refundId, settled.refundId])
            );
            expect((await retentionsOf(s.subscriptionId))[0]?.releasedAt).toBeNull();
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'l — the sweep: a retention whose successor died opens PAGO_PENDIENTE_SIN_RAMA with the payment hung once; a second run neither fails nor hangs it again',
        async () => {
            // Arrange: the successor died without S3 (seeded ABANDONED), so no act closed the flag.
            const s = await predecessorInGrace({ approveOnAttempt: 2 });
            seeded.push(s.seeded);
            s.fixture.advanceToAttempt(2);
            await recordChargeFact({ chargeId: s.fixture.chargeId }, s.chargePorts);
            const payment = await paymentFor(s.fixture.chargeId);
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'ABANDONED' })
                .where(eq(subscriptions.id, s.successor.id));
            // The ports the cron wires (billing-reconciliation-sweep.job.ts).
            const ports = {
                retainedPayments: retainedPaymentsFromLedger,
                retainedPaymentBranches: noDeterminableRetainedPaymentBranch,
                markPayments: createPaymentReconciliationMarkPayments(s.fixture.clock)
            };
            const ownFailures = (summary: Awaited<ReturnType<typeof runZeroCallChecks>>) =>
                summary.failures.filter((failure) => failure.subjectId === s.subscriptionId);
            const hungOf = async (markId: string) =>
                getServiceTestDb()
                    .select()
                    .from(reconciliationMarkPayments)
                    .where(eq(reconciliationMarkPayments.markId, markId));

            // Act
            const first = await runZeroCallChecks({}, ports);

            // Assert
            expect(ownFailures(first)).toEqual([]);
            const marks = await openMarksOf(s.subscriptionId);
            expect(marks.map((mark) => mark.reason)).toEqual(['PAGO_PENDIENTE_SIN_RAMA']);
            const markId = marks[0]?.id ?? '';
            const hung = await hungOf(markId);
            expect(hung).toHaveLength(1);
            expect(hung[0]).toMatchObject({ paymentId: payment.id, resolvedAt: null });
            expect(
                (await retentionsOf(s.subscriptionId)).map((retention) => retention.releasedAt)
            ).toEqual([null]);
            const listed = await retainedPaymentsFromLedger.listRetainedPayments();
            expect(listed.filter((row) => row.subscriptionId === s.subscriptionId)).toEqual([]);

            // Act: the next day's run.
            const second = await runZeroCallChecks({}, ports);

            // Assert
            expect(ownFailures(second)).toEqual([]);
            expect((await openMarksOf(s.subscriptionId)).map((mark) => mark.id)).toEqual([markId]);
            expect(await hungOf(markId)).toHaveLength(1);
            expect(await refundsOf(payment.id)).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'l — the sweep leaves a retention with its successor live untouched, and never lists a closed one',
        async () => {
            // Arrange
            const live = await predecessorInGrace({ approveOnAttempt: 2 });
            seeded.push(live.seeded);
            live.fixture.advanceToAttempt(2);
            await recordChargeFact({ chargeId: live.fixture.chargeId }, live.chargePorts);
            const livePayment = await paymentFor(live.fixture.chargeId);
            const closed = await predecessorInGrace({ approveOnAttempt: 2 });
            seeded.push(closed.seeded);
            closed.fixture.advanceToAttempt(2);
            await recordChargeFact({ chargeId: closed.fixture.chargeId }, closed.chargePorts);
            const db = getServiceTestDb();
            await db
                .update(successionRetainedPayments)
                .set({ releasedAt: new Date(), releaseReason: 'REEVALUATED' })
                .where(eq(successionRetainedPayments.subscriptionId, closed.subscriptionId));
            await db
                .update(subscriptions)
                .set({ status: 'ABANDONED' })
                .where(eq(subscriptions.id, closed.successor.id));

            // Act
            const listed = await retainedPaymentsFromLedger.listRetainedPayments();
            const summary = await runZeroCallChecks(
                {},
                {
                    retainedPayments: retainedPaymentsFromLedger,
                    retainedPaymentBranches: noDeterminableRetainedPaymentBranch,
                    markPayments: createPaymentReconciliationMarkPayments(live.fixture.clock)
                }
            );

            // Assert
            const own = listed.filter((row) =>
                [live.subscriptionId, closed.subscriptionId].includes(row.subscriptionId)
            );
            expect(own).toEqual([
                {
                    subscriptionId: live.subscriptionId,
                    payment: { source: 'PAYMENT', id: livePayment.id }
                }
            ]);
            expect(
                summary.failures.filter((failure) =>
                    [live.subscriptionId, closed.subscriptionId].includes(failure.subjectId ?? '')
                )
            ).toEqual([]);
            expect(await openMarksOf(live.subscriptionId)).toHaveLength(0);
            expect(await openMarksOf(closed.subscriptionId)).toHaveLength(0);
            expect(
                (await retentionsOf(live.subscriptionId)).map((retention) => retention.releasedAt)
            ).toEqual([null]);
        }
    );
});
