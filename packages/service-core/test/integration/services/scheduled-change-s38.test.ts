import {
    billingDeadlineVersions,
    DomainEventModel,
    eq,
    inArray,
    planMigrationSubscriptions,
    planMigrations,
    promoRedemptions,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
    applyScheduledChangeInTx,
    createScheduledChangeApplier
} from '../../../src/services/billing/subscription/apply-scheduled-change.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    retirePlanChanges,
    seedPlanChange,
    seedPlanChangePromo
} from './support/plan-change-fixtures.js';
import { scheduledChangesOf, seedScheduledChange } from './support/scheduled-change-fixtures.js';
import { successionClock } from './support/succession-fixtures.js';

const migrationSubscriptionIds: string[] = [];
const migrationIds: string[] = [];
afterEach(async () => {
    if (migrationSubscriptionIds.length) {
        await getServiceTestDb()
            .delete(subscriptionScheduledChanges)
            .where(
                inArray(
                    subscriptionScheduledChanges.planMigrationSubscriptionId,
                    migrationSubscriptionIds
                )
            );
        await getServiceTestDb()
            .delete(planMigrationSubscriptions)
            .where(inArray(planMigrationSubscriptions.id, migrationSubscriptionIds.splice(0)));
    }
    if (migrationIds.length)
        await getServiceTestDb()
            .delete(planMigrations)
            .where(inArray(planMigrations.id, migrationIds.splice(0)));
    await retirePlanChanges();
});
afterAll(closeServiceTestPool);

const dueAt = new Date(successionClock.now().getTime() - 1000);
const events = new DomainEventModel();

async function scheduled(status = 'ACTIVE') {
    const seeded = await seedPlanChange({ status });
    await seedScheduledChange({
        subscriptionId: seeded.predecessor.id,
        effectiveAt: dueAt,
        targetPlanVersionId: seeded.targetPlanVersionId,
        targetBillingOptionId: seeded.targetBillingOptionId,
        keepSelection: { accommodation: ['listing-one'] }
    });
    return seeded;
}

async function eventFor(subscriptionId: string) {
    const matching = (
        await events.findByEntity({ entityType: 'subscription', entityId: subscriptionId })
    ).filter((event) => event.eventType === 'subscription.scheduled_change_applied');
    return matching;
}

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:15 S38 scheduled change application', () => {
    it('applies an ACTIVE due change, clears the queue, preserves other fields and audits both pairs', async () => {
        const seeded = await scheduled();
        const redemption = await seedPlanChangePromo({
            subscriptionId: seeded.predecessor.id,
            userId: seeded.user.id
        });
        const [before] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.predecessor.id));
        const result = await getServiceTestDb().transaction((tx) =>
            applyScheduledChangeInTx({
                subscriptionId: seeded.predecessor.id,
                now: successionClock.now(),
                tx
            })
        );
        const [after] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.predecessor.id));
        const [promo] = await getServiceTestDb()
            .select()
            .from(promoRedemptions)
            .where(eq(promoRedemptions.id, redemption.id));
        const audit = await eventFor(seeded.predecessor.id);
        expect(result).toMatchObject({
            outcome: 'APPLIED',
            motive: 'DOWNGRADE',
            keepSelection: { accommodation: ['listing-one'] }
        });
        expect(after).toMatchObject({
            planVersionId: seeded.targetPlanVersionId,
            billingOptionId: seeded.targetBillingOptionId,
            status: before?.status,
            nextChargeAt: before?.nextChargeAt,
            graceStartedAt: before?.graceStartedAt,
            graceEndsAt: before?.graceEndsAt
        });
        expect(await scheduledChangesOf(seeded.predecessor.id)).toHaveLength(0);
        expect(promo?.remainingCharges).toBe(2);
        expect(audit).toHaveLength(1);
        expect(audit[0]?.changes).toEqual([
            {
                field: 'plan_version_id',
                old: seeded.planVersionId,
                new: seeded.targetPlanVersionId
            },
            {
                field: 'billing_option_id',
                old: seeded.predecessorBillingOptionId,
                new: seeded.targetBillingOptionId
            }
        ]);
    });

    it.each([
        'GRACE_PERIOD',
        'CANCEL_SCHEDULED'
    ] as const)('applies to %s while preserving grace clock values', async (status) => {
        const seeded = await scheduled(status);
        const graceStartedAt = new Date('2026-10-01T00:00:00Z');
        const graceEndsAt = new Date('2026-10-11T00:00:00Z');
        if (status === 'GRACE_PERIOD')
            await getServiceTestDb()
                .update(subscriptions)
                .set({ graceStartedAt, graceEndsAt })
                .where(eq(subscriptions.id, seeded.predecessor.id));
        const result = await getServiceTestDb().transaction((tx) =>
            applyScheduledChangeInTx({
                subscriptionId: seeded.predecessor.id,
                now: successionClock.now(),
                tx
            })
        );
        const [row] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.predecessor.id));
        expect(result.outcome).toBe('APPLIED');
        if (status === 'GRACE_PERIOD') expect(row).toMatchObject({ graceStartedAt, graceEndsAt });
    });

    it.each([
        ['PAUSED', 'WAITS_PAUSED'],
        ['SUSPENDED', 'WAITS_SUSPENDED'],
        ['CANCELLED', 'NOT_LIVE'],
        ['PENDING_AUTHORIZATION', 'NOT_LIVE'],
        ['ABANDONED', 'NOT_LIVE']
    ] as const)('leaves %s and its queue untouched', async (status, reason) => {
        const seeded = await scheduled(status);
        const [before] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.predecessor.id));
        const [queueBefore] = await getServiceTestDb()
            .select()
            .from(subscriptionScheduledChanges)
            .where(eq(subscriptionScheduledChanges.subscriptionId, seeded.predecessor.id));
        const result = await getServiceTestDb().transaction((tx) =>
            applyScheduledChangeInTx({
                subscriptionId: seeded.predecessor.id,
                now: successionClock.now(),
                tx
            })
        );
        const [after] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.predecessor.id));
        const [queueAfter] = await getServiceTestDb()
            .select()
            .from(subscriptionScheduledChanges)
            .where(eq(subscriptionScheduledChanges.subscriptionId, seeded.predecessor.id));
        expect(result).toEqual({ outcome: 'NOT_APPLICABLE', reason });
        expect(after).toEqual(before);
        expect(queueAfter).toEqual(queueBefore);
        expect(await eventFor(seeded.predecessor.id)).toHaveLength(0);
    });

    it('does nothing before effective_at and is idempotent after applying', async () => {
        const seeded = await scheduled();
        const [before] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.predecessor.id));
        const future = await getServiceTestDb().transaction((tx) =>
            applyScheduledChangeInTx({
                subscriptionId: seeded.predecessor.id,
                now: new Date(dueAt.getTime() - 1),
                tx
            })
        );
        expect(future).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'NOT_DUE' });
        const [after] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.predecessor.id));
        expect(after).toEqual(before);
        expect(await scheduledChangesOf(seeded.predecessor.id)).toHaveLength(1);
        const first = await getServiceTestDb().transaction((tx) =>
            applyScheduledChangeInTx({
                subscriptionId: seeded.predecessor.id,
                now: successionClock.now(),
                tx
            })
        );
        const second = await getServiceTestDb().transaction((tx) =>
            applyScheduledChangeInTx({
                subscriptionId: seeded.predecessor.id,
                now: successionClock.now(),
                tx
            })
        );
        expect(first.outcome).toBe('APPLIED');
        expect(second).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'NO_CHANGE' });
        expect(await eventFor(seeded.predecessor.id)).toHaveLength(1);
    });

    it('calls onApplied only for APPLIED and observes the write only inside the supplied transaction', async () => {
        const seeded = await scheduled();
        const onApplied = vi.fn();
        const applier = createScheduledChangeApplier({ clock: successionClock, onApplied });
        await getServiceTestDb().transaction(async (tx) => {
            await applier.applyScheduledChange({ subscriptionId: seeded.predecessor.id, tx });
            const [inside] = await tx
                .select({ planVersionId: subscriptions.planVersionId })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.predecessor.id));
            const [outside] = await getServiceTestDb()
                .select({ planVersionId: subscriptions.planVersionId })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.predecessor.id));
            expect(inside?.planVersionId).toBe(seeded.targetPlanVersionId);
            expect(outside?.planVersionId).toBe(seeded.planVersionId);
        });
        expect(onApplied).toHaveBeenCalledTimes(1);
        expect(onApplied).toHaveBeenCalledWith(
            expect.objectContaining({ outcome: 'APPLIED', subscriptionId: seeded.predecessor.id })
        );
        await getServiceTestDb().transaction((tx) =>
            createScheduledChangeApplier({
                clock: successionClock,
                onApplied
            }).applyScheduledChange({ subscriptionId: seeded.predecessor.id, tx })
        );
        expect(onApplied).toHaveBeenCalledTimes(1);
    });

    it('serializes concurrent applications to one event', async () => {
        const seeded = await scheduled();
        const apply = () =>
            getServiceTestDb().transaction((tx) =>
                applyScheduledChangeInTx({
                    subscriptionId: seeded.predecessor.id,
                    now: successionClock.now(),
                    tx
                })
            );
        const results = await Promise.all([apply(), apply()]);
        expect(results.filter((result) => result.outcome === 'APPLIED')).toHaveLength(1);
        expect(await eventFor(seeded.predecessor.id)).toHaveLength(1);
    });

    it.each([
        'PRICE_INCREASE',
        'RETIREMENT'
    ] as const)('reports migration reason %s without changing migration state', async (reason) => {
        const seeded = await seedPlanChange({});
        const [deadline] = await getServiceTestDb()
            .select({ version: billingDeadlineVersions.version })
            .from(billingDeadlineVersions)
            .limit(1);
        if (!deadline) throw new Error('Billing deadline fixture missing');
        const [migration] = await getServiceTestDb()
            .insert(planMigrations)
            .values({
                vertical: 'accommodation',
                sourcePlanVersionId: seeded.planVersionId,
                targetPlanVersionId: seeded.targetPlanVersionId,
                reason,
                announcedAt: new Date('2026-01-01T00:00:00Z'),
                noticeDays: 60,
                deadlineVersion: deadline.version,
                signedBy: seeded.user.id
            })
            .returning();
        if (!migration) throw new Error('Plan migration fixture missing');
        migrationIds.push(migration.id);
        const [participant] = await getServiceTestDb()
            .insert(planMigrationSubscriptions)
            .values({
                planMigrationId: migration.id,
                subscriptionId: seeded.predecessor.id,
                applicationDate: dueAt,
                status: 'PENDIENTE'
            })
            .returning();
        if (!participant) throw new Error('Plan migration subscription fixture missing');
        migrationSubscriptionIds.push(participant.id);
        await seedScheduledChange({
            subscriptionId: seeded.predecessor.id,
            effectiveAt: dueAt,
            targetPlanVersionId: seeded.targetPlanVersionId,
            targetBillingOptionId: seeded.targetBillingOptionId,
            planMigrationSubscriptionId: participant.id
        });
        const result = await getServiceTestDb().transaction((tx) =>
            applyScheduledChangeInTx({
                subscriptionId: seeded.predecessor.id,
                now: successionClock.now(),
                tx
            })
        );
        expect(result).toMatchObject({ outcome: 'APPLIED', motive: reason });
        const [stillPending] = await getServiceTestDb()
            .select({ status: planMigrationSubscriptions.status })
            .from(planMigrationSubscriptions)
            .where(eq(planMigrationSubscriptions.id, participant.id));
        expect(stillPending?.status).toBe('PENDIENTE');
    });

    it('returns NOT_PRINCIPAL for a missing subscription id', async () => {
        const result = await getServiceTestDb().transaction((tx) =>
            applyScheduledChangeInTx({
                subscriptionId: crypto.randomUUID(),
                now: successionClock.now(),
                tx
            })
        );
        expect(result).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'NOT_PRINCIPAL' });
    });

    it('returns NOT_PRINCIPAL for an existing non-principal row without consuming its queue', async () => {
        const seeded = await scheduled();
        await getServiceTestDb()
            .update(subscriptions)
            .set({ class: 'COMPLEMENTO' })
            .where(eq(subscriptions.id, seeded.predecessor.id));
        const [before] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.predecessor.id));
        const result = await getServiceTestDb().transaction((tx) =>
            applyScheduledChangeInTx({
                subscriptionId: seeded.predecessor.id,
                now: successionClock.now(),
                tx
            })
        );
        const [after] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.predecessor.id));
        expect(result).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'NOT_PRINCIPAL' });
        expect(after).toEqual(before);
        expect(await scheduledChangesOf(seeded.predecessor.id)).toHaveLength(1);
    });
});
