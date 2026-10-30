// TEST:B7:2 — the successor of a paying predecessor in grace (AC:B7:4), the receiver's half: a
// cancelled preapproval over that successor is S6 by its fifth event, not the mirror of the
// provider cancellation (D-8), with one notice per grace shared with the sweep (I-2).
import { eq, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { processProviderNotice } from '../../../src/services/billing/notice/process-provider-notice.service.js';
import { createProviderNoticeMirrorDelegates } from '../../../src/services/billing/notice/provider-notice-delegates.js';
import { successorProviderCancelledOccurrenceId } from '../../../src/services/billing/reconciliation/sweep/grace-expiry-check.js';
import { providerLinkCancellationSeen } from '../../../src/services/billing/subscription/provider-link-cancellation-seen.js';
import { suspendForArrears } from '../../../src/services/billing/subscription/suspend-for-arrears.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { graceWithFailedCycle } from './support/grace-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';
import { authorizationDelivery } from './support/succession-retention-fixtures.js';
import {
    afterRejectionEvents,
    arrearsMails,
    retireSuccessorGraceRows,
    row,
    type SeededSuccessorCase,
    successorInGrace
} from './support/successor-grace-fixtures.js';

afterAll(closeServiceTestPool);

const DAY_MS = 86_400_000;
const seeded: SeededSuccessorCase[] = [];

afterEach(async () => {
    await retireSuccessorGraceRows(seeded.splice(0));
});

async function setStatus(subscriptionId: string, status: 'ACTIVE' | 'GRACE_PERIOD') {
    await getServiceTestDb()
        .update(subscriptions)
        .set({ status })
        .where(eq(subscriptions.id, subscriptionId));
}

describe('TEST:B7:2 — the receiver suspends the successor in grace instead of mirroring (AC:B7:4)', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'n — the receiver: a cancelled preapproval on the successor in grace is S6, not the mirror (D-8); a normal row is still mirrored',
        async () => {
            // Arrange
            const s = await successorInGrace({ seeded });
            await s.fixture.provider.cancel({
                authorizationId: s.fixture.successorAuthorizationId
            });

            // Act
            const received = await s.receive();

            // Assert
            expect(received).toEqual({ ack: 'OK', outcome: 'DELEGATED' });
            expect((await row(s.fixture.successorId)).status).toBe('SUSPENDED');
            expect(await afterRejectionEvents(s.fixture.successorId)).toEqual([]);
            expect(s.cancel).not.toHaveBeenCalled();
            expect(await arrearsMails(s.fixture.user.id)).toHaveLength(1);

            // Control: a normal row in grace is still mirrored to CANCELLED.
            const normal = await graceWithFailedCycle();
            seeded.push({
                subscriptionIds: [normal.started.subscriptionId],
                userId: normal.user.id
            });
            await normal.provider.cancel({ authorizationId: normal.started.authorizationId });
            const ports = {
                provider: normal.provider,
                clock: normal.clock,
                beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true })
            };
            const mirrored = await processProviderNotice(
                {
                    channel: 'WEBHOOKS',
                    delivery: authorizationDelivery(normal.started.authorizationId)
                },
                {
                    ...ports,
                    cancellationSeen: providerLinkCancellationSeen,
                    delegates: createProviderNoticeMirrorDelegates(ports)
                }
            );
            expect(mirrored).toEqual({ ack: 'OK', outcome: 'DELEGATED' });
            expect((await row(normal.started.subscriptionId)).status).toBe('CANCELLED');
            expect(await afterRejectionEvents(normal.started.subscriptionId)).toHaveLength(1);
            expect(await arrearsMails(normal.user.id)).toEqual([]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'o — dedup: the receiver suspends, the next day the sweep and S6 add no second notice',
        async () => {
            // Arrange
            const s = await successorInGrace({ seeded });
            await s.fixture.provider.cancel({
                authorizationId: s.fixture.successorAuthorizationId
            });
            await s.receive();
            expect((await row(s.fixture.successorId)).status).toBe('SUSPENDED');
            s.fixture.clock.advance({ ms: DAY_MS });

            // Act
            await s.runCheck();
            const again = await suspendForArrears(
                {
                    subscriptionId: s.fixture.successorId,
                    event: 'SUCCESSOR_PROVIDER_CANCELLED',
                    occurrenceId: successorProviderCancelledOccurrenceId({
                        subscriptionId: s.fixture.successorId,
                        graceStartedAt: s.graceStartedAt
                    })
                },
                {
                    provider: s.provider,
                    clock: s.fixture.clock,
                    beforeCancelNotice: s.beforeCancelNotice,
                    coverageNotices: s.coverageNotices
                }
            );

            // Assert
            expect(again).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'NOT_IN_GRACE' });
            expect((await row(s.fixture.successorId)).status).toBe('SUSPENDED');
            expect(s.beforeCancel).toHaveBeenCalledTimes(1);
            expect(await arrearsMails(s.fixture.user.id)).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'o2 — dedup across a retry: the receiver enqueued the notice but lost the write; the next day the sweep reuses the same occurrence (I-2)',
        async () => {
            // Arrange: the receiver's S6 enqueues its notice, then the row leaves grace before the write.
            const s = await successorInGrace({ seeded });
            await s.fixture.provider.cancel({
                authorizationId: s.fixture.successorAuthorizationId
            });
            s.beforeNotice(async () => {
                await setStatus(s.fixture.successorId, 'ACTIVE');
            });
            await s.receive();
            expect((await row(s.fixture.successorId)).status).toBe('ACTIVE');
            expect(await arrearsMails(s.fixture.user.id)).toHaveLength(1);
            // The same grace again (same clock), and the next day's sweep.
            await setStatus(s.fixture.successorId, 'GRACE_PERIOD');
            s.beforeNotice(async () => undefined);
            s.fixture.clock.advance({ ms: DAY_MS });

            // Act
            await s.runCheck();

            // Assert: suspended, two attempts, one occurrence, one notice row.
            const occurrenceId = successorProviderCancelledOccurrenceId({
                subscriptionId: s.fixture.successorId,
                graceStartedAt: s.graceStartedAt
            });
            expect((await row(s.fixture.successorId)).status).toBe('SUSPENDED');
            expect(s.beforeCancel.mock.calls.map(([notice]) => notice.occurrenceId)).toEqual([
                occurrenceId,
                occurrenceId
            ]);
            expect(await arrearsMails(s.fixture.user.id)).toHaveLength(1);
        }
    );
});
