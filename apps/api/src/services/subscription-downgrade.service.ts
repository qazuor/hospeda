/**
 * Subscription Downgrade Scheduling Service (SPEC-141 D7).
 *
 * Schedules a plan downgrade to take effect at the end of the current
 * billing period. The actual mutation is committed by the
 * `apply-scheduled-plan-changes` cron job when `applyAt` is reached
 * — NOT synchronously by this service.
 *
 * Storage lives in qzpay-core's `QZPaySubscription.scheduledPlanChange`
 * field (added in qzpay 1.6.0 / drizzle 1.7.0). qzpay provides the
 * shape and storage primitive only; Hospeda owns scheduling logic and
 * cron lifecycle.
 *
 * @module services/subscription-downgrade.service
 */

import type {
    QZPayBilling,
    QZPayScheduledPlanChange,
    QZPaySubscriptionWithHelpers
} from '@qazuor/qzpay-core';

/**
 * Discriminated error codes surfaced by
 * {@link scheduleSubscriptionDowngrade}. Distinct from
 * `SubscriptionCheckoutError` because the failure modes are slightly
 * different (no checkout creation, no customer lookup) and grouping
 * them would force the consumer mapper to expand its switch.
 */
export type SubscriptionDowngradeErrorCode =
    | 'SUBSCRIPTION_NOT_FOUND'
    | 'PLAN_NOT_FOUND'
    | 'NO_MATCHING_PRICE'
    | 'SAME_PLAN'
    | 'NOT_A_DOWNGRADE';

/**
 * Domain-level error thrown by
 * {@link scheduleSubscriptionDowngrade}. Carries a discriminated
 * `code` so the route handler can map each variant to its own HTTP
 * status without parsing `message`.
 */
export class SubscriptionDowngradeError extends Error {
    constructor(
        public readonly code: SubscriptionDowngradeErrorCode,
        message: string
    ) {
        super(message);
        this.name = 'SubscriptionDowngradeError';
    }
}

export interface ScheduleSubscriptionDowngradeInput {
    /** Local subscription id being downgraded. */
    readonly currentSubscriptionId: string;
    /** Target plan id the subscription should move to. */
    readonly newPlanId: string;
    /**
     * Billing interval the downgrade keeps using. Matches qzpay-core's
     * enum (`'month'` / `'year'`); the route maps from the public
     * `BillingIntervalEnum` before calling.
     */
    readonly billingInterval: 'month' | 'year';
    /** Interval count (1 for monthly, 3 for quarterly, etc.). */
    readonly intervalCount: number;
    /** Resolved qzpay billing instance. */
    readonly billing: QZPayBilling;
    /** Optional user id of the actor that requested the downgrade. */
    readonly requestedBy?: string;
    /** Clock override for tests (otherwise `new Date()`). */
    readonly now?: Date;
}

export interface ScheduleSubscriptionDowngradeResult {
    readonly subscriptionId: string;
    readonly previousPlanId: string;
    readonly newPlanId: string;
    /** ISO 8601 timestamp when the change will fire (= currentPeriodEnd). */
    readonly applyAt: string;
    /**
     * True when a prior pending schedule was overwritten by this call.
     * Useful for the route to emit a distinct log line / response
     * variant when the user replaces an existing scheduled downgrade.
     */
    readonly replacedPriorSchedule: boolean;
}

interface PriceShape {
    id: string;
    billingInterval: string;
    intervalCount?: number | null;
    unitAmount: number;
    active: boolean;
}

function findPriceForInterval<T extends PriceShape>(
    prices: ReadonlyArray<T>,
    billingInterval: string,
    intervalCount: number
): T | null {
    return (
        prices.find(
            (p) =>
                p.active &&
                p.billingInterval === billingInterval &&
                (p.intervalCount ?? 1) === intervalCount
        ) ?? null
    );
}

/**
 * Normalize a price's unit amount to a per-interval-unit rate.
 *
 * Multi-month prices store the total amount for the whole billing period
 * (e.g. a quarterly plan stores 3 months' worth). To compare two prices
 * across different interval counts the amount must be divided by
 * `intervalCount` first — otherwise a "6-month at $600" plan looks more
 * expensive than a "1-month at $120" plan even though the per-month rate
 * ($100 vs $120) makes it a genuine downgrade.
 *
 * Mirrors the normalization in `apps/api/src/routes/billing/plan-change.ts`
 * (lines 270-274).
 *
 * @param price - Price shape with `unitAmount` and optional `intervalCount`
 * @returns Per-interval-unit amount (unitAmount / intervalCount)
 */
function normalizedUnitAmount(price: PriceShape): number {
    // Guard: intervalCount <= 0 is invalid (would divide by zero or produce
    // a negative/infinite per-unit amount). Treat as 1 to match the
    // price-per-cycle semantics (item 9a / SPEC-194 adversarial review).
    const rawCount = price.intervalCount ?? 1;
    const count = rawCount > 0 ? rawCount : 1;
    return price.unitAmount / count;
}

/**
 * Schedule a plan downgrade to apply at the end of the current
 * billing period.
 *
 * Idempotent: if the subscription already has a pending scheduled
 * change, this call REPLACES it (the user's latest decision wins).
 * The `replacedPriorSchedule` flag on the result indicates whether
 * that happened. Existing scheduled changes with status `applied` /
 * `cancelled` / `failed` are left intact in the metadata audit
 * trail (qzpay stores the latest schedule only, so we surface the
 * replacement signal here for the caller's logs).
 *
 * The actual plan mutation happens later via the
 * `apply-scheduled-plan-changes` cron when `applyAt` is reached.
 *
 * @throws SubscriptionDowngradeError When any precondition fails.
 */
export async function scheduleSubscriptionDowngrade(
    input: ScheduleSubscriptionDowngradeInput
): Promise<ScheduleSubscriptionDowngradeResult> {
    const {
        currentSubscriptionId,
        newPlanId,
        billingInterval,
        intervalCount,
        billing,
        requestedBy
    } = input;
    const now = input.now ?? new Date();

    const sub: QZPaySubscriptionWithHelpers | null =
        await billing.subscriptions.get(currentSubscriptionId);
    if (!sub) {
        throw new SubscriptionDowngradeError(
            'SUBSCRIPTION_NOT_FOUND',
            `Subscription '${currentSubscriptionId}' not found`
        );
    }

    // SAME_PLAN is true ONLY when both the plan id AND the billing
    // interval+count match the user's current subscription. Allowing the
    // same plan with a different interval enables cycle change flows
    // (annual → monthly on the same tier, scheduled-at-period-end) —
    // see SPEC-143 T-143-61.
    const currentInterval = sub.interval;
    const currentIntervalCount = sub.intervalCount ?? 1;
    const isSamePlan = sub.planId === newPlanId;
    const isSameInterval =
        currentInterval === billingInterval && currentIntervalCount === intervalCount;
    if (isSamePlan && isSameInterval) {
        throw new SubscriptionDowngradeError(
            'SAME_PLAN',
            'Cannot downgrade to the same plan with the same billing interval'
        );
    }

    const [currentPlan, targetPlan] = await Promise.all([
        billing.plans.get(sub.planId),
        billing.plans.get(newPlanId)
    ]);

    if (!currentPlan) {
        throw new SubscriptionDowngradeError(
            'PLAN_NOT_FOUND',
            `Current plan '${sub.planId}' not found`
        );
    }
    if (!targetPlan) {
        throw new SubscriptionDowngradeError(
            'PLAN_NOT_FOUND',
            `Target plan '${newPlanId}' not found`
        );
    }

    // currentPrice MUST be resolved against the user's CURRENT
    // subscription interval — otherwise cycle change flows
    // (annual $1000 → monthly $100 same plan) compare two identical
    // prices (both annual) and incorrectly throw NOT_A_DOWNGRADE. The
    // target price keeps using the REQUESTED interval since that is
    // what the user will be billed for after the schedule applies.
    const currentPrice = findPriceForInterval(
        currentPlan.prices,
        currentInterval,
        currentIntervalCount
    );
    const targetPrice = findPriceForInterval(targetPlan.prices, billingInterval, intervalCount);

    if (!currentPrice) {
        throw new SubscriptionDowngradeError(
            'NO_MATCHING_PRICE',
            `Current plan has no active price for the subscription's current interval '${currentInterval}'/${currentIntervalCount}`
        );
    }
    if (!targetPrice) {
        throw new SubscriptionDowngradeError(
            'NO_MATCHING_PRICE',
            `Target plan has no active price for interval '${billingInterval}'/${intervalCount}`
        );
    }

    // Defensive: refuse to schedule a non-downgrade. The route should
    // already have routed upgrades into the checkout flow, but if the
    // caller short-circuits or the prices changed mid-flight, surface
    // the mismatch instead of silently scheduling a "downgrade" that
    // would charge MORE per cycle.
    //
    // Normalize by intervalCount (T-017) so multi-month prices are
    // comparable on a per-interval-unit basis — mirrors the same
    // normalization in the plan-change route handler. Without this,
    // an annual→monthly same-tier cycle change (total annual > total
    // monthly) would be rejected as NOT_A_DOWNGRADE even though the
    // normalized monthly rate is lower.
    const normalizedCurrentAmount = normalizedUnitAmount(currentPrice);
    const normalizedTargetAmount = normalizedUnitAmount(targetPrice);
    if (normalizedTargetAmount >= normalizedCurrentAmount) {
        throw new SubscriptionDowngradeError(
            'NOT_A_DOWNGRADE',
            `Target price (${normalizedTargetAmount}/interval) is not lower than current (${normalizedCurrentAmount}/interval) — downgrade scheduling requires a strictly cheaper plan`
        );
    }

    const replacedPriorSchedule = sub.scheduledPlanChange?.status === 'pending';

    // qzpay-core's transactionAmount expects MAJOR units (e.g. ARS),
    // and our prices are stored in centavos. The cron forwards this
    // value directly to paymentAdapter.subscriptions.update, so we
    // pre-convert it here once instead of every cron tick.
    const targetTransactionAmountMajor = targetPrice.unitAmount / 100;

    const scheduled: QZPayScheduledPlanChange = {
        newPlanId,
        newPriceId: targetPrice.id,
        targetTransactionAmountMajor,
        applyAt: sub.currentPeriodEnd.toISOString(),
        requestedAt: now.toISOString(),
        ...(requestedBy !== undefined ? { requestedBy } : {}),
        status: 'pending',
        attemptCount: 0,
        metadata: {
            source: 'plan-change-downgrade',
            previousPlanId: sub.planId
        }
    };

    await billing.subscriptions.update(currentSubscriptionId, {
        scheduledPlanChange: scheduled
    });

    return {
        subscriptionId: currentSubscriptionId,
        previousPlanId: sub.planId,
        newPlanId,
        applyAt: scheduled.applyAt,
        replacedPriorSchedule
    };
}

/**
 * Clear any pending scheduled plan change attached to a subscription.
 *
 * Used after a different plan change applies before the schedule
 * fires (e.g. user upgrades mid-period — Fase 3 D7 upgrade — so the
 * earlier-queued downgrade becomes meaningless), and as the
 * cancel-by-user surface when we expose that in the UI later. Safe
 * to call when no pending schedule exists (no-op).
 *
 * Updates qzpay's `scheduledPlanChange` to `null` via the
 * partial-update slot.
 */
export async function clearPendingScheduledPlanChange(
    billing: QZPayBilling,
    subscriptionId: string
): Promise<{ cleared: boolean }> {
    const sub = await billing.subscriptions.get(subscriptionId);
    if (!sub) {
        return { cleared: false };
    }
    if (sub.scheduledPlanChange === null || sub.scheduledPlanChange.status !== 'pending') {
        return { cleared: false };
    }
    await billing.subscriptions.update(subscriptionId, { scheduledPlanChange: null });
    return { cleared: true };
}

/**
 * Test-only exports for unit-testing helpers without a full billing
 * mock.
 */
export const _internals = {
    findPriceForInterval,
    normalizedUnitAmount
};
