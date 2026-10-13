import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import {
    and,
    coveredPeriods,
    emailOutbox,
    eq,
    inArray,
    isNull,
    payments,
    reconciliationMarkPayments,
    reconciliationMarks,
    subscriptions
} from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { resolveSubscriptionSources } from '../../../src/services/billing/coverage/subscription-sources.js';
import { creditedPaymentsFromLedger } from '../../../src/services/billing/payment/payment-ledger.js';
import type { CoverageNotices } from '../../../src/services/billing/payment/payment-ports.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { graceExpiredOccurrenceId } from '../../../src/services/billing/reconciliation/sweep/grace-expiry-check.js';
import { billingPeriodEnd } from '../../../src/services/billing/subscription/billing-period-end.js';
import { reactivateSuspendedOnCreditedPayment } from '../../../src/services/billing/subscription/reactivate-suspended.service.js';
import { suspendForArrears } from '../../../src/services/billing/subscription/suspend-for-arrears.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { graceWithFailedCycle } from './support/grace-fixtures.js';

afterAll(closeServiceTestPool);

type Fixture = Awaited<ReturnType<typeof graceWithFailedCycle>>;

const HOUR_MS = 3_600_000;
const seeded: { subscriptionIds: string[]; userId: string }[] = [];

/** Retires each case's rows, marks and outbox rows so no live row or open mark outlives it. */
afterEach(async () => {
    const db = getServiceTestDb();
    for (const { subscriptionIds, userId } of seeded.splice(0)) {
        await db
            .update(reconciliationMarks)
            .set({ liftedAt: new Date(), liftedBy: userId })
            .where(
                and(
                    inArray(reconciliationMarks.subscriptionId, subscriptionIds),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
        await db
            .update(subscriptions)
            .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
            .where(inArray(subscriptions.id, subscriptionIds));
        await db.delete(emailOutbox).where(eq(emailOutbox.recipientUserId, userId));
    }
});

function track(fixture: Fixture, ...extra: string[]): void {
    seeded.push({
        subscriptionIds: [fixture.started.subscriptionId, ...extra],
        userId: fixture.user.id
    });
}

async function subscriptionRow(id: string) {
    const [row] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, id));
    if (!row) throw new Error('Subscription disappeared');
    return row;
}

async function openMarks(subscriptionId: string) {
    return getServiceTestDb()
        .select()
        .from(reconciliationMarks)
        .where(
            and(
                eq(reconciliationMarks.subscriptionId, subscriptionId),
                isNull(reconciliationMarks.liftedAt)
            )
        );
}

async function paymentFor(chargeId: string) {
    const [row] = await getServiceTestDb()
        .select()
        .from(payments)
        .where(eq(payments.providerFactId, chargeId));
    if (!row) throw new Error('Payment fact missing');
    return row;
}

async function hungMarkIds(paymentId: string) {
    const hung = await getServiceTestDb()
        .select()
        .from(reconciliationMarkPayments)
        .where(eq(reconciliationMarkPayments.paymentId, paymentId));
    return hung.map((entry) => entry.markId);
}

/** A coverage listener that records each event with the row status it saw at emission. */
function coverageSpy(subscriptionId: string) {
    const seen: { event: CoverageChangedEvent; statusAtEmit: string }[] = [];
    const coverageNotices: CoverageNotices = {
        emitCoverageChanged: vi.fn(async (event) => {
            const row = await subscriptionRow(subscriptionId);
            seen.push({ event, statusAtEmit: row.status });
        })
    };
    const added = () => seen.filter(({ event }) => event.change === 'ADDED');
    return { coverageNotices, seen, added };
}

/** Seeds a live principal successor of the same user + vertical pointing at `succeedsId`. */
async function seedLiveSuccessor(fixture: Fixture, succeedsId: string) {
    const own = await subscriptionRow(fixture.started.subscriptionId);
    const [successor] = await getServiceTestDb()
        .insert(subscriptions)
        .values({
            userId: own.userId,
            vertical: own.vertical,
            planVersionId: own.planVersionId,
            billingOptionId: own.billingOptionId,
            paymentMethod: 'CARD',
            class: 'PRINCIPAL',
            status: 'PENDING_AUTHORIZATION',
            succeedsId
        })
        .returning();
    if (!successor) throw new Error('Could not seed successor');
    return successor;
}

/**
 * A card principal moved from GRACE_PERIOD to SUSPENDED the way S6 leaves it with
 * H1-A (clock kept), but with its authorization still `active` at the provider:
 * the «preapproval reactivated by hand» edge (H6). `keepClock: false` seeds a row
 * without an anchor (H4).
 */
async function suspendedByHand({
    approveOnAttempt,
    keepClock = true
}: {
    readonly approveOnAttempt?: 2 | 3 | 4;
    readonly keepClock?: boolean;
} = {}) {
    const fixture = await graceWithFailedCycle({ approveOnAttempt });
    const subscriptionId = fixture.started.subscriptionId;
    await getServiceTestDb()
        .update(subscriptions)
        .set({
            status: 'SUSPENDED',
            ...(keepClock ? {} : { graceStartedAt: null, graceEndsAt: null })
        })
        .where(eq(subscriptions.id, subscriptionId));
    const spy = coverageSpy(subscriptionId);
    const ports = { ...fixture.ports, coverageNotices: spy.coverageNotices };
    return { fixture, subscriptionId, spy, ports };
}

describe('TEST:B7:8 — S7 from SUSPENDED (AC:B7:13)', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'a — a charge in flight at S6 lands on a cancelled authorization: CANCEL_SCHEDULED until the end of the paid period',
        async () => {
            // Arrange: grace by a failed cycle that the provider approves on attempt 3 (D-9).
            const fixture = await graceWithFailedCycle({ approveOnAttempt: 3 });
            track(fixture);
            const subscriptionId = fixture.started.subscriptionId;
            const spy = coverageSpy(subscriptionId);
            const inGrace = await subscriptionRow(subscriptionId);
            if (!inGrace.graceEndsAt) throw new Error('Grace clock missing');
            const graceEndsAt = inGrace.graceEndsAt;
            fixture.clock.advance({
                ms: graceEndsAt.getTime() + HOUR_MS - fixture.clock.now().getTime()
            });
            const suspension = await suspendForArrears(
                {
                    subscriptionId,
                    event: 'GRACE_EXPIRED',
                    occurrenceId: graceExpiredOccurrenceId({ subscriptionId, graceEndsAt })
                },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                    coverageNotices: spy.coverageNotices
                }
            );
            expect(suspension).toMatchObject({ outcome: 'SUSPENDED', cancelCall: 'SENT' });
            const authorization = await fixture.provider.readAuthorization({
                authorizationId: fixture.started.authorizationId
            });
            expect(authorization.snapshot.status).toBe('cancelled');
            fixture.advanceToAttempt(3);
            const approved = await fixture.provider.readCharge({ chargeId: fixture.chargeId });
            expect(approved.snapshot.status).toBe('approved');

            // Act
            const result = await recordChargeFact(
                { chargeId: fixture.chargeId },
                { ...fixture.ports, coverageNotices: spy.coverageNotices }
            );

            // Assert
            const payment = await paymentFor(fixture.chargeId);
            const [covered] = await getServiceTestDb()
                .select()
                .from(coveredPeriods)
                .where(eq(coveredPeriods.paymentId, payment.id));
            if (!covered) throw new Error('Covered period missing');
            const { periodEnd } = billingPeriodEnd({
                periodStart: covered.periodStart,
                everyMonths: authorization.snapshot.cadence.everyMonths
            });
            expect(result).toMatchObject({
                outcome: 'CREDITED',
                credit: { outcome: 'CREDITED' },
                reactivation: {
                    outcome: 'REACTIVATED',
                    subscriptionId,
                    destination: 'CANCEL_SCHEDULED',
                    serviceEndsAt: periodEnd
                }
            });
            const row = await subscriptionRow(subscriptionId);
            expect(row.status).toBe('CANCEL_SCHEDULED');
            expect(row.serviceEndsAt).toEqual(periodEnd);
            expect(row.graceStartedAt).toBeNull();
            expect(row.graceEndsAt).toBeNull();
            expect(spy.added()).toEqual([
                {
                    event: {
                        userId: fixture.user.id,
                        vertical: VerticalEnum.ACCOMMODATION,
                        sourceType: 'SUBSCRIPTION',
                        change: 'ADDED'
                    },
                    statusAtEmit: 'CANCEL_SCHEDULED'
                }
            ]);
            const { sources } = await resolveSubscriptionSources({
                userId: fixture.user.id,
                vertical: VerticalEnum.ACCOMMODATION,
                ports: { clock: fixture.clock, payments: creditedPaymentsFromLedger }
            });
            expect(sources).toHaveLength(1);
            expect(sources[0]?.until).toEqual(periodEnd);
            expect(await openMarks(subscriptionId)).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'b — an authorization reactivated by hand returns the row to ACTIVE and it emits a source again',
        async () => {
            // Arrange
            const s = await suspendedByHand({ approveOnAttempt: 2 });
            track(s.fixture);
            const before = await subscriptionRow(s.subscriptionId);
            expect(before.graceStartedAt).not.toBeNull();
            s.fixture.advanceToAttempt(2);

            // Act
            const result = await recordChargeFact({ chargeId: s.fixture.chargeId }, s.ports);

            // Assert
            expect(result).toMatchObject({
                outcome: 'CREDITED',
                reactivation: {
                    outcome: 'REACTIVATED',
                    destination: 'ACTIVE',
                    serviceEndsAt: null
                }
            });
            const row = await subscriptionRow(s.subscriptionId);
            expect(row.status).toBe('ACTIVE');
            expect(row.serviceEndsAt).toEqual(before.serviceEndsAt);
            expect(row.graceStartedAt).toBeNull();
            expect(row.graceEndsAt).toBeNull();
            expect(s.spy.added()).toHaveLength(1);
            expect(s.spy.added()[0]?.statusAtEmit).toBe('ACTIVE');
            const { sources } = await resolveSubscriptionSources({
                userId: s.fixture.user.id,
                vertical: VerticalEnum.ACCOMMODATION,
                ports: { clock: s.fixture.clock, payments: creditedPaymentsFromLedger }
            });
            expect(sources.map((source) => source.until)).toEqual(['NO_KNOWN_DATE']);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'c — the predecessor of a succession in progress is retained for S19: still SUSPENDED, no mark, no notice',
        async () => {
            // Arrange
            const s = await suspendedByHand({ approveOnAttempt: 2 });
            const successor = await seedLiveSuccessor(s.fixture, s.subscriptionId);
            track(s.fixture, successor.id);
            const before = await subscriptionRow(s.subscriptionId);
            s.fixture.advanceToAttempt(2);

            // Act
            const result = await recordChargeFact({ chargeId: s.fixture.chargeId }, s.ports);

            // Assert
            expect(result).toMatchObject({
                outcome: 'CREDITED',
                reactivation: { outcome: 'RETAINED_FOR_S19', subscriptionId: s.subscriptionId }
            });
            expect(await subscriptionRow(s.subscriptionId)).toEqual(before);
            expect(await openMarks(s.subscriptionId)).toHaveLength(0);
            expect(s.spy.added()).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'd — condition 3: another live principal of the same user + vertical keeps it SUSPENDED with reason 7',
        async () => {
            // Arrange
            const s = await suspendedByHand({ approveOnAttempt: 2 });
            const own = await subscriptionRow(s.subscriptionId);
            const [retired] = await getServiceTestDb()
                .insert(subscriptions)
                .values({
                    userId: own.userId,
                    vertical: own.vertical,
                    planVersionId: own.planVersionId,
                    billingOptionId: own.billingOptionId,
                    paymentMethod: 'CARD',
                    class: 'PRINCIPAL',
                    status: 'CANCELLED'
                })
                .returning();
            if (!retired) throw new Error('Could not seed the retired origin');
            const other = await seedLiveSuccessor(s.fixture, retired.id);
            track(s.fixture, other.id, retired.id);
            s.fixture.advanceToAttempt(2);

            // Act
            const result = await recordChargeFact({ chargeId: s.fixture.chargeId }, s.ports);

            // Assert
            expect(result).toMatchObject({
                reactivation: { outcome: 'CONDITION_FAILED', failedCondition: 3 }
            });
            expect((await subscriptionRow(s.subscriptionId)).status).toBe('SUSPENDED');
            const marks = await openMarks(s.subscriptionId);
            expect(marks.map((mark) => mark.reason)).toEqual(['PAGO_TARDIO_RECHAZADO']);
            const payment = await paymentFor(s.fixture.chargeId);
            expect(await hungMarkIds(payment.id)).toEqual([marks[0]?.id]);
            expect(s.spy.added()).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'e — condition 2: an amount different from the reread one keeps it SUSPENDED with reason 7',
        async () => {
            // Arrange
            const s = await suspendedByHand({ approveOnAttempt: 2 });
            track(s.fixture);
            await s.fixture.provider.changeAmount({
                authorizationId: s.fixture.started.authorizationId,
                amount: { amountMinor: 300000, currency: 'ARS' }
            });
            s.fixture.advanceToAttempt(2);

            // Act
            const result = await recordChargeFact({ chargeId: s.fixture.chargeId }, s.ports);

            // Assert
            expect(result).toMatchObject({
                reactivation: { outcome: 'CONDITION_FAILED', failedCondition: 2 }
            });
            const row = await subscriptionRow(s.subscriptionId);
            expect(row.status).toBe('SUSPENDED');
            expect(row.graceStartedAt).not.toBeNull();
            const marks = await openMarks(s.subscriptionId);
            expect(marks.map((mark) => mark.reason)).toEqual(['PAGO_TARDIO_RECHAZADO']);
            const payment = await paymentFor(s.fixture.chargeId);
            expect(await hungMarkIds(payment.id)).toEqual([marks[0]?.id]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'f — a replayed notice of the payment credited before the grace never leaves SUSPENDED (condition 4, no mark)',
        async () => {
            // Arrange
            const s = await suspendedByHand();
            track(s.fixture);
            const before = await subscriptionRow(s.subscriptionId);
            const previous = await paymentFor(s.fixture.initialChargeId);
            expect(previous.status).toBe('SUCCEEDED');
            s.fixture.clock.advance({ ms: 60_000 });

            // Act
            const replayed = await recordChargeFact(
                { chargeId: s.fixture.initialChargeId },
                s.ports
            );
            const direct = await reactivateSuspendedOnCreditedPayment(
                { paymentId: previous.id },
                s.ports
            );

            // Assert
            expect(replayed).toMatchObject({
                outcome: 'CREDITED',
                credit: { outcome: 'ALREADY_CREDITED' },
                reactivation: { outcome: 'CONDITION_FAILED', failedCondition: 4 }
            });
            expect(direct).toMatchObject({ outcome: 'CONDITION_FAILED', failedCondition: 4 });
            expect(await subscriptionRow(s.subscriptionId)).toEqual(before);
            expect(await openMarks(s.subscriptionId)).toHaveLength(0);
            expect(s.spy.added()).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'g — the row changes between the provider reread and the transaction: LOST_RACE, nothing written',
        async () => {
            // Arrange
            const s = await suspendedByHand({ approveOnAttempt: 2 });
            track(s.fixture);
            s.fixture.advanceToAttempt(2);
            let moved = false;
            const provider = new Proxy(s.fixture.provider, {
                get(target, property, receiver) {
                    if (property === 'readAuthorization')
                        return async (input: { readonly authorizationId: string }) => {
                            if (!moved) {
                                moved = true;
                                await getServiceTestDb()
                                    .update(subscriptions)
                                    .set({ status: 'CANCELLED' })
                                    .where(eq(subscriptions.id, s.subscriptionId));
                            }
                            return target.readAuthorization(input);
                        };
                    const value = Reflect.get(target, property, receiver);
                    return typeof value === 'function' ? value.bind(target) : value;
                }
            });
            const before = await subscriptionRow(s.subscriptionId);

            // Act
            const result = await recordChargeFact(
                { chargeId: s.fixture.chargeId },
                { ...s.ports, provider }
            );

            // Assert
            expect(moved).toBe(true);
            expect(result).toMatchObject({
                reactivation: { outcome: 'NOT_APPLICABLE', reason: 'LOST_RACE' }
            });
            const row = await subscriptionRow(s.subscriptionId);
            expect(row.status).toBe('CANCELLED');
            expect(row.graceStartedAt).toEqual(before.graceStartedAt);
            expect(row.serviceEndsAt).toEqual(before.serviceEndsAt);
            expect(await openMarks(s.subscriptionId)).toHaveLength(0);
            expect(s.spy.added()).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'g — two concurrent S7 on the same payment write once and notify once',
        async () => {
            // Arrange: credit the payment while the row is ACTIVE, then suspend it again.
            const s = await suspendedByHand({ approveOnAttempt: 2 });
            track(s.fixture);
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'ACTIVE' })
                .where(eq(subscriptions.id, s.subscriptionId));
            s.fixture.advanceToAttempt(2);
            const credited = await recordChargeFact({ chargeId: s.fixture.chargeId }, s.ports);
            expect(credited).toMatchObject({
                outcome: 'CREDITED',
                credit: { outcome: 'CREDITED' }
            });
            expect(credited.outcome === 'CREDITED' && credited.reactivation).toBe(undefined);
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'SUSPENDED' })
                .where(eq(subscriptions.id, s.subscriptionId));
            const payment = await paymentFor(s.fixture.chargeId);
            // Both calls pass the pre-read before either enters its transaction.
            let arrived = 0;
            let release: () => void = () => undefined;
            const barrier = new Promise<void>((resolve) => {
                release = resolve;
            });
            const provider = new Proxy(s.fixture.provider, {
                get(target, property, receiver) {
                    if (property === 'readAuthorization')
                        return async (input: { readonly authorizationId: string }) => {
                            arrived += 1;
                            if (arrived === 2) release();
                            await barrier;
                            return target.readAuthorization(input);
                        };
                    const value = Reflect.get(target, property, receiver);
                    return typeof value === 'function' ? value.bind(target) : value;
                }
            });

            // Act
            const results = await Promise.all([
                reactivateSuspendedOnCreditedPayment(
                    { paymentId: payment.id },
                    { ...s.ports, provider }
                ),
                reactivateSuspendedOnCreditedPayment(
                    { paymentId: payment.id },
                    { ...s.ports, provider }
                )
            ]);

            // Assert
            expect(results.filter((r) => r.outcome === 'REACTIVATED')).toHaveLength(1);
            expect(results.filter((r) => r.outcome === 'NOT_APPLICABLE')).toEqual([
                { outcome: 'NOT_APPLICABLE', reason: 'LOST_RACE', subscriptionId: s.subscriptionId }
            ]);
            expect((await subscriptionRow(s.subscriptionId)).status).toBe('ACTIVE');
            expect(s.spy.added()).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'h — a SUSPENDED row without an unpaid-period anchor does not reactivate and opens reason 7',
        async () => {
            // Arrange
            const s = await suspendedByHand({ approveOnAttempt: 2, keepClock: false });
            track(s.fixture);
            s.fixture.advanceToAttempt(2);

            // Act
            const result = await recordChargeFact({ chargeId: s.fixture.chargeId }, s.ports);

            // Assert
            expect(result).toMatchObject({
                reactivation: { outcome: 'NOT_APPLICABLE', reason: 'NO_UNPAID_ANCHOR' }
            });
            expect((await subscriptionRow(s.subscriptionId)).status).toBe('SUSPENDED');
            const marks = await openMarks(s.subscriptionId);
            expect(marks.map((mark) => mark.reason)).toEqual(['PAGO_TARDIO_RECHAZADO']);
            const payment = await paymentFor(s.fixture.chargeId);
            expect(await hungMarkIds(payment.id)).toEqual([marks[0]?.id]);
            expect(s.spy.added()).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'i — an authorization reread as paused is undecidable: nothing written, nothing marked',
        async () => {
            // Arrange
            const s = await suspendedByHand({ approveOnAttempt: 2 });
            track(s.fixture);
            s.fixture.advanceToAttempt(2);
            const approved = await s.fixture.provider.readCharge({ chargeId: s.fixture.chargeId });
            expect(approved.snapshot.status).toBe('approved');
            await s.fixture.provider.pause({ authorizationId: s.fixture.started.authorizationId });
            const before = await subscriptionRow(s.subscriptionId);

            // Act
            const result = await recordChargeFact({ chargeId: s.fixture.chargeId }, s.ports);

            // Assert
            expect(result).toMatchObject({
                reactivation: { outcome: 'NOT_APPLICABLE', reason: 'UNDECIDABLE_AUTHORIZATION' }
            });
            expect(await subscriptionRow(s.subscriptionId)).toEqual(before);
            expect(await openMarks(s.subscriptionId)).toHaveLength(0);
            expect(s.spy.added()).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'j — S7 does not run on a row that is not SUSPENDED; S5 still runs on GRACE_PERIOD',
        async () => {
            // Arrange
            const fixture = await graceWithFailedCycle({ approveOnAttempt: 2 });
            track(fixture);
            const subscriptionId = fixture.started.subscriptionId;
            const previous = await paymentFor(fixture.initialChargeId);

            // Act / Assert: GRACE_PERIOD
            expect(
                await reactivateSuspendedOnCreditedPayment(
                    { paymentId: previous.id },
                    { provider: fixture.provider, clock: fixture.clock }
                )
            ).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'NOT_SUSPENDED', subscriptionId });
            fixture.advanceToAttempt(2);
            const result = await recordChargeFact({ chargeId: fixture.chargeId }, fixture.ports);
            expect(result).toMatchObject({ outcome: 'CREDITED', exit: { outcome: 'REACTIVATED' } });
            expect(result.outcome === 'CREDITED' && result.reactivation).toBe(undefined);

            // Act / Assert: ACTIVE
            const active = await subscriptionRow(subscriptionId);
            expect(active.status).toBe('ACTIVE');
            const payment = await paymentFor(fixture.chargeId);
            expect(
                await reactivateSuspendedOnCreditedPayment(
                    { paymentId: payment.id },
                    { provider: fixture.provider, clock: fixture.clock }
                )
            ).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'NOT_SUSPENDED', subscriptionId });
            expect(await subscriptionRow(subscriptionId)).toEqual(active);
        }
    );
});
