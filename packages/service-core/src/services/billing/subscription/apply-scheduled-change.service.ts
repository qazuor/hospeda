import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    DomainEventModel,
    type DrizzleClient,
    eq,
    inArray,
    planMigrationSubscriptions,
    planMigrations,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';
import { z } from 'zod';
import type { ScheduledChangeApplier } from './subscription-billing-ports.js';

const inputSchema = z.strictObject({
    subscriptionId: z.uuid(),
    now: z.date(),
    tx: z.custom<DrizzleClient>()
});
const LIVE_APPLY_STATUSES = ['ACTIVE', 'GRACE_PERIOD', 'CANCEL_SCHEDULED'] as const;

/** S38 outcome for one subscription. */
export type ApplyScheduledChangeResult =
    | {
          readonly outcome: 'APPLIED';
          readonly subscriptionId: string;
          readonly userId: string;
          readonly vertical: string;
          readonly fromPlanVersionId: string;
          readonly toPlanVersionId: string;
          readonly fromBillingOptionId: string;
          readonly toBillingOptionId: string;
          readonly motive: 'DOWNGRADE' | 'PRICE_INCREASE' | 'RETIREMENT';
          readonly keepSelection: Record<string, string[]> | null;
      }
    | {
          readonly outcome: 'NOT_APPLICABLE';
          readonly reason:
              | 'NOT_PRINCIPAL'
              | 'NO_CHANGE'
              | 'NOT_DUE'
              | 'WAITS_PAUSED'
              | 'WAITS_SUSPENDED'
              | 'NOT_LIVE';
      };

/** Applies one due queued plan change in the caller's transaction (TRANS:B:S38). */
export async function applyScheduledChangeInTx(input: {
    readonly subscriptionId: string;
    readonly now: Date;
    readonly tx: DrizzleClient;
}): Promise<ApplyScheduledChangeResult> {
    const { subscriptionId, now, tx } = inputSchema.parse(input);
    const [subscription] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId))
        .for('update')
        .limit(1);
    if (subscription?.class !== 'PRINCIPAL')
        return { outcome: 'NOT_APPLICABLE', reason: 'NOT_PRINCIPAL' };

    const [queued] = await tx
        .select()
        .from(subscriptionScheduledChanges)
        .where(eq(subscriptionScheduledChanges.subscriptionId, subscriptionId))
        .limit(1);
    if (!queued) return { outcome: 'NOT_APPLICABLE', reason: 'NO_CHANGE' };
    if (queued.effectiveAt > now) return { outcome: 'NOT_APPLICABLE', reason: 'NOT_DUE' };
    if (subscription.status === 'PAUSED')
        return { outcome: 'NOT_APPLICABLE', reason: 'WAITS_PAUSED' };
    if (subscription.status === 'SUSPENDED')
        return { outcome: 'NOT_APPLICABLE', reason: 'WAITS_SUSPENDED' };
    if (!(LIVE_APPLY_STATUSES as readonly string[]).includes(subscription.status))
        return { outcome: 'NOT_APPLICABLE', reason: 'NOT_LIVE' };
    if (
        !subscription.userId ||
        !subscription.vertical ||
        !subscription.planVersionId ||
        !subscription.billingOptionId
    )
        return { outcome: 'NOT_APPLICABLE', reason: 'NOT_PRINCIPAL' };

    let motive: 'DOWNGRADE' | 'PRICE_INCREASE' | 'RETIREMENT' = 'DOWNGRADE';
    if (queued.planMigrationSubscriptionId) {
        const [migrationRow] = await tx
            .select({ reason: planMigrations.reason })
            .from(planMigrationSubscriptions)
            .innerJoin(
                planMigrations,
                eq(planMigrations.id, planMigrationSubscriptions.planMigrationId)
            )
            .where(eq(planMigrationSubscriptions.id, queued.planMigrationSubscriptionId))
            .limit(1);
        if (migrationRow?.reason === 'PRICE_INCREASE') motive = 'PRICE_INCREASE';
        else if (migrationRow?.reason === 'RETIREMENT') motive = 'RETIREMENT';
        else throw new Error('Scheduled change references a missing or invalid plan migration');
    }

    const [updated] = await tx
        .update(subscriptions)
        .set({
            planVersionId: queued.targetPlanVersionId,
            billingOptionId: queued.targetBillingOptionId
        })
        .where(
            and(
                eq(subscriptions.id, subscriptionId),
                eq(subscriptions.class, 'PRINCIPAL'),
                // Keep the status predicate as a race-safe second defense after the row lock.
                inArray(subscriptions.status, [...LIVE_APPLY_STATUSES])
            )
        )
        .returning({ id: subscriptions.id });
    if (!updated) return { outcome: 'NOT_APPLICABLE', reason: 'NOT_LIVE' };
    await tx
        .delete(subscriptionScheduledChanges)
        .where(eq(subscriptionScheduledChanges.id, queued.id));
    await new DomainEventModel().insert({
        eventType: 'subscription.scheduled_change_applied',
        entityType: 'subscription',
        entityId: subscriptionId,
        actorType: 'job',
        correlationId: subscriptionId,
        reason: 'S38',
        occurredAt: now,
        changes: [
            {
                field: 'plan_version_id',
                old: subscription.planVersionId,
                new: queued.targetPlanVersionId
            },
            {
                field: 'billing_option_id',
                old: subscription.billingOptionId,
                new: queued.targetBillingOptionId
            }
        ],
        tx
    });
    return {
        outcome: 'APPLIED',
        subscriptionId,
        userId: subscription.userId,
        vertical: subscription.vertical,
        fromPlanVersionId: subscription.planVersionId,
        toPlanVersionId: queued.targetPlanVersionId,
        fromBillingOptionId: subscription.billingOptionId,
        toBillingOptionId: queued.targetBillingOptionId,
        motive,
        keepSelection: queued.keepSelection
    };
}

/** Builds the S38 adapter used by existing transition ports. */
export function createScheduledChangeApplier(input: {
    readonly clock: Clock;
    readonly onApplied: (
        applied: Extract<ApplyScheduledChangeResult, { outcome: 'APPLIED' }>
    ) => void;
}): ScheduledChangeApplier {
    return {
        async applyScheduledChange({ subscriptionId, tx }) {
            const applied = await applyScheduledChangeInTx({
                subscriptionId,
                now: input.clock.now(),
                tx
            });
            if (applied.outcome === 'APPLIED') input.onApplied(applied);
        }
    };
}
