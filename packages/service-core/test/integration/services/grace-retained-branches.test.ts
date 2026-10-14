import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import { and, coverageLosses, domainEvent, eq, inArray, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { mirrorProviderCancellationOnGrace } from '../../../src/services/billing/notice/mirror-cancelled-on-grace.js';
import { processProviderNotice } from '../../../src/services/billing/notice/process-provider-notice.service.js';
import type { MirrorDelegates } from '../../../src/services/billing/notice/provider-notice-ports.js';
import type { CoverageNotices } from '../../../src/services/billing/payment/payment-ports.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { activatePendingWithSignupNotice } from '../../../src/services/billing/subscription/activate-pending-with-signup-notice.js';
import type { SuccessionCloser } from '../../../src/services/billing/subscription/subscription-billing-ports.js';
import { closeSuccessionIfPredecessor } from '../../../src/services/billing/subscription/succession-end.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    authorizationDelivery,
    expireSuccessorWindow,
    openMarksOf,
    paymentFor,
    predecessorInGrace,
    refundsOf,
    retentionsOf,
    retireSuccessionCases,
    runS3,
    type SeededSuccession,
    spySuccessionCloser,
    subscriptionRow
} from './support/succession-retention-fixtures.js';

afterAll(closeServiceTestPool);

const seeded: SeededSuccession[] = [];

/**
 * Retentions first, then marks, outbox and rows (HOS-1561): nothing open outlives a case. The
 * branch-5 mirror records `coverage_loss` since HOS-1676 (Coord-376): the users' rows go too.
 */
afterEach(async () => {
    const cases = seeded.splice(0);
    await retireSuccessionCases(cases);
    if (cases.length > 0)
        await getServiceTestDb()
            .delete(coverageLosses)
            .where(
                inArray(
                    coverageLosses.userId,
                    cases.map((c) => c.userId)
                )
            );
});

type Case = Awaited<ReturnType<typeof predecessorInGrace>>;

/** A predecessor in grace whose recycled quota S19 retained, with its live successor. */
async function retainingPredecessor(): Promise<{ s: Case; paymentId: string }> {
    const s = await predecessorInGrace({ approveOnAttempt: 2 });
    seeded.push(s.seeded);
    s.fixture.advanceToAttempt(2);
    const retained = await recordChargeFact({ chargeId: s.fixture.chargeId }, s.chargePorts);
    expect(retained).toMatchObject({ exit: { outcome: 'RETAINED_FOR_S19' } });
    const payment = await paymentFor(s.fixture.chargeId);
    return { s, paymentId: payment.id };
}

/** The successor's authorization in the fake, created and approved (`active`). */
async function authorizeSuccessor(s: Case): Promise<string> {
    const { successorAuthorizationId } = await expireSuccessorWindow(s);
    await s.fixture.provider.approve({ authorizationId: successorAuthorizationId });
    return successorAuthorizationId;
}

/** The retention is still open (S18, B8b, closes it) and nothing else was opened. */
async function expectRetentionUntouched(s: Case, paymentId: string) {
    const retentions = await retentionsOf(s.subscriptionId);
    expect(retentions).toHaveLength(1);
    expect(retentions[0]).toMatchObject({ paymentId, releasedAt: null, releaseReason: null });
    expect(await refundsOf(paymentId)).toHaveLength(0);
    expect(await openMarksOf(s.subscriptionId)).toHaveLength(0);
}

/** The `subscription.provider_cancelled_after_rejection` events of one row (HOS-1676 H-2). */
async function afterRejectionEvents(subscriptionId: string) {
    return getServiceTestDb()
        .select({
            reason: domainEvent.reason,
            actorType: domainEvent.actorType,
            occurredAt: domainEvent.occurredAt
        })
        .from(domainEvent)
        .where(
            and(
                eq(domainEvent.entityType, 'subscription'),
                eq(domainEvent.entityId, subscriptionId),
                eq(domainEvent.eventType, 'subscription.provider_cancelled_after_rejection')
            )
        );
}

/** A coverage listener that records each event and the row status committed when it arrives. */
function committedCoverageSpy(subscriptionId: string) {
    const events: { event: CoverageChangedEvent; statusCommitted: string | undefined }[] = [];
    const coverageNotices: CoverageNotices = {
        async emitCoverageChanged(event) {
            const [row] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, subscriptionId));
            events.push({ event, statusCommitted: row?.status });
        }
    };
    return { coverageNotices, events };
}

describe('TEST:B7:16 — the B7 branches call S18 through its internal interface (AC:B7:25)', () => {
    describe('branch 1: the successor authorizes (S2)', () => {
        it.skipIf(!isServiceTestDbAvailable())(
            'by processProviderNotice: S18 is called once, with the predecessor, inside the act that activates the successor',
            async () => {
                // Arrange
                const { s, paymentId } = await retainingPredecessor();
                const authorizationId = await authorizeSuccessor(s);
                const spy = spySuccessionCloser();

                // Act
                const result = await processProviderNotice(
                    { channel: 'WEBHOOKS', delivery: authorizationDelivery(authorizationId) },
                    {
                        provider: s.chargePorts.provider,
                        clock: s.fixture.clock,
                        beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                        coverageNotices: s.chargePorts.coverageNotices,
                        successionCloser: spy.closer
                    }
                );

                // Assert
                expect(result).toEqual({ ack: 'OK', outcome: 'APPLIED' });
                expect(spy.seen).toEqual([
                    {
                        predecessorSubscriptionId: s.subscriptionId,
                        predecessorStatusInTx: 'GRACE_PERIOD',
                        successorStatusesInTx: ['ACTIVE'],
                        predecessorStatusCommitted: 'GRACE_PERIOD',
                        successorStatusesCommitted: ['PENDING_AUTHORIZATION']
                    }
                ]);
                expect((await subscriptionRow(s.successor.id)).status).toBe('ACTIVE');
                await expectRetentionUntouched(s, paymentId);
            }
        );

        it.skipIf(!isServiceTestDbAvailable())(
            'by expireAuthorizationWindows (S3 reads it active): S18 is called once, inside the act',
            async () => {
                // Arrange
                const { s, paymentId } = await retainingPredecessor();
                await authorizeSuccessor(s);
                const spy = spySuccessionCloser();

                // Act
                const summary = await runS3(s, { successionCloser: spy.closer });

                // Assert
                expect(summary).toMatchObject({ activated: 1, abandoned: 0 });
                expect(spy.seen).toEqual([
                    {
                        predecessorSubscriptionId: s.subscriptionId,
                        predecessorStatusInTx: 'GRACE_PERIOD',
                        successorStatusesInTx: ['ACTIVE'],
                        predecessorStatusCommitted: 'GRACE_PERIOD',
                        successorStatusesCommitted: ['PENDING_AUTHORIZATION']
                    }
                ]);
                expect((await subscriptionRow(s.successor.id)).status).toBe('ACTIVE');
                await expectRetentionUntouched(s, paymentId);
            }
        );

        it.skipIf(!isServiceTestDbAvailable())(
            'without a retention on the predecessor S18 is not called here (B8b generalizes it)',
            async () => {
                // Arrange
                const s = await predecessorInGrace({ approveOnAttempt: 2 });
                seeded.push(s.seeded);
                const authorizationId = await authorizeSuccessor(s);
                const spy = spySuccessionCloser();

                // Act
                const result = await processProviderNotice(
                    { channel: 'WEBHOOKS', delivery: authorizationDelivery(authorizationId) },
                    {
                        provider: s.chargePorts.provider,
                        clock: s.fixture.clock,
                        beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                        coverageNotices: s.chargePorts.coverageNotices,
                        successionCloser: spy.closer
                    }
                );

                // Assert
                expect(result).toEqual({ ack: 'OK', outcome: 'APPLIED' });
                expect(spy.closer.closeSuccession).not.toHaveBeenCalled();
                expect((await subscriptionRow(s.successor.id)).status).toBe('ACTIVE');
                expect(await retentionsOf(s.subscriptionId)).toHaveLength(0);
            }
        );

        it.skipIf(!isServiceTestDbAvailable())(
            'with the default closer (no port) and a retention the act fails SUCCESSION_CLOSER_NOT_REGISTERED and the successor is not activated',
            async () => {
                // Arrange
                const { s, paymentId } = await retainingPredecessor();
                await authorizeSuccessor(s);

                // Act
                const act = activatePendingWithSignupNotice({
                    subscriptionId: s.successor.id,
                    now: s.fixture.clock.now()
                });

                // Assert
                await expect(act).rejects.toMatchObject({
                    reason: 'SUCCESSION_CLOSER_NOT_REGISTERED'
                });
                expect((await subscriptionRow(s.successor.id)).status).toBe(
                    'PENDING_AUTHORIZATION'
                );
                await expectRetentionUntouched(s, paymentId);
            }
        );
    });

    describe('branch 5: the provider cancels the predecessor in GRACE_PERIOD (B/03 §10.1 mirror)', () => {
        it.skipIf(!isServiceTestDbAvailable())(
            'mirrorProviderCancellationOnGrace: CANCELLED with the clock empty, S18 called inside the act, REMOVED once after the commit',
            async () => {
                // Arrange
                const { s, paymentId } = await retainingPredecessor();
                const spy = spySuccessionCloser();
                const coverage = committedCoverageSpy(s.subscriptionId);
                const readAt = s.fixture.clock.now();

                // Act
                const result = await mirrorProviderCancellationOnGrace(
                    { subscriptionId: s.subscriptionId, readAt },
                    {
                        clock: s.fixture.clock,
                        successionCloser: spy.closer,
                        coverageNotices: coverage.coverageNotices
                    }
                );

                // Assert
                expect(result).toEqual({ outcome: 'CANCELLED', successionClosed: true });
                const row = await subscriptionRow(s.subscriptionId);
                expect(row.status).toBe('CANCELLED');
                expect(row.serviceEndsAt).toEqual(readAt);
                expect(row.graceStartedAt).toBeNull();
                expect(row.graceEndsAt).toBeNull();
                expect(spy.seen).toEqual([
                    {
                        predecessorSubscriptionId: s.subscriptionId,
                        predecessorStatusInTx: 'CANCELLED',
                        successorStatusesInTx: ['PENDING_AUTHORIZATION'],
                        predecessorStatusCommitted: 'GRACE_PERIOD',
                        successorStatusesCommitted: ['PENDING_AUTHORIZATION']
                    }
                ]);
                expect(coverage.events).toHaveLength(1);
                expect(coverage.events[0]).toMatchObject({
                    event: { change: 'REMOVED', sourceType: 'SUBSCRIPTION' },
                    statusCommitted: 'CANCELLED'
                });
                expect(await afterRejectionEvents(s.subscriptionId)).toEqual([
                    { reason: 'CANCELLED_ON_GRACE', actorType: 'provider', occurredAt: readAt }
                ]);
                await expectRetentionUntouched(s, paymentId);
            }
        );

        it.skipIf(!isServiceTestDbAvailable())(
            'HOS-1676 H-2: when S18 throws, the cancellation rolls back and leaves no after-rejection event',
            async () => {
                // Arrange
                const { s } = await retainingPredecessor();
                const failingCloser: SuccessionCloser = {
                    async closeSuccession() {
                        throw new Error('S18 failed');
                    }
                };
                const coverage = committedCoverageSpy(s.subscriptionId);

                // Act
                const attempt = mirrorProviderCancellationOnGrace(
                    { subscriptionId: s.subscriptionId, readAt: s.fixture.clock.now() },
                    {
                        clock: s.fixture.clock,
                        successionCloser: failingCloser,
                        coverageNotices: coverage.coverageNotices
                    }
                );

                // Assert
                await expect(attempt).rejects.toThrow('S18 failed');
                expect((await subscriptionRow(s.subscriptionId)).status).toBe('GRACE_PERIOD');
                expect(await afterRejectionEvents(s.subscriptionId)).toHaveLength(0);
                expect(coverage.events).toHaveLength(0);
            }
        );

        it.skipIf(!isServiceTestDbAvailable())(
            'by processProviderNotice with a test MirrorDelegates routing CANCELLED_ON_GRACE: same result',
            async () => {
                // Arrange
                const { s, paymentId } = await retainingPredecessor();
                await s.fixture.provider.cancel({
                    authorizationId: s.fixture.started.authorizationId
                });
                const spy = spySuccessionCloser();
                const coverage = committedCoverageSpy(s.subscriptionId);
                const routed: string[] = [];
                const delegates: MirrorDelegates = {
                    async delegate({ pair, subscriptionId }) {
                        routed.push(pair);
                        if (pair !== 'CANCELLED_ON_GRACE') throw new Error(`Unexpected ${pair}`);
                        await mirrorProviderCancellationOnGrace(
                            { subscriptionId, readAt: s.fixture.clock.now() },
                            {
                                clock: s.fixture.clock,
                                successionCloser: spy.closer,
                                coverageNotices: coverage.coverageNotices
                            }
                        );
                    }
                };

                // Act
                const result = await processProviderNotice(
                    {
                        channel: 'WEBHOOKS',
                        delivery: authorizationDelivery(s.fixture.started.authorizationId)
                    },
                    {
                        provider: s.chargePorts.provider,
                        clock: s.fixture.clock,
                        beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                        delegates
                    }
                );

                // Assert
                expect(result).toEqual({ ack: 'OK', outcome: 'DELEGATED' });
                expect(routed).toEqual(['CANCELLED_ON_GRACE']);
                const row = await subscriptionRow(s.subscriptionId);
                expect(row.status).toBe('CANCELLED');
                expect(row.graceEndsAt).toBeNull();
                expect(spy.seen).toHaveLength(1);
                expect(spy.seen[0]).toMatchObject({
                    predecessorSubscriptionId: s.subscriptionId,
                    predecessorStatusInTx: 'CANCELLED',
                    predecessorStatusCommitted: 'GRACE_PERIOD'
                });
                expect(coverage.events.map(({ event }) => event.change)).toEqual(['REMOVED']);
                await expectRetentionUntouched(s, paymentId);
            }
        );

        it.skipIf(!isServiceTestDbAvailable())(
            'on a SUSPENDED row it is NOT_APPLICABLE and writes nothing',
            async () => {
                // Arrange
                const s = await predecessorInGrace({ approveOnAttempt: 2 });
                seeded.push(s.seeded);
                await getServiceTestDb()
                    .update(subscriptions)
                    .set({ status: 'SUSPENDED' })
                    .where(eq(subscriptions.id, s.subscriptionId));
                const before = await subscriptionRow(s.subscriptionId);
                const spy = spySuccessionCloser();
                const coverage = committedCoverageSpy(s.subscriptionId);

                // Act
                const result = await mirrorProviderCancellationOnGrace(
                    { subscriptionId: s.subscriptionId, readAt: s.fixture.clock.now() },
                    {
                        clock: s.fixture.clock,
                        successionCloser: spy.closer,
                        coverageNotices: coverage.coverageNotices
                    }
                );

                // Assert
                expect(result).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'NOT_IN_GRACE' });
                expect(await subscriptionRow(s.subscriptionId)).toEqual(before);
                expect(spy.closer.closeSuccession).not.toHaveBeenCalled();
                expect(coverage.events).toHaveLength(0);
            }
        );
    });

    describe('branch 6: the predecessor itself ends (S36, S23/S24 leave it CANCELLED)', () => {
        it.skipIf(!isServiceTestDbAvailable())(
            'closeSuccessionIfPredecessor with the caller tx calls S18 when a live successor points at it',
            async () => {
                // Arrange
                const { s, paymentId } = await retainingPredecessor();
                await getServiceTestDb()
                    .update(subscriptions)
                    .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
                    .where(eq(subscriptions.id, s.subscriptionId));
                const spy = spySuccessionCloser();

                // Act
                const result = await getServiceTestDb().transaction((tx) =>
                    closeSuccessionIfPredecessor(
                        { predecessorSubscriptionId: s.subscriptionId, tx },
                        { successionCloser: spy.closer }
                    )
                );

                // Assert
                expect(result).toEqual({ called: true });
                expect(spy.seen).toEqual([
                    {
                        predecessorSubscriptionId: s.subscriptionId,
                        predecessorStatusInTx: 'CANCELLED',
                        successorStatusesInTx: ['PENDING_AUTHORIZATION'],
                        predecessorStatusCommitted: 'CANCELLED',
                        successorStatusesCommitted: ['PENDING_AUTHORIZATION']
                    }
                ]);
                await expectRetentionUntouched(s, paymentId);
            }
        );

        it.skipIf(!isServiceTestDbAvailable())(
            'without a live successor it does not call S18',
            async () => {
                // Arrange
                const { s, paymentId } = await retainingPredecessor();
                const db = getServiceTestDb();
                await db
                    .update(subscriptions)
                    .set({ status: 'ABANDONED' })
                    .where(eq(subscriptions.id, s.successor.id));
                await db
                    .update(subscriptions)
                    .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
                    .where(eq(subscriptions.id, s.subscriptionId));
                const spy = spySuccessionCloser();

                // Act
                const result = await db.transaction((tx) =>
                    closeSuccessionIfPredecessor(
                        { predecessorSubscriptionId: s.subscriptionId, tx },
                        { successionCloser: spy.closer }
                    )
                );

                // Assert
                expect(result).toEqual({ called: false });
                expect(spy.closer.closeSuccession).not.toHaveBeenCalled();
                await expectRetentionUntouched(s, paymentId);
            }
        );
    });
});
