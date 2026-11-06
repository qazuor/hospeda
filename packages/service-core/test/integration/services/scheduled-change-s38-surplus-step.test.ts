import { eq, subscriptions } from '@repo/db';
import { PUBLICATION_LIMIT_KEYS } from '@repo/verticals';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { CoverageNotices } from '../../../src/services/billing/payment/payment-ports.js';
import { applyDueScheduledChanges } from '../../../src/services/billing/subscription/apply-due-scheduled-changes.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { retirePlanChanges, seedPlanChange } from './support/plan-change-fixtures.js';
import { seedScheduledChange } from './support/scheduled-change-fixtures.js';
import { successionClock } from './support/succession-fixtures.js';

afterEach(retirePlanChanges);
afterAll(closeServiceTestPool);

function noticeSpy(calls: unknown[]): CoverageNotices {
    return {
        async emitCoverageChanged(event) {
            calls.push({ kind: 'notice', event });
        }
    };
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B8b:15 S38 surplus selection post-commit',
    () => {
        it('runs the selected surplus step before CHANGED notice and persists S38', async () => {
            const seeded = await seedPlanChange({});
            const keepListingIds = ['keep-a', 'keep-b'];
            await seedScheduledChange({
                subscriptionId: seeded.predecessor.id,
                effectiveAt: new Date('1900-01-01T00:00:00Z'),
                targetPlanVersionId: seeded.targetPlanVersionId,
                targetBillingOptionId: seeded.targetBillingOptionId,
                keepSelection: { [PUBLICATION_LIMIT_KEYS.accommodation]: keepListingIds }
            });
            const calls: unknown[] = [];
            const surplusStep = {
                async reconcile(input: {
                    userId: string;
                    vertical: string;
                    keepListingIds: readonly string[];
                }) {
                    calls.push({ kind: 'step', ...input });
                }
            };
            const summary = await applyDueScheduledChanges(
                { limit: 10 },
                {
                    clock: { now: () => successionClock.now() },
                    coverageNotices: noticeSpy(calls),
                    surplusStep
                }
            );
            const [row] = await getServiceTestDb()
                .select({ planVersionId: subscriptions.planVersionId })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.predecessor.id));
            expect(row?.planVersionId).toBe(seeded.targetPlanVersionId);
            expect(summary).toMatchObject({ applied: 1, failed: 0, warnings: [] });
            expect(calls).toEqual([
                {
                    kind: 'step',
                    userId: seeded.user.id,
                    vertical: 'accommodation',
                    keepListingIds
                },
                {
                    kind: 'notice',
                    event: {
                        userId: seeded.user.id,
                        vertical: 'accommodation',
                        sourceType: 'SUBSCRIPTION',
                        change: 'CHANGED'
                    }
                }
            ]);
        });

        it('does not call the step without a selection and still emits CHANGED', async () => {
            const seeded = await seedPlanChange({});
            await seedScheduledChange({
                subscriptionId: seeded.predecessor.id,
                effectiveAt: new Date('1900-01-01T00:00:00Z'),
                targetPlanVersionId: seeded.targetPlanVersionId,
                targetBillingOptionId: seeded.targetBillingOptionId
            });
            const calls: unknown[] = [];
            const surplusStep = { reconcile: vi.fn(async () => undefined) };
            const summary = await applyDueScheduledChanges(
                { limit: 10 },
                {
                    clock: { now: () => successionClock.now() },
                    coverageNotices: noticeSpy(calls),
                    surplusStep
                }
            );
            expect(summary.applied).toBe(1);
            expect(surplusStep.reconcile).not.toHaveBeenCalled();
            expect(calls).toHaveLength(1);
            expect(calls[0]).toMatchObject({ kind: 'notice', event: { change: 'CHANGED' } });
        });

        it('warns when the selected step is not registered and still emits CHANGED', async () => {
            const seeded = await seedPlanChange({});
            await seedScheduledChange({
                subscriptionId: seeded.predecessor.id,
                effectiveAt: new Date('1900-01-01T00:00:00Z'),
                targetPlanVersionId: seeded.targetPlanVersionId,
                targetBillingOptionId: seeded.targetBillingOptionId,
                keepSelection: { [PUBLICATION_LIMIT_KEYS.accommodation]: ['keep-a'] }
            });
            const calls: unknown[] = [];
            const summary = await applyDueScheduledChanges(
                { limit: 10 },
                { clock: { now: () => successionClock.now() }, coverageNotices: noticeSpy(calls) }
            );
            expect(summary).toMatchObject({
                applied: 1,
                warnings: ['SURPLUS_STEP_NOT_REGISTERED']
            });
            expect(calls).toHaveLength(1);
            expect(calls[0]).toMatchObject({ kind: 'notice', event: { change: 'CHANGED' } });
        });

        it('converts a step failure to a warning and still emits CHANGED', async () => {
            const seeded = await seedPlanChange({});
            await seedScheduledChange({
                subscriptionId: seeded.predecessor.id,
                effectiveAt: new Date('1900-01-01T00:00:00Z'),
                targetPlanVersionId: seeded.targetPlanVersionId,
                targetBillingOptionId: seeded.targetBillingOptionId,
                keepSelection: { [PUBLICATION_LIMIT_KEYS.accommodation]: ['keep-a'] }
            });
            const calls: unknown[] = [];
            const summary = await applyDueScheduledChanges(
                { limit: 10 },
                {
                    clock: { now: () => successionClock.now() },
                    coverageNotices: noticeSpy(calls),
                    surplusStep: {
                        reconcile: vi.fn(async () => {
                            throw new Error('step failed');
                        })
                    }
                }
            );
            expect(summary).toMatchObject({ applied: 1, warnings: ['SURPLUS_STEP_FAILED'] });
            expect(calls).toHaveLength(1);
            expect(calls[0]).toMatchObject({ kind: 'notice', event: { change: 'CHANGED' } });
        });
    }
);
