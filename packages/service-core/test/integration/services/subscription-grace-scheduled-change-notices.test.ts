import {
    and,
    billingOptions,
    emailOutbox,
    eq,
    ne,
    plans,
    planVersions,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { resolvePlanDisplayName } from '../../../src/services/billing/plan-display-name.js';
import { applyGraceReminder } from '../../../src/services/billing/subscription/grace-reminder-notice.js';
import { enqueueGraceStartedNotice } from '../../../src/services/billing/subscription/grace-started-notice.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    pausedNow,
    retirePausedCancellationRows,
    seedPausedCancellation
} from './support/cancel-paused-fixtures.js';
import {
    configureGraceReminderSubscription,
    insertGraceReminderDeadline
} from './support/grace-reminder-fixtures.js';

const clock = { now: () => pausedNow };
const scheduledIds: string[] = [];
const deadlineVersion = -1784;
const instant = (day: string) => new Date(`${day}T15:00:00.000Z`);

afterEach(async () => {
    if (scheduledIds.length)
        await getServiceTestDb()
            .delete(subscriptionScheduledChanges)
            .where(eq(subscriptionScheduledChanges.subscriptionId, scheduledIds.splice(0)[0]!));
    await retirePausedCancellationRows();
});
afterAll(closeServiceTestPool);

async function fixture(withScheduledChange: boolean, startedAt = instant('2099-03-01')) {
    const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
    const seeded = await seedPausedCancellation({ fake });
    await configureGraceReminderSubscription({
        subscriptionId: seeded.subscriptionId,
        startedAt,
        endsAt: instant('2099-03-20')
    });
    if (!withScheduledChange) return seeded;
    const [subscription] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, seeded.subscriptionId));
    if (!subscription) throw new Error('Seeded subscription missing');
    const [targetPlan] = await getServiceTestDb()
        .insert(plans)
        .values({
            vertical: subscription.vertical ?? 'accommodation',
            slug: `hos-1784-${crypto.randomUUID()}`,
            name: 'HOS-1784 destination'
        })
        .returning({ id: plans.id });
    if (!targetPlan) throw new Error('HOS-1784 destination plan insert failed');
    const [targetVersion] = await getServiceTestDb()
        .insert(planVersions)
        .values({
            planId: targetPlan.id,
            vertical: subscription.vertical ?? 'accommodation',
            rank: Math.floor(Math.random() * 1e9) + 1,
            sellable: false,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning({ id: planVersions.id });
    if (!targetVersion) throw new Error('HOS-1784 destination version insert failed');
    const [targetOption] = await getServiceTestDb()
        .insert(billingOptions)
        .values({
            planVersionId: targetVersion.id,
            cycle: 'monthly',
            amount: 10000,
            currency: 'ARS'
        })
        .returning({ id: billingOptions.id });
    if (!targetOption) throw new Error('HOS-1784 destination billing option insert failed');
    const destination = await getServiceTestDb()
        .select({
            billingOptionId: billingOptions.id,
            planVersionId: billingOptions.planVersionId,
            slug: plans.slug,
            name: plans.name,
            vertical: plans.vertical
        })
        .from(billingOptions)
        .innerJoin(planVersions, eq(planVersions.id, billingOptions.planVersionId))
        .innerJoin(plans, eq(plans.id, planVersions.planId))
        .where(
            and(
                eq(plans.vertical, subscription.vertical ?? ''),
                ne(planVersions.id, subscription.planVersionId)
            )
        )
        .limit(1);
    const target = destination[0];
    if (!target) throw new Error('No other plan version in the vertical');
    await getServiceTestDb()
        .insert(subscriptionScheduledChanges)
        .values({
            subscriptionId: seeded.subscriptionId,
            targetPlanVersionId: target.planVersionId,
            targetBillingOptionId: target.billingOptionId,
            effectiveAt: instant('2099-03-10')
        });
    scheduledIds.push(seeded.subscriptionId);
    return { ...seeded, target };
}

async function mail(subscriptionId: string, template: string) {
    const rows = await getServiceTestDb()
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.template, template));
    return rows.find(
        (row) => (row.payload as { subscriptionId?: string }).subscriptionId === subscriptionId
    );
}

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-1784 grace notice scheduled change payload',
    () => {
        it('grace started carries the scheduled change with the destination plan name', async () => {
            // Arrange
            const seeded = await fixture(true);
            const [subscription] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId));
            if (!subscription || !('target' in seeded))
                throw new Error('Scheduled fixture missing');

            // Act
            await getServiceTestDb().transaction((tx) =>
                enqueueGraceStartedNotice({
                    tx,
                    subscription,
                    chargeId: crypto.randomUUID(),
                    graceEndsAt: instant('2099-03-20')
                })
            );
            const notice = await mail(seeded.subscriptionId, 'billing.grace-started');
            const payload = notice?.payload as Record<string, unknown> | undefined;
            const expectedPlanName = await resolvePlanDisplayName({
                vertical: seeded.target.vertical,
                plan: { slug: seeded.target.slug, name: seeded.target.name }
            });

            // Assert
            expect(payload?.scheduledChange).toEqual({
                planName: expectedPlanName,
                effectiveAt: instant('2099-03-10').toISOString()
            });
        });

        it('grace started omits scheduledChange without a queued change', async () => {
            // Arrange
            const seeded = await fixture(false);
            const [subscription] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId));
            if (!subscription) throw new Error('Seeded subscription missing');

            // Act
            await getServiceTestDb().transaction((tx) =>
                enqueueGraceStartedNotice({
                    tx,
                    subscription,
                    chargeId: crypto.randomUUID(),
                    graceEndsAt: instant('2099-03-20')
                })
            );
            const notice = await mail(seeded.subscriptionId, 'billing.grace-started');

            // Assert
            expect(Object.hasOwn(notice?.payload ?? {}, 'scheduledChange')).toBe(false);
        });

        it('grace reminder carries the scheduled change with the destination plan name', async () => {
            // Arrange
            const seeded = await fixture(true, instant('2000-03-01'));
            if (!('target' in seeded)) throw new Error('Scheduled fixture missing');
            await insertGraceReminderDeadline({
                version: deadlineVersion,
                createdAt: instant('2000-02-01'),
                daysBefore: [3]
            });

            // Act
            const result = await getServiceTestDb().transaction((tx) =>
                applyGraceReminder({
                    tx,
                    subscriptionId: seeded.subscriptionId,
                    now: instant('2099-03-17')
                })
            );
            const notice = await mail(seeded.subscriptionId, 'billing.grace-reminder');
            const payload = notice?.payload as Record<string, unknown> | undefined;
            const expectedPlanName = await resolvePlanDisplayName({
                vertical: seeded.target.vertical,
                plan: { slug: seeded.target.slug, name: seeded.target.name }
            });

            // Assert
            expect(result.outcome).toBe('ENQUEUED');
            expect(payload?.scheduledChange).toEqual({
                planName: expectedPlanName,
                effectiveAt: instant('2099-03-10').toISOString()
            });
        });

        it('grace reminder omits scheduledChange without a queued change', async () => {
            // Arrange
            const seeded = await fixture(false, instant('2000-03-01'));
            await insertGraceReminderDeadline({
                version: deadlineVersion,
                createdAt: instant('2000-02-01'),
                daysBefore: [3]
            });

            // Act
            await getServiceTestDb().transaction((tx) =>
                applyGraceReminder({
                    tx,
                    subscriptionId: seeded.subscriptionId,
                    now: instant('2099-03-17')
                })
            );
            const notice = await mail(seeded.subscriptionId, 'billing.grace-reminder');

            // Assert
            expect(Object.hasOwn(notice?.payload ?? {}, 'scheduledChange')).toBe(false);
        });
    }
);
