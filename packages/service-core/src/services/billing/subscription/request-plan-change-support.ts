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

/** Checks whether the subscription already owns a queued entitlement change. */
export async function hasScheduledPlanChange(input: {
    readonly subscriptionId: string;
}): Promise<boolean> {
    const [row] = await getDb()
        .select({ id: subscriptionScheduledChanges.id })
        .from(subscriptionScheduledChanges)
        .where(eq(subscriptionScheduledChanges.subscriptionId, input.subscriptionId))
        .limit(1);
    return Boolean(row);
}

/** Writes the downgrade's queue and ends its promo in one local transaction. */
export async function queueDowngrade(input: {
    readonly subscriptionId: string;
    readonly targetPlanVersionId: string;
    readonly targetBillingOptionId: string;
    readonly effectiveAt: Date;
}): Promise<void> {
    await getDb().transaction(async (tx) => {
        await tx.insert(subscriptionScheduledChanges).values(input);
        await tx
            .update(promoRedemptions)
            .set({ remainingCharges: 0 })
            .where(eq(promoRedemptions.subscriptionId, input.subscriptionId));
    });
}
