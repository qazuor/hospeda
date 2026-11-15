import {
    billingDeadlineVersions,
    eq,
    inArray,
    planMigrationSubscriptions,
    planMigrations,
    promoRedemptions,
    subscriptionScheduledChanges
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { applyScheduledChangeInTx } from '../../../src/services/billing/subscription/apply-scheduled-change.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    retirePlanChanges,
    seedPlanChange,
    seedPlanChangePromo
} from './support/plan-change-fixtures.js';
import { seedScheduledChange } from './support/scheduled-change-fixtures.js';
import { successionClock } from './support/succession-fixtures.js';

const participantIds: string[] = [];
const migrationIds: string[] = [];
afterEach(async () => {
    if (participantIds.length) {
        await getServiceTestDb()
            .delete(subscriptionScheduledChanges)
            .where(
                inArray(subscriptionScheduledChanges.planMigrationSubscriptionId, participantIds)
            );
        await getServiceTestDb()
            .delete(planMigrationSubscriptions)
            .where(inArray(planMigrationSubscriptions.id, participantIds.splice(0)));
    }
    if (migrationIds.length)
        await getServiceTestDb()
            .delete(planMigrations)
            .where(inArray(planMigrations.id, migrationIds.splice(0)));
    await retirePlanChanges();
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:15 S38 increase migration', () => {
    it('applies PRICE_INCREASE while preserving the live promo and applied cohort state', async () => {
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
                reason: 'PRICE_INCREASE',
                announcedAt: new Date('2026-01-01T00:00:00.000Z'),
                noticeDays: 60,
                deadlineVersion: deadline.version,
                signedBy: seeded.user.id
            })
            .returning();
        if (!migration) throw new Error('Migration fixture missing');
        migrationIds.push(migration.id);
        const [scope] = await getServiceTestDb()
            .insert(planMigrationSubscriptions)
            .values({
                planMigrationId: migration.id,
                subscriptionId: seeded.predecessor.id,
                applicationDate: new Date(successionClock.now().getTime() - 1),
                status: 'APLICADA',
                appliedAt: new Date(successionClock.now().getTime() - 1)
            })
            .returning();
        if (!scope) throw new Error('Migration scope fixture missing');
        participantIds.push(scope.id);
        const promo = await seedPlanChangePromo({
            subscriptionId: seeded.predecessor.id,
            userId: seeded.user.id
        });
        await getServiceTestDb()
            .update(promoRedemptions)
            .set({ remainingCharges: 3 })
            .where(eq(promoRedemptions.id, promo.id));
        await seedScheduledChange({
            subscriptionId: seeded.predecessor.id,
            effectiveAt: new Date(successionClock.now().getTime() - 1),
            targetPlanVersionId: seeded.targetPlanVersionId,
            targetBillingOptionId: seeded.targetBillingOptionId,
            planMigrationSubscriptionId: scope.id
        });

        const result = await getServiceTestDb().transaction((tx) =>
            applyScheduledChangeInTx({
                subscriptionId: seeded.predecessor.id,
                now: successionClock.now(),
                tx
            })
        );
        const [redemption] = await getServiceTestDb()
            .select({ remainingCharges: promoRedemptions.remainingCharges })
            .from(promoRedemptions)
            .where(eq(promoRedemptions.id, promo.id));
        const [cohort] = await getServiceTestDb()
            .select({ status: planMigrationSubscriptions.status })
            .from(planMigrationSubscriptions)
            .where(eq(planMigrationSubscriptions.id, scope.id));
        expect(result).toMatchObject({
            outcome: 'APPLIED',
            motive: 'PRICE_INCREASE',
            toPlanVersionId: seeded.targetPlanVersionId
        });
        expect(redemption?.remainingCharges).toBe(3);
        expect(cohort?.status).toBe('APLICADA');
    });

    it('retains RETIREMENT as the scheduled change motive', async () => {
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
                reason: 'RETIREMENT',
                announcedAt: new Date('2026-01-01T00:00:00.000Z'),
                noticeDays: 60,
                deadlineVersion: deadline.version,
                signedBy: seeded.user.id
            })
            .returning();
        if (!migration) throw new Error('Migration fixture missing');
        migrationIds.push(migration.id);
        const [scope] = await getServiceTestDb()
            .insert(planMigrationSubscriptions)
            .values({
                planMigrationId: migration.id,
                subscriptionId: seeded.predecessor.id,
                applicationDate: new Date(successionClock.now().getTime() - 1),
                status: 'PENDIENTE'
            })
            .returning();
        if (!scope) throw new Error('Migration scope fixture missing');
        participantIds.push(scope.id);
        await seedScheduledChange({
            subscriptionId: seeded.predecessor.id,
            effectiveAt: new Date(successionClock.now().getTime() - 1),
            targetPlanVersionId: seeded.targetPlanVersionId,
            targetBillingOptionId: seeded.targetBillingOptionId,
            planMigrationSubscriptionId: scope.id
        });
        const result = await getServiceTestDb().transaction((tx) =>
            applyScheduledChangeInTx({
                subscriptionId: seeded.predecessor.id,
                now: successionClock.now(),
                tx
            })
        );
        expect(result).toMatchObject({ outcome: 'APPLIED', motive: 'RETIREMENT' });
    });
});
