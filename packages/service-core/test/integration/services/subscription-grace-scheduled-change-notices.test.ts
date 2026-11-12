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
const deadlineVersion = 3;
const instant = (day: string) => new Date(`${day}T15:00:00.000Z`);

afterEach(async () => {
    if (scheduledIds.length)
        await getServiceTestDb()
            .delete(subscriptionScheduledChanges)
            .where(eq(subscriptionScheduledChanges.subscriptionId, scheduledIds.splice(0)[0]!));
    await retirePausedCancellationRows();
});
afterAll(closeServiceTestPool);

async function fixture(
    withScheduledChange: boolean,
    startedAt = instant('2099-03-01'),
    endsAt = instant('2099-03-20'),
    effectiveAt = instant('2099-03-10')
) {
    const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
    const seeded = await seedPausedCancellation({ fake });
    await configureGraceReminderSubscription({
        subscriptionId: seeded.subscriptionId,
        startedAt,
        endsAt
    });
    if (!withScheduledChange) return seeded;
    const [subscription] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, seeded.subscriptionId));
    if (!subscription?.planVersionId) throw new Error('Seeded subscription plan version missing');
    const destination = await getServiceTestDb()
        .select({
            billingOptionId: billingOptions.id,
            planVersionId: planVersions.id,
            slug: plans.slug,
            name: plans.name
        })
        .from(plans)
        .innerJoin(planVersions, eq(planVersions.planId, plans.id))
        .innerJoin(billingOptions, eq(billingOptions.planVersionId, planVersions.id))
        .where(
            and(
                eq(plans.vertical, subscription.vertical ?? ''),
                eq(plans.slug, 'owner-pro'),
                eq(planVersions.current, true),
                eq(billingOptions.cycle, 'monthly'),
                ne(planVersions.id, subscription.planVersionId)
            )
        );
    const target = destination[0];
    if (!target) throw new Error('No other plan version in the vertical');
    await getServiceTestDb().insert(subscriptionScheduledChanges).values({
        subscriptionId: seeded.subscriptionId,
        targetPlanVersionId: target.planVersionId,
        targetBillingOptionId: target.billingOptionId,
        effectiveAt
    });
    scheduledIds.push(seeded.subscriptionId);
    return { ...seeded, target };
}

async function mail(subscriptionId: string, template: string) {
    const rows = await getServiceTestDb()
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.template, template));
    return rows.find((row) => row.payload.subscriptionId === subscriptionId);
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
            const payload = notice?.payload;
            // Assert
            expect(seeded.target.slug).toBe('owner-pro');
            expect(seeded.target.name).not.toBe('Profesional');
            expect(payload?.scheduledChange).toEqual({
                planName: 'Profesional',
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
            const seeded = await fixture(true, instant('2200-03-01'), instant('2299-03-20'));
            if (!('target' in seeded)) throw new Error('Scheduled fixture missing');
            await insertGraceReminderDeadline({
                version: deadlineVersion,
                createdAt: instant('2200-02-01'),
                daysBefore: [3]
            });

            // Act
            const result = await getServiceTestDb().transaction((tx) =>
                applyGraceReminder({
                    tx,
                    subscriptionId: seeded.subscriptionId,
                    now: instant('2299-03-17')
                })
            );
            const notice = await mail(seeded.subscriptionId, 'billing.grace-reminder');
            const payload = notice?.payload;
            // Assert
            expect(seeded.target.slug).toBe('owner-pro');
            expect(seeded.target.name).not.toBe('Profesional');
            expect(result.outcome).toBe('ENQUEUED');
            expect(payload?.scheduledChange).toEqual({
                planName: 'Profesional',
                effectiveAt: instant('2099-03-10').toISOString()
            });
        });

        it('grace reminder omits scheduledChange without a queued change', async () => {
            // Arrange
            const seeded = await fixture(false, instant('2200-03-01'), instant('2299-03-20'));
            await insertGraceReminderDeadline({
                version: deadlineVersion,
                createdAt: instant('2200-02-01'),
                daysBefore: [3]
            });

            // Act
            await getServiceTestDb().transaction((tx) =>
                applyGraceReminder({
                    tx,
                    subscriptionId: seeded.subscriptionId,
                    now: instant('2299-03-17')
                })
            );
            const notice = await mail(seeded.subscriptionId, 'billing.grace-reminder');

            // Assert
            expect(Object.hasOwn(notice?.payload ?? {}, 'scheduledChange')).toBe(false);
        });

        it('grace reminder includes a change scheduled after the grace ends', async () => {
            // Arrange
            const graceEndsAt = instant('2299-03-20');
            const effectiveAt = instant('2299-03-21');
            const seeded = await fixture(true, instant('2200-03-01'), graceEndsAt, effectiveAt);
            await insertGraceReminderDeadline({
                version: deadlineVersion,
                createdAt: instant('2200-02-01'),
                daysBefore: [3]
            });

            // Act
            const result = await getServiceTestDb().transaction((tx) =>
                applyGraceReminder({
                    tx,
                    subscriptionId: seeded.subscriptionId,
                    now: instant('2299-03-17')
                })
            );
            const notice = await mail(seeded.subscriptionId, 'billing.grace-reminder');

            // Assert
            expect(result.outcome).toBe('ENQUEUED');
            expect(effectiveAt.getTime()).toBeGreaterThan(graceEndsAt.getTime());
            expect(notice?.payload.scheduledChange).toEqual({
                planName: 'Profesional',
                effectiveAt: effectiveAt.toISOString()
            });
        });
    }
);
