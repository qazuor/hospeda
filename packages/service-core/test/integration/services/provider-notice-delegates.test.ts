// TEST:1676:1 (AC:1676:1) — `CANCELLED_ON_GRACE` is registered: `processProviderNotice` with the
// REAL `createProviderNoticeMirrorDelegates` mirrors a provider cancellation on a GRACE_PERIOD
// row to CANCELLED, writes `subscription.provider_cancelled_after_rejection` in the same
// transaction (H-2) and notifies REMOVED after the commit. With a live successor and no S18
// the notice stays ERROR (H-6); an unregistered pair still answers ERROR (H-1).
//
// Coord-376: the mirror records `coverage_loss` in its transaction, like PROVIDER_CANCEL, when no
// other source is left; with another live source it records none.
//
// Cleanup: `retireSuccessionCases` leaves every seeded row CANCELLED with the clock empty and
// lifts its marks; the users' coverage losses are deleted. `domain_event` is append-only, so the
// events stay; assertions filter by row.
import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import {
    and,
    coverageLosses,
    domainEvent,
    eq,
    inArray,
    providerLinks,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { processProviderNotice } from '../../../src/services/billing/notice/process-provider-notice.service.js';
import { createProviderNoticeMirrorDelegates } from '../../../src/services/billing/notice/provider-notice-delegates.js';
import { creditedPaymentsFromLedger } from '../../../src/services/billing/payment/payment-ledger.js';
import type { CoverageNotices } from '../../../src/services/billing/payment/payment-ports.js';
import { providerLinkCancellationSeen } from '../../../src/services/billing/subscription/provider-link-cancellation-seen.js';
import type { BeforeCancelNotice } from '../../../src/services/billing/subscription/start-subscription.service.js';
import type { SuccessionCloser } from '../../../src/services/billing/subscription/subscription-billing-ports.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { graceFixture, graceWithFailedCycle } from './support/grace-fixtures.js';
import {
    authorizationDelivery,
    predecessorInGrace,
    retireSuccessionCases,
    type SeededSuccession,
    seedLiveSuccessor,
    spySuccessionCloser,
    subscriptionRow
} from './support/succession-retention-fixtures.js';

afterAll(closeServiceTestPool);

const seeded: SeededSuccession[] = [];

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

/** The coverage losses recorded for one user. */
async function lossesOf(userId: string) {
    return getServiceTestDb()
        .select({ vertical: coverageLosses.vertical, lostAt: coverageLosses.lostAt })
        .from(coverageLosses)
        .where(eq(coverageLosses.userId, userId));
}

const beforeCancelNotice: BeforeCancelNotice = { beforeCancel: async () => 'SENT' };
const AFTER_REJECTION = 'subscription.provider_cancelled_after_rejection';

/** A coverage listener that records each event with the row status committed when it arrives. */
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

/** The after-rejection events of one row. */
async function afterRejectionEvents(subscriptionId: string) {
    return getServiceTestDb()
        .select({
            reason: domainEvent.reason,
            actorType: domainEvent.actorType,
            occurredAt: domainEvent.occurredAt,
            changes: domainEvent.changes
        })
        .from(domainEvent)
        .where(
            and(
                eq(domainEvent.entityType, 'subscription'),
                eq(domainEvent.entityId, subscriptionId),
                eq(domainEvent.eventType, AFTER_REJECTION)
            )
        );
}

async function linkOf(subscriptionId: string) {
    const [link] = await getServiceTestDb()
        .select()
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, subscriptionId));
    if (!link) throw new Error('Provider link disappeared');
    return link;
}

/** The receiver with the REAL delegates; no `successionCloser` (none exists in the epic, H-6). */
function receive(input: {
    readonly fixture: Awaited<ReturnType<typeof graceFixture>>;
    readonly coverageNotices?: CoverageNotices;
    readonly delivery: ReturnType<typeof authorizationDelivery>;
    readonly successionCloser?: SuccessionCloser;
}) {
    const ports = {
        provider: input.fixture.provider,
        clock: input.fixture.clock,
        beforeCancelNotice,
        payments: creditedPaymentsFromLedger,
        planPolicy: input.fixture.planPolicy,
        coverageNotices: input.coverageNotices,
        ...(input.successionCloser ? { successionCloser: input.successionCloser } : {})
    };
    return processProviderNotice(
        { channel: 'WEBHOOKS', delivery: input.delivery },
        {
            ...ports,
            cancellationSeen: providerLinkCancellationSeen,
            delegates: createProviderNoticeMirrorDelegates(ports)
        }
    );
}

describe('TEST:1676:1 CANCELLED_ON_GRACE is registered in the receiver (AC:1676:1)', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        '(i)(ii) a GRACE_PERIOD row whose preapproval the fake cancelled ⇒ DELEGATED, CANCELLED, one event, REMOVED after commit; the same notice again ⇒ DISCARDED_OLD_VERSION',
        async () => {
            // Arrange
            const fixture = await graceWithFailedCycle();
            const subscriptionId = fixture.started.subscriptionId;
            seeded.push({ subscriptionIds: [subscriptionId], userId: fixture.user.id });
            expect((await subscriptionRow(subscriptionId)).status).toBe('GRACE_PERIOD');
            await fixture.provider.cancel({ authorizationId: fixture.started.authorizationId });
            const coverage = committedCoverageSpy(subscriptionId);
            const delivery = authorizationDelivery(fixture.started.authorizationId);
            const readAt = fixture.clock.now();

            // Act
            const first = await receive({
                fixture,
                coverageNotices: coverage.coverageNotices,
                delivery
            });
            const second = await receive({
                fixture,
                coverageNotices: coverage.coverageNotices,
                delivery
            });

            // Assert
            expect(first).toEqual({ ack: 'OK', outcome: 'DELEGATED' });
            expect(second).toEqual({ ack: 'OK', outcome: 'DISCARDED_OLD_VERSION' });
            const row = await subscriptionRow(subscriptionId);
            expect(row.status).toBe('CANCELLED');
            expect(row.serviceEndsAt).toEqual(readAt);
            expect(row.graceStartedAt).toBeNull();
            expect(row.graceEndsAt).toBeNull();
            const link = await linkOf(subscriptionId);
            const notice = await fixture.provider.decodeNotice(delivery);
            expect(link.lastAppliedVersion).toBe(notice.version);
            expect(link.cancelledSeenAt).toEqual(readAt);
            expect(await afterRejectionEvents(subscriptionId)).toEqual([
                {
                    reason: 'CANCELLED_ON_GRACE',
                    actorType: 'provider',
                    occurredAt: readAt,
                    changes: [{ field: 'status', old: 'GRACE_PERIOD', new: 'CANCELLED' }]
                }
            ]);
            expect(coverage.events).toHaveLength(1);
            expect(coverage.events[0]).toMatchObject({
                event: { change: 'REMOVED', sourceType: 'SUBSCRIPTION' },
                statusCommitted: 'CANCELLED'
            });
            // Coord-376: no other source left ⇒ coverage_loss at the cancellation's write instant.
            expect(await lossesOf(fixture.user.id)).toEqual([
                { vertical: 'accommodation', lostAt: readAt }
            ]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'Coord-376: with another live source (an authorized ACTIVE successor, S18 injected) ⇒ CANCELLED and NO coverage_loss',
        async () => {
            // Arrange: the successor emits the vertical's source (molde: coverage-retention-stopped (e)).
            const fixture = await graceWithFailedCycle();
            const subscriptionId = fixture.started.subscriptionId;
            const successor = await seedLiveSuccessor(fixture, subscriptionId);
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'ACTIVE' })
                .where(eq(subscriptions.id, successor.id));
            const other = { id: successor.id };
            seeded.push({ subscriptionIds: [subscriptionId, other.id], userId: fixture.user.id });
            await fixture.provider.cancel({ authorizationId: fixture.started.authorizationId });
            const spy = spySuccessionCloser();

            // Act
            const result = await receive({
                fixture,
                delivery: authorizationDelivery(fixture.started.authorizationId),
                successionCloser: spy.closer
            });

            // Assert
            expect(result).toEqual({ ack: 'OK', outcome: 'DELEGATED' });
            expect(spy.seen).toHaveLength(1);
            expect((await subscriptionRow(subscriptionId)).status).toBe('CANCELLED');
            expect((await subscriptionRow(other.id)).status).toBe('ACTIVE');
            expect(await lossesOf(fixture.user.id)).toEqual([]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(iii) H-6: with a live successor and no S18 registered ⇒ ERROR, the row stays GRACE_PERIOD, no event',
        async () => {
            // Arrange
            const s = await predecessorInGrace();
            seeded.push(s.seeded);
            await s.fixture.provider.cancel({
                authorizationId: s.fixture.started.authorizationId
            });
            const coverage = committedCoverageSpy(s.subscriptionId);

            // Act
            const result = await receive({
                fixture: s.fixture,
                coverageNotices: coverage.coverageNotices,
                delivery: authorizationDelivery(s.fixture.started.authorizationId)
            });

            // Assert
            expect(result).toEqual({ ack: 'ERROR', outcome: 'FAILED' });
            const row = await subscriptionRow(s.subscriptionId);
            expect(row.status).toBe('GRACE_PERIOD');
            expect(row.graceEndsAt).not.toBeNull();
            expect(await afterRejectionEvents(s.subscriptionId)).toHaveLength(0);
            expect(coverage.events).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(iv) B7.3: paused × ACTIVE ⇒ DELEGATED and SUSPENDED by S6',
        async () => {
            // Arrange
            const fixture = await graceFixture();
            const subscriptionId = fixture.started.subscriptionId;
            seeded.push({ subscriptionIds: [subscriptionId], userId: fixture.user.id });
            expect((await subscriptionRow(subscriptionId)).status).toBe('ACTIVE');
            await fixture.provider.failChargeCycle({
                authorizationId: fixture.started.authorizationId,
                declineReason: 'issuer_declined'
            });
            await fixture.provider.pause({ authorizationId: fixture.started.authorizationId });

            // Act
            const result = await receive({
                fixture,
                delivery: authorizationDelivery(fixture.started.authorizationId)
            });

            // Assert
            expect(result).toEqual({ ack: 'OK', outcome: 'DELEGATED' });
            expect((await subscriptionRow(subscriptionId)).status).toBe('SUSPENDED');
            expect(await afterRejectionEvents(subscriptionId)).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(v) H-1: active × PAUSED (RESUME_MIRROR) stays ERROR',
        async () => {
            const fixture = await graceFixture();
            const subscriptionId = fixture.started.subscriptionId;
            seeded.push({ subscriptionIds: [subscriptionId], userId: fixture.user.id });
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'PAUSED' })
                .where(eq(subscriptions.id, subscriptionId));
            const result = await receive({
                fixture,
                delivery: authorizationDelivery(fixture.started.authorizationId)
            });
            expect(result).toEqual({ ack: 'ERROR', outcome: 'FAILED' });
            expect((await subscriptionRow(subscriptionId)).status).toBe('PAUSED');
        }
    );
});
