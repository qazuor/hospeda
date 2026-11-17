import type { BillingDeadlineValues } from '@repo/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { subscriptionModel } from '../../src/models/subscription/subscription.model.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { billingDeadlineVersions } from '../../src/schemas/vertical/billing-deadline-version.dbschema.ts';
import { billingOptions } from '../../src/schemas/vertical/billing-option.dbschema.ts';
import { plans, planVersions } from '../../src/schemas/vertical/plan-catalog.dbschema.ts';
import {
    planMigrationSubscriptions,
    planMigrations
} from '../../src/schemas/vertical/plan-migration.dbschema.ts';
import { subscriptionScheduledChanges } from '../../src/schemas/vertical/scheduled-change.dbschema.ts';
import { subscriptions } from '../../src/schemas/vertical/subscription.dbschema.ts';
import { closeTestPool, type DrizzleClient, testData, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

const billingDeadlineVersion1Values = {
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
} satisfies BillingDeadlineValues;

/** Seeds a user + plan + two versions (source and migration target) + their options. */
async function seedPlanChain(tx: DrizzleClient) {
    await tx
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: billingDeadlineVersion1Values })
        .onConflictDoNothing();
    const [user] = await tx
        .insert(users)
        .values({ ...testData.user() } as typeof users.$inferInsert)
        .returning();
    if (!user) throw new Error('Expected a user');
    const [plan] = await tx
        .insert(plans)
        .values({
            vertical: 'accommodation',
            slug: `screalign-${crypto.randomUUID()}`,
            name: 'Basic'
        })
        .returning();
    if (!plan) throw new Error('Expected a plan');
    const rank = Math.floor(Math.random() * 100_000_000) + 1000;
    const [sourceVersion] = await tx
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: 'accommodation',
            rank,
            sellable: true,
            current: false,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!sourceVersion) throw new Error('Expected a source version');
    const [targetVersion] = await tx
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: 'accommodation',
            rank: rank + 1,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!targetVersion) throw new Error('Expected a target version');
    const [sourceOption] = await tx
        .insert(billingOptions)
        .values({
            planVersionId: sourceVersion.id,
            cycle: 'monthly',
            amount: 1000,
            currency: 'ARS'
        })
        .returning();
    const [targetOption] = await tx
        .insert(billingOptions)
        .values({
            planVersionId: targetVersion.id,
            cycle: 'monthly',
            amount: 2000,
            currency: 'ARS'
        })
        .returning();
    if (!sourceOption || !targetOption) throw new Error('Expected billing options');
    return {
        userId: user.id,
        sourcePlanVersionId: sourceVersion.id,
        sourceOptionId: sourceOption.id,
        targetPlanVersionId: targetVersion.id,
        targetOptionId: targetOption.id
    };
}

type PlanChain = Awaited<ReturnType<typeof seedPlanChain>>;

/** Seeds one ACTIVE principal card subscription with a fresh owner; one live commitment per user+vertical. */
async function seedActiveSubscription(tx: DrizzleClient, chain: PlanChain, nextChargeAt: Date) {
    const [owner] = await tx
        .insert(users)
        .values({ ...testData.user() } as typeof users.$inferInsert)
        .returning();
    if (!owner) throw new Error('Expected a subscription owner');
    const [row] = await tx
        .insert(subscriptions)
        .values({
            userId: owner.id,
            vertical: 'accommodation',
            planVersionId: chain.sourcePlanVersionId,
            billingOptionId: chain.sourceOptionId,
            paymentMethod: 'CARD',
            status: 'ACTIVE',
            class: 'PRINCIPAL',
            nextChargeAt
        })
        .returning();
    if (!row) throw new Error('Expected a subscription');
    return row;
}

/** Seeds the migration whose application queued the change: the S37 aftermath shape. */
async function seedAppliedMigration(tx: DrizzleClient, chain: PlanChain, subscriptionId: string) {
    const [migration] = await tx
        .insert(planMigrations)
        .values({
            vertical: 'accommodation',
            sourcePlanVersionId: chain.sourcePlanVersionId,
            targetPlanVersionId: chain.targetPlanVersionId,
            reason: 'RETIREMENT',
            announcedAt: new Date('2026-10-11T13:00:00.000Z'),
            noticeDays: 60,
            deadlineVersion: 1,
            signedBy: chain.userId
        })
        .returning();
    if (!migration) throw new Error('Expected a plan migration');
    const [participation] = await tx
        .insert(planMigrationSubscriptions)
        .values({
            planMigrationId: migration.id,
            subscriptionId,
            applicationDate: new Date('2026-12-15T09:46:00.000Z'),
            status: 'APLICADA',
            appliedAt: new Date('2026-11-01T09:46:00.000Z')
        })
        .returning();
    if (!participation) throw new Error('Expected a participation row');
    return participation;
}

/** Seeds the queued change carrying `plan_migration_subscription_id` only when migration-born. */
async function seedQueuedChange(
    tx: DrizzleClient,
    args: {
        readonly subscriptionId: string;
        readonly chain: Pick<PlanChain, 'sourcePlanVersionId' | 'sourceOptionId'>;
        readonly effectiveAt: Date;
        readonly planMigrationSubscriptionId?: string | null;
    }
) {
    const [row] = await tx
        .insert(subscriptionScheduledChanges)
        .values({
            subscriptionId: args.subscriptionId,
            targetPlanVersionId: args.chain.sourcePlanVersionId,
            targetBillingOptionId: args.chain.sourceOptionId,
            effectiveAt: args.effectiveAt,
            planMigrationSubscriptionId: args.planMigrationSubscriptionId ?? null
        })
        .returning();
    if (!row) throw new Error('Expected a queued change');
    return row;
}

const SWEPT_AT = new Date('2026-11-20T13:00:00.000Z');
/** The provider-corrected date the sweep copies onto an ACTIVE subscription (staging shape). */
const PROVIDER_DATE = new Date('2026-12-15T09:46:00.000Z');

describe('syncNextChargeAt realigns migration-born queued changes (HOS-2310)', () => {
    it('realigns a future migration-born queued change to the new next_charge_at', async () => {
        await withTestTransaction(async (tx) => {
            const chain = await seedPlanChain(tx);
            const subscription = await seedActiveSubscription(
                tx,
                chain,
                new Date('2027-02-10T08:00:00.000Z')
            );
            const participation = await seedAppliedMigration(tx, chain, subscription.id);
            const storedNextChargeAt = new Date('2027-02-10T08:00:00.000Z');
            const queued = await seedQueuedChange(tx, {
                subscriptionId: subscription.id,
                chain,
                effectiveAt: storedNextChargeAt,
                planMigrationSubscriptionId: participation.id
            });
            expect(
                await subscriptionModel.syncNextChargeAt({
                    subscriptionId: subscription.id,
                    nextChargeAt: PROVIDER_DATE,
                    now: SWEPT_AT,
                    tx
                })
            ).toBe(true);
            const [after] = await tx
                .select()
                .from(subscriptionScheduledChanges)
                .where(eq(subscriptionScheduledChanges.id, queued.id));
            expect(after?.effectiveAt.toISOString()).toBe('2026-12-15T09:46:00.000Z');
        });
    });

    it('does not move an elapsed (or exactly-due) migration-born queued change', async () => {
        await withTestTransaction(async (tx) => {
            const chain = await seedPlanChain(tx);
            const participation = async (subscriptionId: string) =>
                await seedAppliedMigration(tx, chain, subscriptionId);
            const elapsedSub = await seedActiveSubscription(
                tx,
                chain,
                new Date('2027-02-10T08:00:00.000Z')
            );
            const elapsed = await seedQueuedChange(tx, {
                subscriptionId: elapsedSub.id,
                chain,
                effectiveAt: new Date('2026-11-15T09:46:00.000Z'),
                planMigrationSubscriptionId: (await participation(elapsedSub.id)).id
            });
            const dueSub = await seedActiveSubscription(
                tx,
                chain,
                new Date('2027-02-10T08:00:00.000Z')
            );
            const exactlyDue = await seedQueuedChange(tx, {
                subscriptionId: dueSub.id,
                chain,
                effectiveAt: SWEPT_AT,
                planMigrationSubscriptionId: (await participation(dueSub.id)).id
            });
            expect(
                await subscriptionModel.syncNextChargeAt({
                    subscriptionId: elapsedSub.id,
                    nextChargeAt: PROVIDER_DATE,
                    now: SWEPT_AT,
                    tx
                })
            ).toBe(true);
            expect(
                await subscriptionModel.syncNextChargeAt({
                    subscriptionId: dueSub.id,
                    nextChargeAt: PROVIDER_DATE,
                    now: SWEPT_AT,
                    tx
                })
            ).toBe(true);
            const [elapsedAfter] = await tx
                .select()
                .from(subscriptionScheduledChanges)
                .where(eq(subscriptionScheduledChanges.id, elapsed.id));
            const [dueAfter] = await tx
                .select()
                .from(subscriptionScheduledChanges)
                .where(eq(subscriptionScheduledChanges.id, exactlyDue.id));
            expect(elapsedAfter?.effectiveAt.toISOString()).toBe('2026-11-15T09:46:00.000Z');
            expect(dueAfter?.effectiveAt.toISOString()).toBe(SWEPT_AT.toISOString());
        });
    });

    it('does not move a client queued change with no migration origin', async () => {
        await withTestTransaction(async (tx) => {
            const chain = await seedPlanChain(tx);
            const storedNextChargeAt = new Date('2027-01-20T08:00:00.000Z');
            const subscription = await seedActiveSubscription(tx, chain, storedNextChargeAt);
            const queued = await seedQueuedChange(tx, {
                subscriptionId: subscription.id,
                chain,
                effectiveAt: storedNextChargeAt
            });
            expect(
                await subscriptionModel.syncNextChargeAt({
                    subscriptionId: subscription.id,
                    nextChargeAt: PROVIDER_DATE,
                    now: SWEPT_AT,
                    tx
                })
            ).toBe(true);
            const [after] = await tx
                .select()
                .from(subscriptionScheduledChanges)
                .where(eq(subscriptionScheduledChanges.id, queued.id));
            expect(after?.effectiveAt.toISOString()).toBe('2027-01-20T08:00:00.000Z');
        });
    });

    it('leaves the queue intact when the conditional write does not happen', async () => {
        await withTestTransaction(async (tx) => {
            const chain = await seedPlanChain(tx);
            const subscription = await seedActiveSubscription(
                tx,
                chain,
                new Date('2026-12-15T09:46:00.000Z')
            );
            const participation = await seedAppliedMigration(tx, chain, subscription.id);
            const queued = await seedQueuedChange(tx, {
                subscriptionId: subscription.id,
                chain,
                effectiveAt: new Date('2026-12-15T09:46:00.000Z'),
                planMigrationSubscriptionId: participation.id
            });
            // An earlier provider date already elapsed never rewrites a row whose
            // stored date is later and still ahead (HOS-2223).
            expect(
                await subscriptionModel.syncNextChargeAt({
                    subscriptionId: subscription.id,
                    nextChargeAt: new Date('2026-11-18T13:00:00.000Z'),
                    now: SWEPT_AT,
                    tx
                })
            ).toBe(false);
            const [after] = await tx
                .select()
                .from(subscriptionScheduledChanges)
                .where(eq(subscriptionScheduledChanges.id, queued.id));
            expect(after?.effectiveAt.toISOString()).toBe('2026-12-15T09:46:00.000Z');
        });
    });
});
