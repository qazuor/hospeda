/**
 * Promo-code multi-cycle discount apply seam (SPEC-262 T-007 → T-008/T-009).
 *
 * This is the **API-side executable seam** for applying a `discount` effect to an
 * EXISTING monthly subscription that has a live MercadoPago preapproval. It glues
 * together:
 *
 * 1. `@repo/service-core` `applyPromoCode` — the redemption + cycle-counter stamp
 *    (DECIDE; no MP call).
 * 2. `applyInitialDiscountMutation` — the FAIL-CLOSED MercadoPago amount mutation
 *    (EXECUTE).
 *
 * Ordering is FAIL-CLOSED (spike doc §5.6): the MP mutation runs FIRST. Only if MP
 * accepts the lowered `transaction_amount` do we commit the redemption (mark the
 * code applied + stamp the counter). If MP rejects the discount, the code is NOT
 * applied and a typed error is returned — the customer must never be charged full
 * price under a "discount".
 *
 * **TODO(T-008/T-009):** the protected `/apply` route (T-008) and the admin
 * apply-to-existing-subscription route (T-009) MUST call
 * {@link applyMultiCycleDiscountToExistingSubscription} for the case where a
 * `discount` effect is applied to a subscription with a live `mp_subscription_id`.
 * The checkout-signup path (no live preapproval yet) does NOT use this — the
 * discounted amount is set when the preapproval is first created.
 *
 * **B1 invariant (cycle counter):** `promo_effect_remaining_cycles` means "number of
 * discounted charges still owed". The existing-sub apply path seeds the counter to
 * `durationCycles` (full N), NOT N-1, because no charge happens at apply time.
 * Cycle 1 is consumed by the first `subscription_authorized_payment` webhook.
 * See the canonical invariant doc in `promo-code.renewal.ts`.
 *
 * **TODO(T-008) — checkout-signup path seed:**
 * If the signup's first charge fires `subscription_authorized_payment.created`,
 * seed = `durationCycles` (N) and let the webhook decrement N times.
 * If the signup charge is billed inline and does NOT fire the webhook,
 * seed = `durationCycles - 1` (N-1).
 * Verify on the MP sandbox before shipping T-008.
 *
 * @module services/promo-discount-apply.service
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { getDb, sql } from '@repo/db';
import { PromoEffectKindEnum } from '@repo/schemas';
import {
    calculatePromoCodeEffect,
    getPromoCodeByCode,
    resolveFullPlanPriceCentavos
} from '@repo/service-core';
import { apiLogger } from '../utils/logger.js';
import { applyInitialDiscountMutation } from './promo-renewal-mp.service.js';

/**
 * Typed result of applying a multi-cycle discount to an existing subscription.
 */
export type ApplyMultiCycleDiscountResult =
    | {
          readonly success: true;
          readonly data: {
              /** Discounted amount the subscription will be charged, in centavos */
              readonly discountedAmountCentavos: number;
              /** Remaining discounted cycles AFTER this apply (null = forever) */
              readonly remainingCyclesAfter: number | null;
          };
      }
    | {
          readonly success: false;
          readonly error: { readonly code: string; readonly message: string };
      };

/**
 * Minimal subscription row read for the discount apply.
 * @internal
 */
interface DiscountApplySubscriptionRow {
    id: string;
    customer_id: string;
    status: string;
    plan_id: string | null;
    mp_subscription_id: string | null;
}

/**
 * Apply a `discount` promo code to an EXISTING monthly subscription with a live
 * MercadoPago preapproval, FAIL-CLOSED on the MP mutation.
 *
 * Steps:
 * 1. Load the subscription (`customer_id`, `status`, `plan_id`, `mp_subscription_id`).
 * 2. Reject if there is no live `mp_subscription_id` — this seam is only for
 *    monthly subs with an active preapproval. (Annual / checkout-signup discounts
 *    are handled at preapproval-creation time, not here.)
 * 3. Load the promo code; reject if its effect is not `discount`.
 * 4. Resolve the full plan price (centavos) and compute the discounted amount via
 *    the pure effect reducer.
 * 5. **FAIL-CLOSED:** mutate the MP preapproval to the discounted amount FIRST.
 *    If MP rejects, return the typed error WITHOUT applying the code.
 * 6. Only on MP success: call `applyPromoCode` (commits redemption + stamps
 *    `promo_effect_remaining_cycles`).
 *
 * @param input.code - The promo code string.
 * @param input.subscriptionId - The local subscription ID.
 * @param input.billing - The QZPay billing instance.
 * @param input.livemode - Whether to operate in live mode (default: false).
 * @returns Typed success with the discounted amount + remaining cycles, or a typed error.
 */
export async function applyMultiCycleDiscountToExistingSubscription(input: {
    readonly code: string;
    readonly subscriptionId: string;
    readonly billing: QZPayBilling;
    readonly livemode?: boolean;
}): Promise<ApplyMultiCycleDiscountResult> {
    const { code, subscriptionId, billing, livemode = false } = input;
    const db = getDb();

    try {
        // Step 1: load the subscription.
        const subResult = await db.execute(
            sql`SELECT id, customer_id, status, plan_id, mp_subscription_id
                FROM billing_subscriptions
                WHERE id = ${subscriptionId}
                LIMIT 1`
        );
        const sub = (subResult.rows?.[0] ?? null) as DiscountApplySubscriptionRow | null;

        if (!sub) {
            return {
                success: false,
                error: { code: 'NOT_FOUND', message: `Subscription not found: ${subscriptionId}` }
            };
        }

        // Step 2: require a live preapproval.
        if (!sub.mp_subscription_id) {
            return {
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message:
                        'Subscription has no live MercadoPago preapproval — this discount-apply seam is only for monthly subscriptions with an active preapproval.'
                }
            };
        }

        // Step 3: load + validate the promo code effect.
        const promoResult = await getPromoCodeByCode(code.toUpperCase());
        if (!promoResult.success || !promoResult.data) {
            return {
                success: false,
                error: { code: 'NOT_FOUND', message: 'Promo code not found' }
            };
        }
        const promoCode = promoResult.data;
        if (!promoCode.effect || promoCode.effect.kind !== PromoEffectKindEnum.DISCOUNT) {
            return {
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Promo code does not have a discount effect.'
                }
            };
        }

        // Step 4: resolve full plan price + compute discounted amount.
        // Uses the canonical shared helper from service-core (S4 — no duplication).
        const fullPriceCentavos = await resolveFullPlanPriceCentavos(getDb(), sub.plan_id);
        if (fullPriceCentavos === null) {
            return {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: `Could not resolve full plan price for subscription ${subscriptionId}`
                }
            };
        }

        const mutation = calculatePromoCodeEffect(promoCode.effect, fullPriceCentavos);
        if (mutation.type !== 'apply-discount') {
            return {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message:
                        'Effect reducer returned unexpected mutation type for a discount effect'
                }
            };
        }
        const discountedCentavos = mutation.finalAmount;
        const discountedMajor = discountedCentavos / 100;

        // Step 5: FAIL-CLOSED MP mutation FIRST.
        const mpResult = await applyInitialDiscountMutation({
            billing,
            mpSubscriptionId: sub.mp_subscription_id,
            targetTransactionAmountMajor: discountedMajor,
            subscriptionId
        });
        if (!mpResult.success) {
            // MP rejected — do NOT apply the code (customer not charged a fake discount).
            return { success: false, error: mpResult.error };
        }

        // Step 6: commit the redemption + stamp the cycle counter.
        // applyPromoCode (service-core) writes promo_effect_remaining_cycles when
        // a subscriptionId + typed discount effect is supplied. However, it seeds
        // durationCycles-1 (the "checkout-signup" assumption where the apply itself
        // is cycle 1). For the existing-sub path no charge happens at apply time —
        // cycle 1 comes from the first `subscription_authorized_payment` webhook.
        // We therefore immediately overwrite the counter to durationCycles (full N).
        // See the canonical invariant in promo-code.renewal.ts (B1 fix).
        const applyResult = await applyPromoCodeViaServiceCore({
            code,
            customerId: sub.customer_id,
            amount: fullPriceCentavos,
            subscriptionId,
            subscriptionStatus: sub.status,
            livemode
        });

        if (!applyResult.success) {
            // The MP amount was already lowered but the redemption failed (e.g.
            // max-uses). Log loudly — the next renewal reconcile / manual fix path
            // handles the orphaned discounted amount; we do NOT auto-restore here
            // because that would race the just-applied lower amount.
            apiLogger.error(
                {
                    subscriptionId,
                    mpSubscriptionId: sub.mp_subscription_id,
                    error: applyResult.error.message
                },
                'Promo discount: MP amount lowered but redemption commit failed — manual reconcile required'
            );
            return { success: false, error: applyResult.error };
        }

        // B1 fix: correct the counter to full N (durationCycles) because the
        // effect-reducer inside applyPromoCode seeds N-1 (checkout-signup
        // assumption). For the existing-sub path the apply itself is not a
        // charged cycle — the webhook is the only decrementer.
        const durationCycles = promoCode.effect.durationCycles;
        if (durationCycles !== null) {
            // Finite discount: override the reducer's N-1 seed with the correct N.
            await getDb().execute(
                sql`UPDATE billing_subscriptions
                    SET promo_effect_remaining_cycles = ${durationCycles}
                    WHERE id = ${subscriptionId}`
            );
            apiLogger.info(
                { subscriptionId, durationCycles },
                'Promo discount: seeded promo_effect_remaining_cycles to durationCycles (existing-sub B1 fix)'
            );
        }
        // Forever discount (durationCycles=null): applyPromoCode already seeds
        // remaining=null. No override needed.

        const remainingCyclesAfter = durationCycles; // null = forever

        return {
            success: true,
            data: {
                discountedAmountCentavos: discountedCentavos,
                remainingCyclesAfter
            }
        };
    } catch (error) {
        return {
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message:
                    error instanceof Error ? error.message : 'Failed to apply multi-cycle discount'
            }
        };
    }
}

/**
 * Thin wrapper around the service-core `applyPromoCode` to normalize its result
 * into the shape this seam needs (success + remainingCycles, or typed error).
 *
 * Imported lazily-by-name to keep the service-core surface explicit.
 * @internal
 */
async function applyPromoCodeViaServiceCore(input: {
    code: string;
    customerId: string;
    amount: number;
    subscriptionId: string;
    subscriptionStatus: string;
    livemode: boolean;
}): Promise<
    | { success: true; remainingCycles: number | null }
    | { success: false; error: { code: string; message: string } }
> {
    // Imported here (not at top) so the static import list stays focused on the
    // pure helpers; applyPromoCode pulls in the redemption module transitively.
    const { applyPromoCode } = await import('@repo/service-core');
    const result = await applyPromoCode(input.code, input.customerId, input.amount, {
        livemode: input.livemode,
        subscriptionId: input.subscriptionId,
        subscriptionStatus: input.subscriptionStatus
    });
    if (!result.success) {
        return { success: false, error: result.error };
    }
    const remainingCycles =
        'remainingCycles' in result.data && result.data.remainingCycles !== undefined
            ? result.data.remainingCycles
            : null;
    return { success: true, remainingCycles };
}
