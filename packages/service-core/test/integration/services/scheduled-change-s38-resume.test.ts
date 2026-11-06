import { eq, subscriptionPauses, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import type { CoverageNotices } from '../../../src/services/billing/payment/payment-ports.js';
import { applyDueScheduledChanges } from '../../../src/services/billing/subscription/apply-due-scheduled-changes.service.js';
import { resumeSubscription } from '../../../src/services/billing/subscription/resume-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    adjustablePauseHarness,
    retirePauseRows,
    seedPausePrincipal
} from './support/pause-fixtures.js';
import {
    deleteScheduledChanges,
    scheduledChangesOf,
    seedScheduledChange
} from './support/scheduled-change-fixtures.js';

const emptyComplements = {
    addonPolicy: async () => {
        throw new Error('Unexpected addon policy');
    },
    listing: async () => {
        throw new Error('Unexpected listing policy');
    }
};
const created: string[] = [];
afterEach(async () => {
    await deleteScheduledChanges(created.splice(0));
    await retirePauseRows();
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:15 S38 on S10 return', () => {
    for (const cause of ['TERM', 'EARLY'] as const) {
        it(`waits while PAUSED and applies an overdue change on ${cause} return`, async () => {
            const harness = adjustablePauseHarness();
            const principal = await seedPausePrincipal({ harness, paymentMethod: 'MANUAL' });
            created.push(principal.subscriptionId);
            const now = harness.clock.now();
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'PAUSED' })
                .where(eq(subscriptions.id, principal.subscriptionId));
            await getServiceTestDb()
                .insert(subscriptionPauses)
                .values({
                    subscriptionId: principal.subscriptionId,
                    reason: 'CUSTOMER_REQUEST',
                    startsAt: new Date(now.getTime() - 3 * 86_400_000),
                    expectedEndAt: new Date(now.getTime() + 365 * 86_400_000),
                    requestedMonths: 2
                });
            await seedScheduledChange({
                subscriptionId: principal.subscriptionId,
                effectiveAt: new Date(now.getTime() - 86_400_000)
            });
            const notices: string[] = [];
            const coverageNotices: CoverageNotices = {
                async emitCoverageChanged(event) {
                    if (event.userId !== principal.userId) return;
                    const [committed] = await getServiceTestDb()
                        .select({ status: subscriptions.status })
                        .from(subscriptions)
                        .where(eq(subscriptions.id, principal.subscriptionId));
                    notices.push(`${event.change}:${committed?.status}`);
                }
            };
            const batch = await applyDueScheduledChanges(
                { limit: 100 },
                {
                    clock: harness.clock,
                    coverageNotices
                }
            );
            expect(batch.waiting).toBeGreaterThanOrEqual(1);
            const [paused] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, principal.subscriptionId));
            expect(paused?.status).toBe('PAUSED');
            const pausedQueue = await scheduledChangesOf(principal.subscriptionId);
            expect(pausedQueue).toHaveLength(1);
            const resumed = await resumeSubscription(
                { subscriptionId: principal.subscriptionId, cause },
                {
                    provider: harness.provider,
                    clock: harness.clock,
                    complements: emptyComplements,
                    coverageNotices
                }
            );
            expect(resumed.outcome).toBe('RESUMED');
            if (resumed.outcome !== 'RESUMED') throw new Error('S10 did not resume');
            expect(resumed.scheduledChange?.outcome).toBe('APPLIED');
            expect(await scheduledChangesOf(principal.subscriptionId)).toEqual([]);
            expect(notices).toEqual(['ADDED:ACTIVE', 'CHANGED:ACTIVE']);
        });
    }

    it('leaves a change dated after the return queued', async () => {
        const harness = adjustablePauseHarness();
        const principal = await seedPausePrincipal({ harness, paymentMethod: 'MANUAL' });
        created.push(principal.subscriptionId);
        const now = harness.clock.now();
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'PAUSED' })
            .where(eq(subscriptions.id, principal.subscriptionId));
        await getServiceTestDb()
            .insert(subscriptionPauses)
            .values({
                subscriptionId: principal.subscriptionId,
                reason: 'CUSTOMER_REQUEST',
                startsAt: new Date(now.getTime() - 86_400_000),
                expectedEndAt: new Date(now.getTime() + 365 * 86_400_000),
                requestedMonths: 2
            });
        const future = new Date(now.getTime() + 86_400_000);
        const queued = await seedScheduledChange({
            subscriptionId: principal.subscriptionId,
            effectiveAt: future
        });
        const resumed = await resumeSubscription(
            { subscriptionId: principal.subscriptionId, cause: 'EARLY' },
            {
                provider: harness.provider,
                clock: harness.clock,
                complements: emptyComplements
            }
        );
        expect(resumed.outcome).toBe('RESUMED');
        expect(await scheduledChangesOf(principal.subscriptionId)).toMatchObject([
            { id: queued.id }
        ]);
    });
});
