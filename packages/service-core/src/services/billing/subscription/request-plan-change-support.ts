import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    billingOptions,
    coveredPeriods,
    desc,
    eq,
    getDb,
    isNull,
    payments,
    planVersions,
    promoRedemptions,
    providerLinks,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';
import {
    actStartInstant,
    assertFreshForAct,
    confirmAuthorizationMutation,
    type PaymentProvider
} from '@repo/payments';
import {
    BILLING_CYCLE_MONTHS,
    type BillingCycle,
    BillingCycleSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { addCalendarMonths } from '@repo/utils';
import { ServiceError } from '../../../types/index.js';
import { computeSuccessorCreditDays } from './successor-credit.js';

/** Reads only the caller's subscription and its provider link. */
export async function readPlanChangeOrigin(input: {
    readonly subscriptionId: string;
    readonly userId: string;
}) {
    const [row] = await getDb()
        .select({ subscription: subscriptions, providerId: providerLinks.providerId })
        .from(subscriptions)
        .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .where(
            and(eq(subscriptions.id, input.subscriptionId), eq(subscriptions.userId, input.userId))
        )
        .limit(1);
    if (!row)
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            'Subscription not found',
            undefined,
            'SUBSCRIPTION_NOT_FOUND'
        );
    return row;
}

/** Reads the destination's persisted list price and plan identity. */
export async function readPlanChangeTarget(input: { readonly billingOptionId: string }) {
    const [row] = await getDb()
        .select({
            id: billingOptions.id,
            planVersionId: billingOptions.planVersionId,
            amount: billingOptions.amount,
            currency: billingOptions.currency,
            cycle: billingOptions.cycle,
            vertical: planVersions.vertical
        })
        .from(billingOptions)
        .innerJoin(planVersions, eq(planVersions.id, billingOptions.planVersionId))
        .where(eq(billingOptions.id, input.billingOptionId))
        .limit(1);
    if (!row)
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            'Billing option not found',
            undefined,
            'BILLING_OPTION_NOT_FOUND'
        );
    return row;
}

/** Reads the open covered payment and computes the successor's value credit. */
export async function readSuccessorCredit(input: {
    readonly subscriptionId: string;
    readonly now: Date;
    readonly targetAmountMinor: number;
    readonly targetCycle: BillingCycle;
}): Promise<{ readonly creditDays: number; readonly unusedMinor: number }> {
    const rows = await getDb()
        .select({
            periodStart: coveredPeriods.periodStart,
            amount: payments.amount,
            cycle: billingOptions.cycle
        })
        .from(coveredPeriods)
        .innerJoin(payments, eq(payments.id, coveredPeriods.paymentId))
        .innerJoin(subscriptions, eq(subscriptions.id, coveredPeriods.subscriptionId))
        .innerJoin(billingOptions, eq(billingOptions.id, subscriptions.billingOptionId))
        .where(
            and(
                eq(coveredPeriods.subscriptionId, input.subscriptionId),
                isNull(coveredPeriods.releasedAt)
            )
        )
        .orderBy(desc(coveredPeriods.periodStart));
    for (const row of rows) {
        const cycle = BillingCycleSchema.safeParse(row.cycle);
        if (!cycle.success)
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Unknown predecessor cycle',
                undefined,
                'PLAN_CHANGE_INVALID_CYCLE'
            );
        const months = BILLING_CYCLE_MONTHS[cycle.data];
        const periodEnd = addCalendarMonths({
            from: row.periodStart,
            months,
            dayOverflow: 'clamp'
        });
        if (row.periodStart <= input.now && periodEnd > input.now)
            return computeSuccessorCreditDays({
                paidAmountMinor: row.amount,
                periodStart: row.periodStart,
                periodEnd,
                now: input.now,
                targetAmountMinor: input.targetAmountMinor,
                targetCycle: input.targetCycle
            });
    }
    return { creditDays: 0, unusedMinor: 0 };
}

/** Reads the complete queued change for collision handling. */
export async function readScheduledPlanChange(input: { readonly subscriptionId: string }) {
    const [row] = await getDb()
        .select()
        .from(subscriptionScheduledChanges)
        .where(eq(subscriptionScheduledChanges.subscriptionId, input.subscriptionId))
        .limit(1);
    return row ?? null;
}

/** Writes the downgrade's queue and ends its promo in one local transaction. */
export async function queueDowngrade(input: {
    readonly subscriptionId: string;
    readonly targetPlanVersionId: string;
    readonly targetBillingOptionId: string;
    readonly effectiveAt: Date;
    readonly keepSelection?: Record<string, string[]>;
}): Promise<void> {
    await getDb().transaction(async (tx) => {
        await tx
            .insert(subscriptionScheduledChanges)
            .values({ ...input, keepSelection: input.keepSelection ?? null });
        await tx
            .update(promoRedemptions)
            .set({ remainingCharges: 0 })
            .where(eq(promoRedemptions.subscriptionId, input.subscriptionId));
    });
}

/** Mutates a provider authorization to a persisted list price and confirms the result. */
export async function mutatePlanChangeAmount(input: {
    readonly authorizationId: string;
    readonly amount: { readonly amountMinor: number; readonly currency: string };
    readonly clock: Clock;
    readonly provider: PaymentProvider;
}): Promise<void> {
    const act = { kind: 'decision' as const, startedAt: input.clock.now() };
    actStartInstant({ act });
    const acknowledgement = await input.provider.changeAmount({
        authorizationId: input.authorizationId,
        amount: input.amount
    });
    const confirmation = await confirmAuthorizationMutation({
        provider: input.provider,
        acknowledgement,
        sent: { amount: input.amount }
    });
    assertFreshForAct({ read: confirmation.read, act }).snapshot;
    if (confirmation.outcome !== 'applied')
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Provider did not apply plan amount',
            undefined,
            'PLAN_CHANGE_MUTATION_NOT_APPLIED'
        );
}

/** Replaces a customer downgrade only while its source row and old queue remain current. */
export async function replaceQueuedDowngrade(input: {
    readonly subscriptionId: string;
    readonly expectedQueueId: string;
    readonly sourcePlanVersionId: string;
    readonly sourceBillingOptionId: string;
    readonly targetPlanVersionId: string;
    readonly targetBillingOptionId: string;
    readonly effectiveAt: Date;
    readonly keepSelection?: Record<string, string[]>;
}): Promise<void> {
    await getDb().transaction(async (tx) => {
        const [subscription] = await tx
            .select({
                status: subscriptions.status,
                planVersionId: subscriptions.planVersionId,
                billingOptionId: subscriptions.billingOptionId
            })
            .from(subscriptions)
            .where(eq(subscriptions.id, input.subscriptionId))
            .limit(1)
            .for('update');
        const [queued] = await tx
            .select({
                id: subscriptionScheduledChanges.id,
                planMigrationSubscriptionId:
                    subscriptionScheduledChanges.planMigrationSubscriptionId
            })
            .from(subscriptionScheduledChanges)
            .where(eq(subscriptionScheduledChanges.subscriptionId, input.subscriptionId))
            .limit(1);
        if (
            subscription?.status !== 'ACTIVE' ||
            subscription.planVersionId !== input.sourcePlanVersionId ||
            subscription.billingOptionId !== input.sourceBillingOptionId ||
            queued?.id !== input.expectedQueueId ||
            queued.planMigrationSubscriptionId
        )
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Plan change state changed',
                undefined,
                'PLAN_CHANGE_STATE_CHANGED'
            );
        await tx
            .delete(subscriptionScheduledChanges)
            .where(eq(subscriptionScheduledChanges.id, queued.id));
        await tx.insert(subscriptionScheduledChanges).values({
            subscriptionId: input.subscriptionId,
            targetPlanVersionId: input.targetPlanVersionId,
            targetBillingOptionId: input.targetBillingOptionId,
            effectiveAt: input.effectiveAt,
            keepSelection: input.keepSelection ?? null
        });
        await tx
            .update(promoRedemptions)
            .set({ remainingCharges: 0 })
            .where(eq(promoRedemptions.subscriptionId, input.subscriptionId));
    });
}

/** Cancels a customer's queued downgrade only while its source row and queue remain current. */
export async function removeQueuedDowngrade(input: {
    readonly subscriptionId: string;
    readonly expectedQueueId: string;
    readonly sourcePlanVersionId: string;
    readonly sourceBillingOptionId: string;
}): Promise<void> {
    await getDb().transaction(async (tx) => {
        const [subscription] = await tx
            .select({
                status: subscriptions.status,
                planVersionId: subscriptions.planVersionId,
                billingOptionId: subscriptions.billingOptionId
            })
            .from(subscriptions)
            .where(eq(subscriptions.id, input.subscriptionId))
            .limit(1)
            .for('update');
        const [queued] = await tx
            .select({ id: subscriptionScheduledChanges.id })
            .from(subscriptionScheduledChanges)
            .where(eq(subscriptionScheduledChanges.subscriptionId, input.subscriptionId))
            .limit(1);
        if (
            subscription?.status !== 'ACTIVE' ||
            subscription.planVersionId !== input.sourcePlanVersionId ||
            subscription.billingOptionId !== input.sourceBillingOptionId ||
            queued?.id !== input.expectedQueueId
        )
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Plan change state changed',
                undefined,
                'PLAN_CHANGE_STATE_CHANGED'
            );
        await tx
            .delete(subscriptionScheduledChanges)
            .where(eq(subscriptionScheduledChanges.id, queued.id));
    });
}
