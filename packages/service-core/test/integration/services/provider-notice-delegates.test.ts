// TEST:1676:1 (AC:1676:1) — `CANCELLED_ON_GRACE` is registered: `processProviderNotice` with the
// REAL `createProviderNoticeMirrorDelegates` mirrors a provider cancellation on a GRACE_PERIOD
// row to CANCELLED, writes `subscription.provider_cancelled_after_rejection` in the same
// transaction (H-2) and notifies REMOVED after the commit. With a live successor and no S18
// the notice stays ERROR (H-6); an unregistered pair still answers ERROR (H-1).
//
// Cleanup: `retireSuccessionCases` leaves every seeded row CANCELLED with the clock empty and
// lifts its marks. `domain_event` is append-only, so the events stay; assertions filter by row.
import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import { and, domainEvent, eq, providerLinks, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { processProviderNotice } from '../../../src/services/billing/notice/process-provider-notice.service.js';
import { createProviderNoticeMirrorDelegates } from '../../../src/services/billing/notice/provider-notice-delegates.js';
import type { CoverageNotices } from '../../../src/services/billing/payment/payment-ports.js';
import { providerLinkCancellationSeen } from '../../../src/services/billing/subscription/provider-link-cancellation-seen.js';
import type { BeforeCancelNotice } from '../../../src/services/billing/subscription/start-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { graceFixture, graceWithFailedCycle } from './support/grace-fixtures.js';
import {
    authorizationDelivery,
    predecessorInGrace,
    retireSuccessionCases,
    type SeededSuccession,
    subscriptionRow
} from './support/succession-retention-fixtures.js';

afterAll(closeServiceTestPool);

const seeded: SeededSuccession[] = [];

afterEach(async () => {
    await retireSuccessionCases(seeded.splice(0));
});

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
}) {
    const ports = {
        provider: input.fixture.provider,
        clock: input.fixture.clock,
        beforeCancelNotice,
        coverageNotices: input.coverageNotices
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
        '(iv) H-1: an unregistered pair (paused × ACTIVE, PROVIDER_PAUSE_IS_ARREARS) still answers ERROR',
        async () => {
            // Arrange
            const fixture = await graceFixture();
            const subscriptionId = fixture.started.subscriptionId;
            seeded.push({ subscriptionIds: [subscriptionId], userId: fixture.user.id });
            expect((await subscriptionRow(subscriptionId)).status).toBe('ACTIVE');
            await fixture.provider.pause({ authorizationId: fixture.started.authorizationId });

            // Act
            const result = await receive({
                fixture,
                delivery: authorizationDelivery(fixture.started.authorizationId)
            });

            // Assert
            expect(result).toEqual({ ack: 'ERROR', outcome: 'FAILED' });
            expect((await subscriptionRow(subscriptionId)).status).toBe('ACTIVE');
            expect(await afterRejectionEvents(subscriptionId)).toHaveLength(0);
        }
    );
});
