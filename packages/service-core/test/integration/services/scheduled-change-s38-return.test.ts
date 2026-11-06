import { billingOptions, eq, manualPayments, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { createCutExpectedAmountPolicy } from '../../../src/services/billing/reconciliation/sweep/comparisons/expected-amount.js';
import { graceExpiredOccurrenceId } from '../../../src/services/billing/reconciliation/sweep/grace-expiry-check.js';
import { createScheduledChangeApplier } from '../../../src/services/billing/subscription/apply-scheduled-change.service.js';
import { openDueManualInstallments } from '../../../src/services/billing/subscription/open-manual-installment.service.js';
import { suspendForArrears } from '../../../src/services/billing/subscription/suspend-for-arrears.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { seedCoveragePlanVersion } from './support/coverage-fixtures.js';
import { graceWithFailedCycle } from './support/grace-fixtures.js';
import { retirePlanChanges, seedPlanChange } from './support/plan-change-fixtures.js';
import {
    deleteScheduledChanges,
    scheduledChangesOf,
    seedScheduledChange
} from './support/scheduled-change-fixtures.js';
import { successionClock } from './support/succession-fixtures.js';
import {
    retireSuccessionCases,
    type SeededSuccession,
    subscriptionRow
} from './support/succession-retention-fixtures.js';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const seeded: SeededSuccession[] = [];
const manualPrincipals: string[] = [];
afterEach(async () => {
    for (const subscriptionId of manualPrincipals.splice(0)) {
        await getServiceTestDb()
            .delete(manualPayments)
            .where(eq(manualPayments.subscriptionId, subscriptionId));
    }
    await deleteScheduledChanges(seeded.flatMap((item) => item.subscriptionIds));
    await retireSuccessionCases(seeded.splice(0));
    await retirePlanChanges();
});
afterAll(closeServiceTestPool);

async function targetVersion() {
    const result = await getServiceTestDb().transaction((tx) =>
        seedCoveragePlanVersion(tx, 'accommodation')
    );
    return result;
}

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:15 S38 on S7 return', () => {
    it('applies an overdue change as S7 returns the row to ACTIVE', async () => {
        const fixture = await graceWithFailedCycle({ approveOnAttempt: 2 });
        const subscriptionId = fixture.started.subscriptionId;
        seeded.push({ subscriptionIds: [subscriptionId], userId: fixture.user.id });
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'SUSPENDED' })
            .where(eq(subscriptions.id, subscriptionId));
        fixture.advanceToAttempt(2);
        const target = await targetVersion();
        await seedScheduledChange({
            subscriptionId,
            effectiveAt: new Date(fixture.clock.now().getTime() - DAY_MS),
            targetPlanVersionId: target.planVersionId,
            targetBillingOptionId: target.billingOptionId
        });
        const onApplied = vi.fn();
        const applier = createScheduledChangeApplier({ clock: fixture.clock, onApplied });
        const result = await recordChargeFact(
            { chargeId: fixture.chargeId },
            {
                ...fixture.ports,
                scheduledChangeApplier: applier
            }
        );
        const [row] = await getServiceTestDb()
            .select({
                status: subscriptions.status,
                planVersionId: subscriptions.planVersionId,
                billingOptionId: subscriptions.billingOptionId
            })
            .from(subscriptions)
            .where(eq(subscriptions.id, subscriptionId));
        expect(result).toMatchObject({
            reactivation: { outcome: 'REACTIVATED', destination: 'ACTIVE' }
        });
        expect(row).toMatchObject({
            status: 'ACTIVE',
            planVersionId: target.planVersionId,
            billingOptionId: target.billingOptionId
        });
        expect(await scheduledChangesOf(subscriptionId)).toEqual([]);
        expect(onApplied).toHaveBeenCalledTimes(1);
    });

    it('applies an overdue change as S7 returns a previously cancelled authorization to CANCEL_SCHEDULED', async () => {
        const fixture = await graceWithFailedCycle({ approveOnAttempt: 3 });
        const subscriptionId = fixture.started.subscriptionId;
        seeded.push({ subscriptionIds: [subscriptionId], userId: fixture.user.id });
        const inGrace = await subscriptionRow(subscriptionId);
        if (!inGrace.graceEndsAt) throw new Error('Grace clock missing');
        fixture.clock.advance({
            ms: inGrace.graceEndsAt.getTime() + HOUR_MS - fixture.clock.now().getTime()
        });
        const coverageNotices = { emitCoverageChanged: async () => undefined };
        await suspendForArrears(
            {
                subscriptionId,
                event: 'GRACE_EXPIRED',
                occurrenceId: graceExpiredOccurrenceId({
                    subscriptionId,
                    graceEndsAt: inGrace.graceEndsAt
                })
            },
            {
                provider: fixture.provider,
                clock: fixture.clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                coverageNotices
            }
        );
        fixture.advanceToAttempt(3);
        const target = await targetVersion();
        await seedScheduledChange({
            subscriptionId,
            effectiveAt: new Date(fixture.clock.now().getTime() - DAY_MS),
            targetPlanVersionId: target.planVersionId,
            targetBillingOptionId: target.billingOptionId
        });
        const onApplied = vi.fn();
        const result = await recordChargeFact(
            { chargeId: fixture.chargeId },
            {
                ...fixture.ports,
                coverageNotices,
                scheduledChangeApplier: createScheduledChangeApplier({
                    clock: fixture.clock,
                    onApplied
                })
            }
        );
        const [row] = await getServiceTestDb()
            .select({
                status: subscriptions.status,
                planVersionId: subscriptions.planVersionId,
                billingOptionId: subscriptions.billingOptionId
            })
            .from(subscriptions)
            .where(eq(subscriptions.id, subscriptionId));
        expect(result).toMatchObject({
            reactivation: { outcome: 'REACTIVATED', destination: 'CANCEL_SCHEDULED' }
        });
        expect(row).toMatchObject({
            status: 'CANCEL_SCHEDULED',
            planVersionId: target.planVersionId,
            billingOptionId: target.billingOptionId
        });
        expect(await scheduledChangesOf(subscriptionId)).toEqual([]);
        expect(onApplied).toHaveBeenCalledTimes(1);
    });

    it('keeps a future change queued when S7 returns the row to ACTIVE', async () => {
        const fixture = await graceWithFailedCycle({ approveOnAttempt: 2 });
        const subscriptionId = fixture.started.subscriptionId;
        seeded.push({ subscriptionIds: [subscriptionId], userId: fixture.user.id });
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'SUSPENDED' })
            .where(eq(subscriptions.id, subscriptionId));
        fixture.advanceToAttempt(2);
        const original = await subscriptionRow(subscriptionId);
        const target = await targetVersion();
        const change = await seedScheduledChange({
            subscriptionId,
            effectiveAt: new Date(fixture.clock.now().getTime() + DAY_MS),
            targetPlanVersionId: target.planVersionId,
            targetBillingOptionId: target.billingOptionId
        });
        const onApplied = vi.fn();
        const result = await recordChargeFact(
            { chargeId: fixture.chargeId },
            {
                ...fixture.ports,
                scheduledChangeApplier: createScheduledChangeApplier({
                    clock: fixture.clock,
                    onApplied
                })
            }
        );
        expect(result).toMatchObject({
            reactivation: { outcome: 'REACTIVATED', destination: 'ACTIVE' }
        });
        expect(await scheduledChangesOf(subscriptionId)).toMatchObject([{ id: change.id }]);
        const [returned] = await getServiceTestDb()
            .select({ planVersionId: subscriptions.planVersionId })
            .from(subscriptions)
            .where(eq(subscriptions.id, subscriptionId));
        expect(returned?.planVersionId).toBe(original.planVersionId);
    });

    it('applies S38 before MP5 opens a same-day manual installment', async () => {
        const seededPlan = await seedPlanChange({ rankRelation: 'LOWER' });
        const subscriptionId = seededPlan.predecessor.id;
        manualPrincipals.push(subscriptionId);
        const chargeCreatedAt = new Date(successionClock.now().getTime() - 1);
        await getServiceTestDb()
            .update(subscriptions)
            .set({
                paymentMethod: 'MANUAL',
                nextChargeAt: successionClock.now()
            })
            .where(eq(subscriptions.id, subscriptionId));
        await seedScheduledChange({
            subscriptionId,
            effectiveAt: chargeCreatedAt,
            targetPlanVersionId: seededPlan.targetPlanVersionId,
            targetBillingOptionId: seededPlan.targetBillingOptionId
        });
        const onApplied = vi.fn();
        const result = await openDueManualInstallments(
            { pageSize: 100 },
            {
                clock: successionClock,
                planPolicy: async () => ({
                    graceDays: 7,
                    allowsPause: false,
                    current: true,
                    sellable: true
                }),
                scheduledChangeApplier: createScheduledChangeApplier({
                    clock: successionClock,
                    onApplied
                })
            }
        );
        const [subscription] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, subscriptionId));
        if (!subscription) throw new Error('Manual principal missing');
        const [installment] = await getServiceTestDb()
            .select()
            .from(manualPayments)
            .where(eq(manualPayments.subscriptionId, subscriptionId));
        const [targetOption] = await getServiceTestDb()
            .select({ amount: billingOptions.amount })
            .from(billingOptions)
            .where(eq(billingOptions.id, seededPlan.targetBillingOptionId));
        const destinationAmount = await createCutExpectedAmountPolicy().expectedAmount({
            subscription,
            purpose: { kind: 'PERIOD', chargeCreatedAt }
        });
        const oldAmount = await createCutExpectedAmountPolicy().expectedAmount({
            subscription: {
                ...subscription,
                planVersionId: seededPlan.planVersionId,
                billingOptionId: seededPlan.predecessorBillingOptionId
            },
            purpose: { kind: 'PERIOD', chargeCreatedAt }
        });
        expect(result.opened).toBe(1);
        expect(installment?.status).toBe('AWAITING');
        expect(subscription).toMatchObject({
            planVersionId: seededPlan.targetPlanVersionId,
            billingOptionId: seededPlan.targetBillingOptionId
        });
        expect(destinationAmount).toMatchObject({
            kind: 'COMPARABLE',
            amountMinor: targetOption?.amount
        });
        expect(oldAmount).toMatchObject({ kind: 'COMPARABLE', amountMinor: 250000 });
        expect(onApplied).toHaveBeenCalledTimes(1);
    });
});
