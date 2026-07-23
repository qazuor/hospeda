/**
 * Subscription Charge Reconciliation (accounting defense — HOS-171 §7.5)
 *
 * Detects when a recurring subscription charge lands for an amount we did not
 * ask for.
 *
 * ## The risk
 *
 * MercadoPago has a merchant discount-campaign engine in its seller panel
 * (Configuración → Negocio → Ofrecer Descuentos): percentage or fixed, date
 * range, optionally code-gated. It is configured at **account level** — not per
 * product, not per checkout — and the merchant absorbs the cost. A campaign
 * created for an unrelated marketing push on the same MercadoPago account can
 * therefore apply to a subscription charge, and the money simply arrives lower
 * than the plan says.
 *
 * Nothing defends against that today: reconciliation, dunning and the promo
 * engine all assume `charged == plan price` (or plan price with *our* promo
 * applied). The engine lives entirely outside the Subscriptions API — panel
 * only, no endpoints — so we cannot enumerate campaigns and rule it out. The
 * only thing we can do is notice.
 *
 * ## Why `coupon_amount` / `campaign_id` are the signal, and the amount is not
 *
 * The obvious check — "compare the charge against the plan price and alert on
 * any mismatch" — is a false-positive generator. A charge can legitimately
 * differ from the plan's headline price because:
 *
 * - **our own promo engine** deliberately lowered the preapproval amount for N
 *   cycles (SPEC-262), so a discounted charge is correct and expected;
 * - the subscription is **annual**, so the charge is ~12× a monthly price row;
 * - a **plan change** applied mid-cycle.
 *
 * An alert that fires on all of those trains the team to ignore it, which is
 * worse than no alert. `coupon_amount` and `campaign_id`, by contrast, are
 * fields **we never set on any call path**. MercadoPago populates them only when
 * *its* campaign engine touched the charge. Their presence is therefore proof of
 * external interference with zero false positives, which is exactly the risk
 * this defense exists for.
 *
 * The expected amount, when the caller can resolve one, travels in the report as
 * context — how much was lost — rather than as the trigger.
 *
 * ## Never fail-closed
 *
 * A detection must alert, never reject the charge. Refusing money because our
 * expectation is stale is a worse failure than a logged discrepancy: the
 * customer's card was already debited and MercadoPago considers the matter
 * settled. Contrast the signup-discount path, which *is* fail-closed — there we
 * are the ones mutating the amount, so a mismatch means our own bug.
 *
 * @module services/subscription-charge-reconcile
 */

import { type getDb, sql } from '@repo/db';
import { createLogger } from '@repo/logger';
import { calculatePromoCodeEffect } from '../promo-code/effect-reducer.js';
import { getPromoCodeById } from '../promo-code/promo-code.crud.js';
import { loadSubscriptionDiscountState } from './subscription-product-domain.js';

/**
 * Module logger. Service-core MUST NOT import `@sentry/node` directly (it pulls
 * `@sentry/opentelemetry`, absent from service-core's dependency tree). The
 * apps/api log transport forwards `{ capture: true }` ERROR logs to Sentry, so
 * that flag is the in-package equivalent of the cron's `Sentry.captureException`.
 */
const log = createLogger('service-core:billing:charge-reconcile');

/**
 * Input for {@link detectExternalChargeInterference}.
 */
export interface DetectExternalChargeInterferenceInput {
    /**
     * `coupon_amount` from the MercadoPago payment, in MAJOR units. Non-null and
     * greater than zero means MP's campaign engine discounted the charge. We
     * never set this field.
     */
    readonly couponAmount: number | null;
    /**
     * `campaign_id` from the MercadoPago payment. Non-null means the charge was
     * matched by one of the account's discount campaigns. We never set this
     * field either.
     */
    readonly campaignId: string | null;
    /** What MercadoPago actually charged, in centavos. */
    readonly chargedAmountCentavos: number;
    /**
     * What we believed the charge should be, in centavos, when the caller could
     * resolve it. Carried as context only — see the module docs on why this is
     * not the trigger. `null` when unresolvable.
     */
    readonly expectedAmountCentavos: number | null;
}

/**
 * A charge that MercadoPago's campaign engine altered behind our back.
 */
export interface ExternalChargeInterference {
    /** What MercadoPago actually charged, in centavos. */
    readonly chargedAmountCentavos: number;
    /** What we expected, in centavos, or `null` when it could not be resolved. */
    readonly expectedAmountCentavos: number | null;
    /**
     * `expected - charged`, in centavos, when both are known. Positive means we
     * were paid less than expected. `null` when there is no expectation to
     * compare against.
     */
    readonly shortfallCentavos: number | null;
    /** The discount MercadoPago applied, in centavos, when it reported one. */
    readonly couponAmountCentavos: number | null;
    /** The MercadoPago campaign that matched, when it reported one. */
    readonly campaignId: string | null;
}

/**
 * Detects whether MercadoPago applied one of its own discount campaigns to a
 * subscription charge.
 *
 * Pure and I/O-free. Returns `null` when the charge is clean — which is the
 * overwhelmingly common case, since this only fires if the account actually has
 * a campaign configured.
 *
 * @param input - The MercadoPago coupon/campaign fields plus the charged and
 *   (optionally) expected amounts.
 * @returns The interference details to alert on, or `null` when the charge shows
 *   no sign of external interference.
 *
 * @example
 * ```ts
 * // A clean charge — the overwhelmingly common case
 * detectExternalChargeInterference({
 *   couponAmount: null,
 *   campaignId: null,
 *   chargedAmountCentavos: 1_500_000,
 *   expectedAmountCentavos: 1_500_000,
 * }); // => null
 *
 * // An account-level campaign silently took ARS 500 off
 * detectExternalChargeInterference({
 *   couponAmount: 500,
 *   campaignId: 'campaign-abc',
 *   chargedAmountCentavos: 1_450_000,
 *   expectedAmountCentavos: 1_500_000,
 * }); // => { shortfallCentavos: 50_000, campaignId: 'campaign-abc', ... }
 * ```
 */
export function detectExternalChargeInterference(
    input: DetectExternalChargeInterferenceInput
): ExternalChargeInterference | null {
    const { couponAmount, campaignId, chargedAmountCentavos, expectedAmountCentavos } = input;

    const hasCoupon = couponAmount !== null && couponAmount > 0;
    const hasCampaign = campaignId !== null && campaignId.length > 0;

    if (!hasCoupon && !hasCampaign) {
        return null;
    }

    return {
        chargedAmountCentavos,
        expectedAmountCentavos,
        shortfallCentavos:
            expectedAmountCentavos === null ? null : expectedAmountCentavos - chargedAmountCentavos,
        couponAmountCentavos: hasCoupon ? Math.round((couponAmount as number) * 100) : null,
        campaignId: hasCampaign ? campaignId : null
    };
}

// ---------------------------------------------------------------------------
// Plan-price divergence detector (HOS-176 §silent-divergence)
//
// Sibling to the campaign-interference defense above, for the OTHER way a
// recurring charge can diverge from the current plan price: MercadoPago charging
// an amount that differs from what the plan says for a reason that is NOT one of
// MP's own discount campaigns (`coupon_amount` / `campaign_id` absent) — e.g. a
// price change whose propagation failed, or a stale/lagging preapproval that the
// propagate-plan-price-changes cron never re-priced. `detectExternalChargeInterference`
// cannot catch that (it only fires on MP-reported campaigns), so this detector
// covers the silent case, with the same never-fail-closed philosophy: the charge
// already settled; we alert, we never reject.
// ---------------------------------------------------------------------------

/**
 * The interval vocabulary all three billing tables share. `billing_subscriptions`,
 * `billing_plan_price_changes` AND `billing_prices` all store `'month' | 'year'`
 * (the qzpay-core enum values); the `'monthly' | 'annual'` labels are API-REQUEST
 * strings only and are never a column value. Callers pass this same vocabulary
 * straight through to the price lookup (see
 * {@link resolveIntervalScopedPlanPriceCentavos}).
 */
export type SubscriptionBillingIntervalCode = 'month' | 'year';

/**
 * Input for {@link resolveIntervalScopedPlanPriceCentavos}.
 */
export interface ResolveIntervalScopedPlanPriceInput {
    /** A db client exposing `.execute(sql)` — the default connection or a tx. */
    readonly db: Pick<ReturnType<typeof getDb>, 'execute'>;
    /** The plan UUID, or `null` (returns `null`). */
    readonly planId: string | null;
    /** The SUBSCRIPTION-vocabulary interval (`'month' | 'year'`). */
    readonly billingInterval: SubscriptionBillingIntervalCode;
}

/**
 * Resolve the active full recurring price (integer centavos) for a plan on a
 * SPECIFIC interval.
 *
 * Unlike `resolveFullPlanPriceCentavos` (promo-code.renewal), which is
 * interval-AMBIGUOUS (its `ORDER BY (billing_interval = 'monthly') DESC` is an
 * always-false expression — no row stores `'monthly'` — so it silently falls
 * through to `created_at ASC` and returns whatever price sorts first, monthly or
 * annual), this resolver is interval-SCOPED: it returns the price for exactly the
 * interval the subscription is billed on, which is mandatory for a charge-vs-plan
 * comparison (comparing an annual charge to a monthly price row would be a
 * guaranteed false positive).
 *
 * Interval vocabulary: all three tables (`billing_subscriptions`,
 * `billing_plan_price_changes`, `billing_prices`) speak `'month' | 'year'` — the
 * qzpay-core enum values. The `'monthly' | 'annual'` strings are API-request
 * labels only and are NEVER a column value, so this resolver queries
 * `billing_prices.billing_interval` with the subscription vocabulary DIRECTLY (no
 * remap). It also filters `interval_count = 1` to the productized single-period
 * price: quarterly/semi_annual prices are ALSO `billing_interval = 'month'` but
 * carry `interval_count > 1`; without this filter the resolver could pick a
 * multi-month price and manufacture a false positive. This matches the canonical
 * `findMonthlyPrice`/`findAnnualPrice` resolvers in the checkout service. Follows
 * the raw-SQL style of `resolveFullPlanPriceCentavos`.
 *
 * @param input - RO-RO bag (see {@link ResolveIntervalScopedPlanPriceInput}).
 * @returns The active `unit_amount` in integer centavos, or `null` when the plan
 *   id is null, no active single-period price exists for that interval, or the
 *   value is not a number.
 *
 * @example
 * ```ts
 * const centavos = await resolveIntervalScopedPlanPriceCentavos({
 *   db: getDb(),
 *   planId: 'plan-uuid',
 *   billingInterval: 'year', // → queries billing_interval = 'year', interval_count = 1
 * });
 * ```
 */
export async function resolveIntervalScopedPlanPriceCentavos(
    input: ResolveIntervalScopedPlanPriceInput
): Promise<number | null> {
    const { db, planId, billingInterval } = input;
    if (!planId) {
        return null;
    }

    const result = await db.execute(
        sql`SELECT unit_amount
            FROM billing_prices
            WHERE plan_id = ${planId}
              AND active = true
              AND billing_interval = ${billingInterval}
              AND interval_count = 1
            ORDER BY created_at ASC
            LIMIT 1`
    );
    const priceRow = (result.rows?.[0] ?? null) as { unit_amount: number } | null;

    if (!priceRow || typeof priceRow.unit_amount !== 'number') {
        return null;
    }
    return priceRow.unit_amount;
}

/**
 * Outcome of {@link resolveDiscountAwareExpectedCentavos}: a concrete expected
 * amount, or "indeterminate" (we could not DETERMINE it, so the caller must NOT
 * flag a divergence — avoids a false positive).
 */
export type DiscountAwareExpectedResolution =
    | { readonly amount: number }
    | { readonly indeterminate: true };

/**
 * Input for {@link resolveDiscountAwareExpectedCentavos}.
 */
export interface ResolveDiscountAwareExpectedInput {
    /** The subscription UUID whose expected charge is being resolved. */
    readonly subscriptionId: string;
    /** The interval-scoped FULL plan price (integer centavos) for this sub. */
    readonly fullCentavos: number;
}

/**
 * Resolve the amount a subscription is EXPECTED to be charged this cycle, taking
 * any active multi-cycle discount into account.
 *
 * Intentional PARALLEL of the propagate-plan-price-changes cron's
 * `resolveDiscountAwareTargetCentavos` (same discount-state → amount decision
 * tree), differing only in the "undeterminable" sentinel: the cron returns
 * `{ defer: true }` (it will retry next tick), whereas this read-only detector
 * returns `{ indeterminate: true }` (there is no retry — the caller simply skips
 * flagging to avoid a false positive).
 *
 * TODO(HOS-176): consolidate with cron `resolveDiscountAwareTargetCentavos` once
 * the two sentinels can be unified without widening the cron's blast radius.
 *
 * Decision tree (mirrors the cron exactly):
 *   - discount state null OR no `promoCodeId` → `{ amount: fullCentavos }` (no discount).
 *   - `promoEffectRemainingCycles !== null && <= 0` (exhausted) → `{ amount: fullCentavos }`.
 *   - active promo, `getPromoCodeById` `!success` → `{ indeterminate: true }`.
 *   - success but no `.effect` → `{ amount: fullCentavos }`.
 *   - `apply-discount` effect → `{ amount: mutation.finalAmount }`.
 *   - any OTHER effect (comp / trial-extension / …) → `{ amount: fullCentavos }` (never indeterminate).
 *   - THROW (state load / promo lookup) → `{ indeterminate: true }` (Sentry-captured).
 *
 * @param input - RO-RO bag (see {@link ResolveDiscountAwareExpectedInput}).
 * @returns The expected amount in integer centavos, or an indeterminate sentinel.
 */
export async function resolveDiscountAwareExpectedCentavos(
    input: ResolveDiscountAwareExpectedInput
): Promise<DiscountAwareExpectedResolution> {
    const { subscriptionId, fullCentavos } = input;
    try {
        const discountState = await loadSubscriptionDiscountState({ subscriptionId });
        if (!discountState?.promoCodeId) {
            return { amount: fullCentavos };
        }
        const remaining = discountState.promoEffectRemainingCycles;
        // Exhausted (finite countdown at/below zero) → full price is expected.
        if (remaining !== null && remaining <= 0) {
            return { amount: fullCentavos };
        }
        // Active promo: look it up. A lookup failure (transient OR deleted promo)
        // is not determinable → indeterminate (never a false-positive flag).
        const promoResult = await getPromoCodeById(discountState.promoCodeId);
        if (!promoResult.success) {
            return { indeterminate: true };
        }
        // Success but no amount effect → the promo does not touch the recurring
        // amount, so the full price is expected.
        if (!promoResult.data?.effect) {
            return { amount: fullCentavos };
        }
        const mutation = calculatePromoCodeEffect(promoResult.data.effect, fullCentavos);
        if (mutation.type === 'apply-discount') {
            return { amount: mutation.finalAmount };
        }
        // Any other effect (comp-subscription, extend-trial, …) does NOT reduce
        // the recurring amount — full price is expected. NEVER indeterminate here.
        return { amount: fullCentavos };
    } catch (err) {
        // A throw is NOT proof of "no discount" — it means we could not determine
        // the amount. Return indeterminate so the caller does not flag a possibly
        // legitimate discounted charge as a divergence.
        log.error(
            {
                subscriptionId,
                error: err instanceof Error ? err.message : String(err),
                module: 'subscription-charge-reconcile',
                operation: 'resolveDiscountAwareExpectedCentavos'
            },
            `HOS-176: discount-aware expected-amount resolution failed for subscription ${subscriptionId} — treating as indeterminate (no divergence flagged)`,
            { capture: true }
        );
        return { indeterminate: true };
    }
}

/**
 * A recurring charge whose amount diverges from the current plan price for a
 * reason OTHER than an MP campaign (see the section banner above).
 */
export interface PlanPriceDivergence {
    /** What MercadoPago actually charged, in integer centavos. */
    readonly chargedAmountCentavos: number;
    /** What the current plan price says it should be, in integer centavos. */
    readonly expectedAmountCentavos: number;
    /**
     * `expected - charged`, in integer centavos. Positive means the customer was
     * charged LESS than the plan price (undercharge — revenue lost); negative means
     * MORE (overcharge — customer overpaid).
     */
    readonly deltaCentavos: number;
    /** `'undercharge'` when we were paid less than expected, else `'overcharge'`. */
    readonly direction: 'undercharge' | 'overcharge';
}

/**
 * Input for {@link detectPlanPriceDivergence}.
 */
export interface DetectPlanPriceDivergenceInput {
    /** What MercadoPago actually charged, in integer centavos. */
    readonly chargedAmountCentavos: number;
    /** The expected amount (discount-aware, interval-scoped), in integer centavos. */
    readonly expectedAmountCentavos: number;
}

/**
 * Detect whether a recurring charge diverges from the current (discount-aware,
 * interval-scoped) plan price.
 *
 * Pure and I/O-free: the caller resolves both amounts and does all suppression of
 * legitimate divergences (MP campaign, in-flight propagation, active target)
 * BEFORE calling this. Here we only compare.
 *
 * @param input - The charged and expected amounts, both in integer centavos.
 * @returns The divergence details to alert on, or `null` when the amounts match.
 *
 * @example
 * ```ts
 * // A matching charge — nothing to flag
 * detectPlanPriceDivergence({
 *   chargedAmountCentavos: 1_500_000,
 *   expectedAmountCentavos: 1_500_000,
 * }); // => null
 *
 * // MP charged the OLD (lower) price after a failed propagation
 * detectPlanPriceDivergence({
 *   chargedAmountCentavos: 1_400_000,
 *   expectedAmountCentavos: 1_500_000,
 * }); // => { deltaCentavos: 100_000, direction: 'undercharge', ... }
 * ```
 */
export function detectPlanPriceDivergence(
    input: DetectPlanPriceDivergenceInput
): PlanPriceDivergence | null {
    const { chargedAmountCentavos, expectedAmountCentavos } = input;

    if (chargedAmountCentavos === expectedAmountCentavos) {
        return null;
    }

    const deltaCentavos = expectedAmountCentavos - chargedAmountCentavos;
    return {
        chargedAmountCentavos,
        expectedAmountCentavos,
        deltaCentavos,
        direction: deltaCentavos > 0 ? 'undercharge' : 'overcharge'
    };
}
