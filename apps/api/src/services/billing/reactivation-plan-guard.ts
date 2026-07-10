/**
 * Reactivation plan resolution + validation guard (HOS-114 T-004).
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
 * `findMonthlyPrice`-equivalent lookup below is intentionally duplicated
 * rather than shared, for the same reason.
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
 * Input for {@link resolveReactivationPlan}.
 */
export interface ResolveReactivationPlanInput {
    /** Resolved qzpay billing client. */
    readonly billing: QZPayBilling;
    /** Raw, unvalidated `planId` supplied by the reactivate request body. */
    readonly planId: string;
}

/**
 * Result of a successful {@link resolveReactivationPlan} call.
 */
export interface ResolveReactivationPlanResult {
    /** The resolved plan (matched by `plan.id === planId`). */
    readonly plan: ReactivationBillingPlan;
    /** The plan's active monthly price id, ready to pass to `createPaidSubscription`. */
    readonly priceId: string;
}

/**
 * Resolve and validate a reactivation `planId` against the live plan
 * catalog, fail-closed on every invalid target (HOS-114 spec §6.1 / AC-6).
 *
 * Validation order:
 * 1. Unknown `planId` (no match in `billing.plans.list()`) → throws
 *    `PLAN_NOT_FOUND`.
 * 2. Plan has no active monthly price (annual-only plan, e.g. a plan whose
 *    only recurring price is `billingInterval: 'year'`) → throws
 *    `ANNUAL_REACTIVATION_UNSUPPORTED`. Annual reactivation is architecturally
 *    incompatible with `billing.subscriptions.create()` and is deferred to
 *    HOS-123 (spec OQ-5).
 * 3. Plan's monthly price is `unitAmount === 0` (a free plan, e.g.
 *    `TOURIST_FREE_PLAN`) → throws `INVALID_REACTIVATION_PLAN`. Reactivation
 *    is only meaningful onto a paid plan (spec OQ-2 — the prior "free branch"
 *    is dropped as dead/unguarded code, not preserved).
 *
 * No subscription is created by this function — it only resolves and
 * validates. Callers (the two `TrialService` reactivate methods) run this as
 * their first step, before touching the customer or any existing
 * subscription.
 *
 * @param input - Billing client + raw `planId`.
 * @returns The resolved plan and its monthly price id.
 * @throws SubscriptionCheckoutError With code `PLAN_NOT_FOUND`,
 *   `ANNUAL_REACTIVATION_UNSUPPORTED`, or `INVALID_REACTIVATION_PLAN`.
 *
 * @example
 * ```ts
 * const { plan, priceId } = await resolveReactivationPlan({ billing, planId });
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
    const { billing, planId } = input;

    const plansResult = await billing.plans.list();
    const plan = plansResult.data.find((candidate) => candidate.id === planId) ?? null;

    if (!plan) {
        throw new SubscriptionCheckoutError(
            'PLAN_NOT_FOUND',
            `Reactivation target plan not found: '${planId}'`
        );
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

    return { plan, priceId: monthlyPrice.id };
}
