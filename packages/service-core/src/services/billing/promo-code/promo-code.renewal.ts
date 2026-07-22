/**
 * Promo Code Renewal Decision Module (SPEC-262 T-007)
 *
 * Provides `resolveRenewalPromoEffect` — the service-layer decision function for
 * the **multi-cycle discount** use case (case 3, e.g. `LANZAMIENTO50` = "50% off
 * the first 3 cycles"). It is invoked from the API webhook path when a recurring
 * charge is confirmed (`subscription_authorized_payment.created`).
 *
 * **Layer separation (architecture):**
 * - This module DECIDES. It loads the subscription's promo state, applies the
 *   pure effect reducer to the full plan price, persists the decremented cycle
 *   counter (typed Drizzle UPDATE on `promoEffectRemainingCycles`), and
 *   returns a typed DECISION describing what the MercadoPago preapproval
 *   amount should be set to.
 * - It performs NO MercadoPago calls and NO HTTP. The API layer
 *   (`apps/api/src/routes/webhooks/mercadopago/...`) reads the decision and
 *   executes `paymentAdapter.subscriptions.update(...)`.
 *
 * The "original full price" used to compute the discounted amount and to restore
 * the amount when the discount is exhausted is the **plan price**
 * (`billing_prices.unit_amount`, integer centavos) — the source of truth — NOT a
 * value read back from MercadoPago (spike doc §5.1).
 *
 * ## Cycle-counter invariant (SPEC-262 B1 — canonical reference)
 *
 * `promo_effect_remaining_cycles` = **"number of discounted charges still owed"**.
 *
 * - The `subscription_authorized_payment.created` webhook is the **ONLY** place the
 *   counter is decremented — once per SUCCESSFUL discounted charge.
 * - `restore-full` fires when the post-decrement value reaches 0.
 * - Seeds:
 *   - **Existing-sub apply path** (`applyMultiCycleDiscountToExistingSubscription`):
 *     seed = `durationCycles` (full N). The apply mutates a future amount and
 *     charges nothing, so cycle 1 is consumed by the first webhook, not the apply.
 *   - **Checkout-signup path (TODO T-008)**: if the signup's first charge fires
 *     `subscription_authorized_payment.created`, seed = `durationCycles` (N) and let
 *     the webhook decrement it exactly N times. If the signup charge is billed
 *     inline and does NOT fire the webhook, seed = `durationCycles - 1` (N-1).
 *     The T-008 implementer MUST verify this on the MP sandbox before shipping.
 *   - **Forever discount** (`durationCycles = null`): seed = `null`; counter never
 *     decremented (stays null).
 *
 * @see packages/service-core/src/services/billing/promo-code/docs/mp-preapproval-mutation-spike.md
 * @module services/billing/promo-code/promo-code.renewal
 */

import type { QueryContext } from '@repo/db';
import { billingSubscriptions, eq, getDb, sql } from '@repo/db';
import { createLogger } from '@repo/logger';
import { PromoEffectKindEnum, ServiceErrorCode, SubscriptionStatusEnum } from '@repo/schemas';
import { loadSubscriptionDiscountState } from '../subscription/subscription-product-domain.js';

/**
 * Module logger — used for the defensive-branch inconsistency warning.
 * The API layer (apps/api) has Sentry configured and emits this to Sentry via
 * the log transport. Service-core MUST NOT import `@sentry/node` directly
 * (it would pull `@sentry/opentelemetry` which is not installed in service-core's
 * dependency tree and breaks test environments).
 */
const log = createLogger('service-core:promo-code:renewal');

import { calculatePromoCodeEffect } from './effect-reducer.js';
import { getPromoCodeById } from './promo-code.crud.js';

/**
 * Tolerance (in integer centavos) when comparing the confirmed charge amount
 * against the expected discounted amount (HOS-245). Both values are exact
 * integer centavos, but the expected amount round-trips through MercadoPago's
 * major-unit `transaction_amount` (centavos → major → centavos), so a 1-centavo
 * slack absorbs any float rounding. A genuinely undelivered discount differs by
 * thousands of centavos (full vs discounted), so this never masks a real mismatch.
 */
const AMOUNT_MATCH_TOLERANCE_CENTAVOS = 1;

// ---------------------------------------------------------------------------
// Input / Output types
// ---------------------------------------------------------------------------

/**
 * Input for resolving the renewal promo effect of a subscription.
 *
 * Called once per recurring charge (anchored on
 * `subscription_authorized_payment.created`, spike doc §5.2).
 */
export interface ResolveRenewalPromoEffectInput {
    /** UUID of the `billing_subscriptions` row whose charge was just confirmed */
    subscriptionId: string;
    /**
     * Whether to persist the decremented cycle counter to the DB.
     *
     * `true` (default) — this is a real charge event, so the counter is
     * decremented and written back. Each `subscription_authorized_payment.created`
     * for a discounted sub consumes exactly one discounted cycle.
     *
     * `false` — preview / safety-net reconcile (spike doc §5.4): compute the
     * decision WITHOUT mutating the counter. Useful for the subscription-poll
     * pre-flight check.
     */
    persist?: boolean;
    /**
     * The amount actually charged for the confirmed cycle, in integer centavos
     * (from the settled MercadoPago payment: `Math.round(details.transactionAmount * 100)`).
     *
     * HOS-245 defense-in-depth. When provided, the discount countdown is only
     * advanced (and the counter decremented) if this amount matches the expected
     * discounted amount for the current cycle. If a charge that should have been
     * discounted settled at a different amount (e.g. full price due to a
     * provisioning race), consuming a discount cycle would record an undelivered
     * discount as delivered — so the decrement is skipped and the mismatch logged
     * (surfaced to Sentry via the apps/api log transport) instead.
     *
     * `undefined` (default) — preserves the pre-HOS-245 behavior: the caller has
     * no confirmed charge amount to verify against (e.g. the `persist:false`
     * safety-net preview / subscription-poll pre-flight), so the countdown
     * advances unconditionally as before.
     */
    chargedAmountCentavos?: number;
    /** Optional outer query context — when provided, DB reads/writes use `ctx.tx` */
    ctx?: QueryContext;
}

/**
 * Decision returned by `resolveRenewalPromoEffect`.
 *
 * - `apply-discount` — the subscription is in an active discounted cycle. The
 *   MP preapproval `transaction_amount` should be (or remain) the discounted
 *   value. `remainingCyclesAfter` reflects the counter AFTER decrementing this
 *   cycle. When `remainingCyclesAfter === null` the discount is forever.
 * - `restore-full` — the discount has just been exhausted (the counter reached
 *   0 on this cycle). The MP preapproval `transaction_amount` must be raised
 *   back to the original full price for the NEXT cycle.
 * - `comp` — the subscription is complimentary (`status = 'comp'`). Charge is 0;
 *   the caller MUST NOT perform any MP amount mutation (comp subs have no
 *   preapproval, Model β — AC-2.1).
 * - `noop` — nothing to do (no promo code, non-discount effect, already
 *   exhausted, etc.). No MP mutation.
 */
export type RenewalPromoAction = 'apply-discount' | 'restore-full' | 'comp' | 'noop';

/**
 * Typed decision describing what (if anything) the API layer must do to the MP
 * preapproval after a recurring charge.
 */
export interface RenewalPromoDecision {
    /** What the caller should do with the MP preapproval amount */
    action: RenewalPromoAction;
    /**
     * Target MP `transaction_amount` in MAJOR units (ARS) — present for
     * `apply-discount` and `restore-full`. MP expects major units (centavos / 100),
     * matching the existing `subscriptions.update({ transactionAmount })` call sites.
     * Absent for `comp` and `noop`.
     */
    targetTransactionAmountMajor?: number;
    /**
     * Target amount in integer centavos (internal money unit) — present whenever
     * `targetTransactionAmountMajor` is. Exposed for logging / assertions so the
     * caller does not have to re-derive centavos from the rounded major value.
     */
    targetTransactionAmountCentavos?: number;
    /**
     * Remaining discounted cycles AFTER this charge.
     * - `null` — forever discount (no decrement; stays null).
     * - `0`    — this was the last discounted cycle (paired with `restore-full`).
     * - `N>0`  — N discounted cycles remain (paired with `apply-discount`).
     * Absent for `comp`. Present for `restore-full`/`apply-discount`, and also
     * echoed on some `noop` results (already-exhausted and the HOS-245
     * amount-mismatch skip) to report the counter left untouched.
     */
    remainingCyclesAfter?: number | null;
    /** The subscription this decision applies to (echoed for the caller's logs) */
    subscriptionId: string;
    /** The promo code driving the discount, when one is active. */
    promoCodeId?: string;
}

/**
 * Typed service result for `resolveRenewalPromoEffect`.
 */
export type ResolveRenewalPromoEffectResult =
    | { readonly success: true; readonly data: RenewalPromoDecision }
    | {
          readonly success: false;
          readonly error: { readonly code: string; readonly message: string };
      };

// ---------------------------------------------------------------------------
// Internal row shapes
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Main operation
// ---------------------------------------------------------------------------

/**
 * Resolve the multi-cycle discount decision for a subscription whose recurring
 * charge was just confirmed.
 *
 * **Algorithm (spike doc §5, AC-1.5 / AC-2.1 / AC-2.2):**
 * 1. Load the subscription's `status`, `plan_id`, `mp_subscription_id`,
 *    `promo_code_id`, `promo_effect_remaining_cycles`.
 * 2. `status === 'comp'` → decision `comp` (charge 0, no MP mutation). The
 *    counter is never touched.
 * 3. No `promo_code_id`, or the code's effect is not `discount` → `noop`.
 * 4. Load the full plan price (`billing_prices.unit_amount`, centavos) — the
 *    source of truth for both the discounted amount and the restore amount.
 * 5. `remaining = null` (forever) AND `durationCycles = null` → stay discounted:
 *    `apply-discount` at the discounted amount, counter stays `null` (AC-2.2).
 * 6. `remaining > 0` → still in a discounted cycle. Decrement by 1.
 *    - decremented value `> 0` → `apply-discount` (still discounted next cycle).
 *    - decremented value `=== 0` → `restore-full` (this was the last discounted
 *      cycle; raise the amount back to full for the NEXT cycle). The counter is
 *      written as 0 so the next event yields `noop`.
 * 7. `remaining === 0` (already exhausted) → `noop` (full price already in place).
 *
 * **Persistence (fail-closed for the counter, mirrors `applyPromoCode`):**
 * When `persist` is true (default) the decremented counter is written to
 * `billingSubscriptions.promoEffectRemainingCycles` via a typed Drizzle UPDATE
 * inside the provided `ctx.tx` (or the default connection). The caller performs the MP
 * mutation AFTER this returns; if the MP restore fails the worst case is one
 * extra discounted cycle (recoverable — spike doc §5.6), never a refund.
 *
 * @param input - RO-RO input bag (see {@link ResolveRenewalPromoEffectInput})
 * @returns Typed decision, or a typed error (NOT_FOUND / INTERNAL_ERROR).
 *
 * @example
 * ```ts
 * const decision = await resolveRenewalPromoEffect({ subscriptionId: 'sub-1' });
 * if (decision.success && decision.data.action === 'restore-full') {
 *   // API layer: paymentAdapter.subscriptions.update(mpSubId, {
 *   //   transactionAmount: decision.data.targetTransactionAmountMajor,
 *   // });
 * }
 * ```
 */
export async function resolveRenewalPromoEffect(
    input: ResolveRenewalPromoEffectInput
): Promise<ResolveRenewalPromoEffectResult> {
    const { subscriptionId, persist = true, chargedAmountCentavos, ctx } = input;
    const db = ctx?.tx ?? getDb();

    try {
        // ------------------------------------------------------------------
        // Step 1: Load the subscription's promo + plan state via the shared
        // typed helper (HOS-75 T-012).
        // ------------------------------------------------------------------
        const subRow = await loadSubscriptionDiscountState({ subscriptionId, tx: db });

        if (!subRow) {
            return {
                success: false,
                error: {
                    code: ServiceErrorCode.NOT_FOUND,
                    message: `Subscription not found: ${subscriptionId}`
                }
            };
        }

        // ------------------------------------------------------------------
        // Step 2: comp subscriptions are never charged (AC-2.1 / Model β).
        // No MP preapproval exists, so no amount mutation. Never touch the
        // counter — a comp sub has no discount cycle countdown.
        // ------------------------------------------------------------------
        if (subRow.status === SubscriptionStatusEnum.COMP) {
            return {
                success: true,
                data: { action: 'comp', subscriptionId }
            };
        }

        // ------------------------------------------------------------------
        // Step 3: no promo code linked → nothing to reconcile.
        // ------------------------------------------------------------------
        if (!subRow.promoCodeId) {
            return {
                success: true,
                data: { action: 'noop', subscriptionId }
            };
        }

        const promoCodeId = subRow.promoCodeId;
        const promoResult = await getPromoCodeById(promoCodeId, ctx);

        if (!promoResult.success || !promoResult.data) {
            // The link points at a missing code — treat as noop rather than an
            // error so a webhook is never blocked by a dangling reference.
            return {
                success: true,
                data: { action: 'noop', subscriptionId, promoCodeId }
            };
        }

        const promoCode = promoResult.data;

        // Only `discount` effects participate in the renewal-amount mechanism.
        // trial_extension / comp are handled elsewhere (T-006 / step 2).
        if (!promoCode.effect || promoCode.effect.kind !== PromoEffectKindEnum.DISCOUNT) {
            return {
                success: true,
                data: { action: 'noop', subscriptionId, promoCodeId }
            };
        }

        const discountEffect = promoCode.effect;
        const remaining = subRow.promoEffectRemainingCycles;

        // ------------------------------------------------------------------
        // Step 7 (early): discount already exhausted. The full price was
        // restored on the cycle that drove the counter to 0; nothing to do.
        // ------------------------------------------------------------------
        if (remaining !== null && remaining <= 0) {
            return {
                success: true,
                data: { action: 'noop', subscriptionId, promoCodeId, remainingCyclesAfter: 0 }
            };
        }

        // ------------------------------------------------------------------
        // Step 4: resolve the full plan price (centavos) — source of truth for
        // both the discounted amount and the restore amount (spike doc §5.1).
        // ------------------------------------------------------------------
        const fullPriceCentavos = await resolveFullPlanPriceCentavos(db, subRow.planId);
        if (fullPriceCentavos === null) {
            return {
                success: false,
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Could not resolve full plan price for subscription ${subscriptionId} (plan ${subRow.planId ?? 'null'})`
                }
            };
        }

        // Compute the discounted amount from the FULL price via the pure reducer.
        const mutation = calculatePromoCodeEffect(discountEffect, fullPriceCentavos);
        if (mutation.type !== 'apply-discount') {
            return {
                success: false,
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message:
                        'Effect reducer returned unexpected mutation type for a discount effect'
                }
            };
        }
        const discountedCentavos = mutation.finalAmount;
        const discountedMajor = centavosToMajor(discountedCentavos);
        const fullMajor = centavosToMajor(fullPriceCentavos);

        // ------------------------------------------------------------------
        // HOS-245 (defense-in-depth): only advance the discount countdown when
        // the charge that triggered this webhook actually reflected the
        // discounted amount. At this point we know a discount is active (the
        // early-exhausted check above already returned for remaining <= 0), so
        // the confirmed charge is expected to equal `discountedCentavos`.
        //
        // If a charge that should have been discounted settled at a different
        // amount (e.g. full price due to a provisioning race), consuming a
        // discount cycle here would record an undelivered discount as delivered
        // (the counter would reach 0 and fire a no-op `restore-full`), leaving
        // the customer charged full with the system convinced the discount was
        // granted — hard to detect/reconcile. Skip the decrement and surface the
        // mismatch instead. Only enforced when the caller supplies the charged
        // amount (real webhook path); the preview/reconcile path leaves it
        // undefined and keeps the pre-HOS-245 unconditional behavior.
        // ------------------------------------------------------------------
        //
        // Exclude the inconsistent-state defensive branch below
        // (`remaining === null` with a non-null `durationCycles`): that path
        // self-heals a broken row to `restore-full`/`remaining=0`, and a
        // full-price charge is exactly what it expects — intercepting it here
        // as a mismatch would leave the broken row un-normalized (counter stuck
        // at null). Only guard genuine active-discount cycles (finite
        // remaining > 0, or a legitimate forever discount).
        const isInconsistentDiscountState =
            remaining === null && discountEffect.durationCycles !== null;
        if (
            !isInconsistentDiscountState &&
            chargedAmountCentavos !== undefined &&
            Math.abs(chargedAmountCentavos - discountedCentavos) > AMOUNT_MATCH_TOLERANCE_CENTAVOS
        ) {
            log.error(
                {
                    subscriptionId,
                    promoCodeId,
                    expectedDiscountedCentavos: discountedCentavos,
                    chargedAmountCentavos,
                    remainingCyclesBefore: remaining,
                    module: 'promo-code.renewal',
                    operation: 'amountMismatch'
                },
                `resolveRenewalPromoEffect: charged amount ${chargedAmountCentavos} centavos does not match expected discounted amount ${discountedCentavos} centavos for sub ${subscriptionId} — NOT consuming a discount cycle (possible undelivered discount).`,
                // SPEC-180 opt-in: forward to Sentry via the apps/api capture hook.
                // Without `capture: true` an ERROR log only reaches stdout — the
                // whole point of HOS-245 is to make this mismatch actionable.
                { capture: true }
            );
            // Leave the counter untouched (no decrement, no MP mutation) so a
            // non-discounted charge never advances the discounted-cycle countdown.
            return {
                success: true,
                data: {
                    action: 'noop',
                    subscriptionId,
                    promoCodeId,
                    remainingCyclesAfter: remaining
                }
            };
        }

        // ------------------------------------------------------------------
        // Step 5: forever discount (remaining null + durationCycles null).
        // Stay discounted; counter stays null (AC-2.2). No decrement to persist.
        // ------------------------------------------------------------------
        if (remaining === null && discountEffect.durationCycles === null) {
            return {
                success: true,
                data: {
                    action: 'apply-discount',
                    targetTransactionAmountMajor: discountedMajor,
                    targetTransactionAmountCentavos: discountedCentavos,
                    remainingCyclesAfter: null,
                    subscriptionId,
                    promoCodeId
                }
            };
        }

        // Defensive (NIT): remaining is null but the effect is NOT a forever
        // discount (durationCycles is set). This is an inconsistent DB state —
        // treat as exhausted and restore to full so the customer is never
        // under-charged indefinitely. Log at error level so the Sentry log
        // transport (wired in apps/api) captures it without a direct Sentry import
        // here (service-core must not pull @sentry/node — it lacks @sentry/opentelemetry).
        if (remaining === null) {
            log.error(
                {
                    subscriptionId,
                    promoCodeId,
                    durationCycles: discountEffect.durationCycles,
                    module: 'promo-code.renewal',
                    operation: 'defensiveBranch'
                },
                `resolveRenewalPromoEffect: inconsistent state — remaining=null but durationCycles=${discountEffect.durationCycles} for sub ${subscriptionId}. Treating as exhausted (restore-full).`,
                // SPEC-180 opt-in: the surrounding comment promises Sentry visibility;
                // without `capture: true` this ERROR log only reached stdout (HOS-245).
                { capture: true }
            );
            if (persist) {
                await persistRemainingCycles(db, subscriptionId, 0);
            }
            return {
                success: true,
                data: {
                    action: 'restore-full',
                    targetTransactionAmountMajor: fullMajor,
                    targetTransactionAmountCentavos: fullPriceCentavos,
                    remainingCyclesAfter: 0,
                    subscriptionId,
                    promoCodeId
                }
            };
        }

        // ------------------------------------------------------------------
        // Step 6: finite discount with remaining > 0 — consume one cycle.
        // ------------------------------------------------------------------
        const remainingAfter = remaining - 1;

        if (persist) {
            await persistRemainingCycles(db, subscriptionId, remainingAfter);
        }

        if (remainingAfter > 0) {
            // Still discounted for the next cycle.
            return {
                success: true,
                data: {
                    action: 'apply-discount',
                    targetTransactionAmountMajor: discountedMajor,
                    targetTransactionAmountCentavos: discountedCentavos,
                    remainingCyclesAfter: remainingAfter,
                    subscriptionId,
                    promoCodeId
                }
            };
        }

        // remainingAfter === 0 → this was the LAST discounted cycle. Raise the
        // amount back to full price for the next cycle (AC-1.5 stop).
        return {
            success: true,
            data: {
                action: 'restore-full',
                targetTransactionAmountMajor: fullMajor,
                targetTransactionAmountCentavos: fullPriceCentavos,
                remainingCyclesAfter: 0,
                subscriptionId,
                promoCodeId
            }
        };
    } catch (error) {
        return {
            success: false,
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message:
                    error instanceof Error
                        ? error.message
                        : 'Failed to resolve renewal promo effect'
            }
        };
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Convert integer centavos (internal money unit) to MAJOR units (ARS) for the
 * MercadoPago `transaction_amount` field, matching the existing mutation call
 * sites which pass `unitAmount / 100`.
 *
 * @internal
 */
function centavosToMajor(centavos: number): number {
    return centavos / 100;
}

/**
 * Database client union accepted by the internal helpers — either the default
 * connection or an enlisted transaction client. Both expose `.execute(sql)`.
 *
 * @internal
 */
type RenewalDbClient = Pick<ReturnType<typeof getDb>, 'execute' | 'update'>;

/**
 * Resolve the full recurring price (integer centavos) for a plan by reading the
 * active monthly `billing_prices` row. Returns `null` when no active price is
 * found (caller surfaces an INTERNAL_ERROR — a discounted sub with no resolvable
 * full price cannot be safely restored).
 *
 * Preference order:
 * 1. active `monthly` price for the plan,
 * 2. any active price for the plan,
 * 3. null.
 *
 * This is the canonical implementation (S4 — single source of truth).
 * `promo-discount-apply.service.ts` imports this via the barrel export instead of
 * duplicating it locally.
 */
export async function resolveFullPlanPriceCentavos(
    db: RenewalDbClient,
    planId: string | null
): Promise<number | null> {
    if (!planId) {
        return null;
    }

    const priceResult = await db.execute(
        sql`SELECT unit_amount
            FROM billing_prices
            WHERE plan_id = ${planId}
              AND active = true
            ORDER BY (billing_interval = 'monthly') DESC, created_at ASC
            LIMIT 1`
    );
    const priceRow = (priceResult.rows?.[0] ?? null) as { unit_amount: number } | null;

    if (!priceRow || typeof priceRow.unit_amount !== 'number') {
        return null;
    }
    return priceRow.unit_amount;
}

/**
 * Persist the decremented `promoEffectRemainingCycles` on the subscription.
 *
 * @internal
 */
async function persistRemainingCycles(
    db: RenewalDbClient,
    subscriptionId: string,
    remainingCycles: number
): Promise<void> {
    await db
        .update(billingSubscriptions)
        .set({ promoEffectRemainingCycles: remainingCycles })
        .where(eq(billingSubscriptions.id, subscriptionId));
}
