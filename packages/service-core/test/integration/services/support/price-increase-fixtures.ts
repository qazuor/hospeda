import {
    billingDeadlineVersions,
    billingOptions,
    eq,
    planMigrationSubscriptions,
    planMigrations,
    subscriptionScheduledChanges
} from '@repo/db';
import { getServiceTestDb } from '../helpers.js';
import { seedCoveragePlanVersion } from './coverage-fixtures.js';

const migrationIds: string[] = [];
const participationIds: string[] = [];
const scheduledIds: string[] = [];

/** Seeds the three linked DDL rows that B12 will write for a price increase. */
export async function seedPriceIncrease(input: {
    readonly subscriptionId: string;
    readonly userId: string;
    readonly sourcePlanVersionId: string;
    readonly announcedAt: Date;
    readonly effectiveAt: Date;
}) {
    const db = getServiceTestDb();
    const destination = await db.transaction(async (tx) => {
        const target = await seedCoveragePlanVersion(tx, 'accommodation');
        await tx
            .update(billingOptions)
            .set({ amount: 300000 })
            .where(eq(billingOptions.id, target.billingOptionId));
        await tx
            .insert(billingDeadlineVersions)
            .values({
                version: 1,
                values: {
                    '10': { cardHours: 72, manualDays: 7 },
                    '11': { noticeDays: 60, contactDays: [30, 7] },
                    '12': { noticeDays: 60, contactDays: [30, 7] },
                    '13': { daysBefore: [5, 1] },
                    '14': { daysBefore: 7 },
                    '15': { hoursRemaining: 24 },
                    '16': { days: 7 },
                    '17': { days: 7 },
                    '18': { days: 180 },
                    '19': { minutes: 60 }
                }
            })
            .onConflictDoNothing();
        const [migration] = await tx
            .insert(planMigrations)
            .values({
                vertical: 'accommodation',
                sourcePlanVersionId: input.sourcePlanVersionId,
                targetPlanVersionId: target.planVersionId,
                reason: 'PRICE_INCREASE',
                announcedAt: input.announcedAt,
                noticeDays: 60,
                deadlineVersion: 1,
                signedBy: input.userId
            })
            .returning();
        if (!migration) throw new Error('Migration missing');
        const [participation] = await tx
            .insert(planMigrationSubscriptions)
            .values({
                planMigrationId: migration.id,
                subscriptionId: input.subscriptionId,
                applicationDate: input.effectiveAt,
                status: 'PENDIENTE'
            })
            .returning();
        if (!participation) throw new Error('Participation missing');
        const [scheduled] = await tx
            .insert(subscriptionScheduledChanges)
            .values({
                subscriptionId: input.subscriptionId,
                targetPlanVersionId: target.planVersionId,
                targetBillingOptionId: target.billingOptionId,
                effectiveAt: input.effectiveAt,
                planMigrationSubscriptionId: participation.id
            })
            .returning();
        if (!scheduled) throw new Error('Scheduled change missing');
        return { migration, participation, scheduled, target };
    });
    migrationIds.push(destination.migration.id);
    participationIds.push(destination.participation.id);
    scheduledIds.push(destination.scheduled.id);
    return destination;
}

/** Deletes only price-increase rows created by this fixture, in FK order. */
export async function retirePriceIncreases(): Promise<void> {
    const db = getServiceTestDb();
    for (const id of scheduledIds.splice(0))
        await db
            .delete(subscriptionScheduledChanges)
            .where(eq(subscriptionScheduledChanges.id, id));
    for (const id of participationIds.splice(0))
        await db.delete(planMigrationSubscriptions).where(eq(planMigrationSubscriptions.id, id));
    for (const id of migrationIds.splice(0))
        await db.delete(planMigrations).where(eq(planMigrations.id, id));
}
