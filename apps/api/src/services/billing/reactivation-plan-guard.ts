/**
 * Reactivation plan resolution + validation guard (HOS-114 T-004, extended
 * to support the annual interval by HOS-123 T-003).
 *
 * Both `TrialService.reactivateFromTrial` and `TrialService.reactivateSubscription`
 * accept a caller-supplied `planId` with, historically, zero validation: no
 * catalog check, no paid-plan restriction, no interval check
 * (`apps/api/src/routes/billing/trial.ts` request schemas are a bare
 * `z.string().min(1)`). This module is the shared first step both reactivate
 * methods call to close that gap (HOS-114 spec §6.1).
 *
 * **Identifier space (HOS-114 T-004 — resolved, do not re-litigate)**:
 * reactivation's `planId` is a **UUID** matching `billing_plans.id`, NOT a
 * slug. Evidence:
 *   - `apps/e2e/tests/host/host-02-trial-upgrade-mp.spec.ts:87-107` selects
 *     `bp.id` directly from `billing_plans` via raw SQL and posts it verbatim
 *     as `{ planId: targetPaidPlanId }` to `POST /billing/trial/reactivate`.
 *   - `paid-subscription-create.ts`'s own JSDoc calls reactivation the
 *     "UUID-keyed caller" as opposed to checkout's "slug-keyed caller"
 *     (`resolvePlanBySlug`, which matches `QZPayPlan.name`).
 * This guard therefore resolves by `plan.id === planId`, mirroring
 * `resolvePlanBySlug` in `subscription-checkout.service.ts` but keyed on id
 * instead of name. It intentionally does NOT import that sibling module —
 * `subscription-checkout.service.ts` already imports `TrialService`
 * (`trial.service.ts`), and `trial.service.ts` is this guard's only caller,
 * so importing back would recreate the circular ESM import that
 * `subscription-checkout-error.ts` and `paid-subscription-create.ts` were
 * already extracted to avoid (see their module JSDoc). The small
 * `findMonthlyPrice`/`findAnnualPrice`-equivalent lookups below are
 * intentionally duplicated rather than shared, for the same reason.
 *
 * **Annual interval (HOS-123 T-003 — resolved)**: `ANNUAL_REACTIVATION_UNSUPPORTED`
 * was originally a permanent dead-end for any plan whose only recurring
 * price was annual, with a "deferred to HOS-123" note on both the error
 * message and this module's JSDoc. That deferral is now closed: passing
 * `billingInterval: 'annual'` resolves the plan's annual price instead
 * (see {@link resolveReactivationPlan}'s own JSDoc for the full annual
 * validation order). `ANNUAL_REACTIVATION_UNSUPPORTED` remains a live error
 * code for exactly one case — a monthly reactivation request
 * (`billingInterval` omitted or `'monthly'`) hitting a plan with no active
 * monthly price — not a placeholder for missing functionality anymore.
 *
 * @module services/billing/reactivation-plan-guard
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { SubscriptionCheckoutError } from './subscription-checkout-error.js';

/**
 * Plan object shape as returned by `billing.plans.list()`, inferred directly
 * from the QZPay client type so this module can never fall out of sync with
 * the SDK's real return shape.
 */
type ReactivationBillingPlan = Awaited<ReturnType<QZPayBilling['plans']['list']>>['data'][number];

/**
 * A single price row on a {@link ReactivationBillingPlan} (`plan.prices[]`).
 */
type ReactivationBillingPrice = ReactivationBillingPlan['prices'][number];

/**
 * Resolve the monthly price within a plan's price list — mirrors
 * `findMonthlyPrice` in `subscription-checkout.service.ts` (`billingInterval
 * === 'month'`, `intervalCount === 1`, `active === true`). Multi-month
 * variants (quarterly, semi-annual) share the `'month'` interval with a
 * different `intervalCount` and are deliberately excluded — they belong to
 * plan-change flows, not reactivation.
 */
function findMonthlyPrice(
    prices: ReadonlyArray<ReactivationBillingPrice>
): ReactivationBillingPrice | null {
    return (
        prices.find(
            (price) =>
                price.active && price.billingInterval === 'month' && price.intervalCount === 1
        ) ?? null
    );
}

/**
 * Resolve the annual price within a plan's price list — mirrors
 * `findAnnualPrice` in `subscription-checkout.service.ts` (`billingInterval
 * === 'year'`, `intervalCount === 1`, `active === true`). See the module
 * JSDoc for why this is a local duplicate rather than an import.
 */
function findAnnualPrice(
    prices: ReadonlyArray<ReactivationBillingPrice>
): ReactivationBillingPrice | null {
    return (
        prices.find(
            (price) => price.active && price.billingInterval === 'year' && price.intervalCount === 1
        ) ?? null
    );
}

/**
 * Billing interval a reactivation request may target. Mirrors the interval
 * vocabulary used by the paid-subscription checkout flows
 * (`subscription-checkout.service.ts`), narrowed to the two intervals
 * reactivation supports.
 */
export type ReactivationBillingInterval = 'monthly' | 'annual';

/**
 * Input for {@link resolveReactivationPlan}.
 */
export interface ResolveReactivationPlanInput {
    /** Resolved qzpay billing client. */
    readonly billing: QZPayBilling;
    /** Raw, unvalidated `planId` supplied by the reactivate request body. */
    readonly planId: string;
    /**
     * Billing interval the reactivation targets. Defaults to `'monthly'`
     * within this function for testability — the actual call-site default
     * (when the request body omits it) is applied by the caller
     * (`TrialService`), not here.
     */
    readonly billingInterval?: ReactivationBillingInterval;
}

/**
 * Result of a successful {@link resolveReactivationPlan} call.
 */
export interface ResolveReactivationPlanResult {
    /** The resolved plan (matched by `plan.id === planId`). */
    readonly plan: ReactivationBillingPlan;
    /** The plan's active price id for the resolved interval, ready to pass to `createPaidSubscription`. */
    readonly priceId: string;
    /** The interval the resolved `priceId` belongs to. */
    readonly interval: ReactivationBillingInterval;
}

/**
 * Resolve and validate a reactivation `planId` against the live plan
 * catalog, fail-closed on every invalid target (HOS-114 spec §6.1 / AC-6).
 * Extended by HOS-123 to also resolve the annual interval via
 * `billingInterval: 'annual'`.
 *
 * Validation order — **monthly** (`billingInterval` omitted or `'monthly'`,
 * unchanged since HOS-114):
 * 1. Unknown `planId` (no match in `billing.plans.list()`) → throws
 *    `PLAN_NOT_FOUND`.
 * 2. Plan has no active monthly price (annual-only plan, e.g. a plan whose
 *    only recurring price is `billingInterval: 'year'`, requested without
 *    `billingInterval: 'annual'`) → throws `ANNUAL_REACTIVATION_UNSUPPORTED`.
 *    This is the "monthly reactivation requested against an annual-only
 *    plan" case — use `billingInterval: 'annual'` instead.
 * 3. Plan's monthly price is `unitAmount === 0` (a free plan, e.g.
 *    `TOURIST_FREE_PLAN`) → throws `INVALID_REACTIVATION_PLAN`. Reactivation
 *    is only meaningful onto a paid plan (spec OQ-2 — the prior "free branch"
 *    is dropped as dead/unguarded code, not preserved).
 *
 * Validation order — **annual** (`billingInterval: 'annual'`, HOS-123):
 * 1. Unknown `planId` → throws `PLAN_NOT_FOUND` (same as monthly).
 * 2. Plan has no active annual price → throws `NO_ANNUAL_PRICE` — the same
 *    `SubscriptionCheckoutError` code `initiatePaidAnnualSubscription`
 *    (`subscription-checkout.service.ts`) already uses for the equivalent
 *    checkout-time condition, reused here for consistency across both
 *    callers.
 * 3. Plan's annual price is `unitAmount === 0` → throws
 *    `INVALID_REACTIVATION_PLAN` (same code as the monthly free-plan case).
 *
 * No subscription is created by this function — it only resolves and
 * validates. Callers (the two `TrialService` reactivate methods) run this as
 * their first step, before touching the customer or any existing
 * subscription.
 *
 * @param input - Billing client, raw `planId`, and optional `billingInterval`.
 * @returns The resolved plan, its price id for the resolved interval, and
 *   the interval itself.
 * @throws SubscriptionCheckoutError With code `PLAN_NOT_FOUND`,
 *   `ANNUAL_REACTIVATION_UNSUPPORTED`, `NO_ANNUAL_PRICE`, or
 *   `INVALID_REACTIVATION_PLAN`.
 *
 * @example
 * ```ts
 * const { plan, priceId, interval } = await resolveReactivationPlan({
 *   billing,
 *   planId,
 *   billingInterval: 'annual'
 * });
 * const { subscription, checkoutUrl } = await createPaidSubscription({
 *   billing,
 *   customerId,
 *   planId: plan.id,
 *   priceId,
 *   paymentMethodReturnUrl,
 *   notificationUrl
 * });
 * ```
 */
export async function resolveReactivationPlan(
    input: ResolveReactivationPlanInput
): Promise<ResolveReactivationPlanResult> {
    const { billing, planId, billingInterval = 'monthly' } = input;

    const plansResult = await billing.plans.list();
    const plan = plansResult.data.find((candidate) => candidate.id === planId) ?? null;

    if (!plan) {
        throw new SubscriptionCheckoutError(
            'PLAN_NOT_FOUND',
            `Reactivation target plan not found: '${planId}'`
        );
    }

    if (billingInterval === 'annual') {
        const annualPrice = findAnnualPrice(plan.prices);
        if (!annualPrice) {
            throw new SubscriptionCheckoutError(
                'NO_ANNUAL_PRICE',
                `Plan '${planId}' has no active annual price`
            );
        }

        if (annualPrice.unitAmount === 0) {
            throw new SubscriptionCheckoutError(
                'INVALID_REACTIVATION_PLAN',
                `Plan '${planId}' is a free plan — reactivation requires a paid plan`
            );
        }

        return { plan, priceId: annualPrice.id, interval: 'annual' };
    }

    const monthlyPrice = findMonthlyPrice(plan.prices);
    if (!monthlyPrice) {
        throw new SubscriptionCheckoutError(
            'ANNUAL_REACTIVATION_UNSUPPORTED',
            `Plan '${planId}' has no active monthly price — annual reactivation is not supported (deferred to HOS-123)`
        );
    }

    if (monthlyPrice.unitAmount === 0) {
        throw new SubscriptionCheckoutError(
            'INVALID_REACTIVATION_PLAN',
            `Plan '${planId}' is a free plan — reactivation requires a paid plan`
        );
    }

    return { plan, priceId: monthlyPrice.id, interval: 'monthly' };
}
