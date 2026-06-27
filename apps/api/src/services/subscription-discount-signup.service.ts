/**
 * Discount-at-signup seam for NEW-SUBSCRIBER monthly checkout (SPEC-262 T-012 P2).
 *
 * When a `discount` effect is applied at MONTHLY signup, the local subscription
 * is created via `billing.subscriptions.create({ mode: 'paid' })`, which creates
 * a live MercadoPago preapproval at the FULL plan price. This module then:
 *
 *   1. Computes the discounted recurring amount via the pure effect reducer.
 *   2. **FAIL-CLOSED** mutates the live preapproval's `transaction_amount` down
 *      via {@link applyInitialDiscountMutation}. If MP rejects, the caller MUST
 *      cancel/abandon the just-created subscription and surface a typed error —
 *      the payer must never be left on a full-price preapproval under a
 *      "discount".
 *   3. On MP success, stamps `promo_code_id` and seeds
 *      `promo_effect_remaining_cycles` (the multi-cycle counter), mirroring
 *      `promo-discount-apply.service.ts` (the existing-subscription apply path),
 *      then records the redemption against the new subscription id.
 *
 * The ANNUAL discount path does NOT use this module — annual is a single
 * one-time charge with a discounted line-item amount (no preapproval, no
 * counter); see `initiatePaidAnnualSubscription`.
 *
 * @module services/subscription-discount-signup.service
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { getDb, sql } from '@repo/db';
import type { PromoEffect } from '@repo/schemas';
import { calculatePromoCodeEffect } from '@repo/service-core';
import { apiLogger } from '../utils/logger.js';
import { applyInitialDiscountMutation } from './promo-renewal-mp.service.js';

/**
 * Seed value for `promo_effect_remaining_cycles` at MONTHLY signup, for a finite
 * (`durationCycles = N`) discount.
 *
 * SPEC-262 T-014 SANDBOX-VERIFY: we seed **N** (full duration), matching the
 * existing-subscription apply path (`promo-discount-apply.service.ts` B1 fix).
 * The B1 invariant is that the counter means "number of discounted charges still
 * owed", and the first discounted charge is consumed by the first
 * `subscription_authorized_payment.created` webhook — NOT by the signup itself.
 *
 * This assumes the signup's first recurring charge fires that webhook (so the
 * webhook decrements N times). IF the MP sandbox smoke (T-014) shows the signup
 * charge is billed inline and does NOT fire `subscription_authorized_payment`,
 * this MUST become N-1 (the signup charge would itself be the first discounted
 * cycle). Centralized here so the change is a one-line edit pending the smoke.
 *
 * @param durationCycles - The effect's `durationCycles` (finite, > 0).
 * @returns The value to seed into `promo_effect_remaining_cycles`.
 */
export function computeSignupDiscountCycleSeed(durationCycles: number): number {
    // SPEC-262 T-014 SANDBOX-VERIFY: N (not N-1) — see function docstring.
    return durationCycles;
}

/**
 * Typed result of applying a discount to a freshly-created MONTHLY preapproval.
 */
export type ApplySignupDiscountResult =
    | {
          readonly success: true;
          readonly data: {
              /** Discounted recurring amount the preapproval now charges, in centavos. */
              readonly discountedAmountCentavos: number;
              /** Seeded remaining cycles (null = forever discount). */
              readonly remainingCyclesSeed: number | null;
          };
      }
    | {
          readonly success: false;
          readonly error: { readonly code: string; readonly message: string };
      };

/**
 * Apply a `discount` effect to a just-created MONTHLY subscription's live MP
 * preapproval, FAIL-CLOSED on the MP mutation.
 *
 * Ordering (fail-closed): the MP `transaction_amount` mutation runs FIRST. Only
 * if MP accepts the lowered amount do we stamp the promo + seed the counter +
 * record the redemption. If MP rejects, this returns the typed error WITHOUT any
 * DB write — the caller is then responsible for cancelling the subscription.
 *
 * @param input.billing - QZPay billing instance (provides the payment adapter).
 * @param input.subscriptionId - The local subscription id just created.
 * @param input.mpSubscriptionId - The live MercadoPago preapproval id.
 * @param input.customerId - The billing customer id (for the redemption record).
 * @param input.promoCodeId - The DB promo code id to stamp + redeem.
 * @param input.code - The normalized promo code string.
 * @param input.effect - The typed `discount` effect.
 * @param input.fullPriceCentavos - The full plan price in centavos.
 * @param input.livemode - Whether to record the redemption in live mode.
 * @returns Typed success with the discounted amount + seed, or a typed error.
 */
export async function applySignupDiscountToMonthly(input: {
    readonly billing: QZPayBilling;
    readonly subscriptionId: string;
    readonly mpSubscriptionId: string;
    readonly customerId: string;
    readonly promoCodeId: string;
    readonly code: string;
    readonly effect: Extract<PromoEffect, { kind: 'discount' }>;
    readonly fullPriceCentavos: number;
    readonly livemode: boolean;
}): Promise<ApplySignupDiscountResult> {
    const {
        billing,
        subscriptionId,
        mpSubscriptionId,
        customerId,
        promoCodeId,
        code,
        effect,
        fullPriceCentavos,
        livemode
    } = input;

    // Compute the discounted recurring amount (single source: the pure reducer).
    const mutation = calculatePromoCodeEffect(effect, fullPriceCentavos);
    if (mutation.type !== 'apply-discount') {
        return {
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Effect reducer returned unexpected mutation type for a discount effect'
            }
        };
    }
    const discountedCentavos = mutation.finalAmount;
    const discountedMajor = discountedCentavos / 100;

    // FAIL-CLOSED: mutate the live preapproval FIRST. If MP rejects, the caller
    // must cancel the subscription — we do NOT write any DB state here.
    const mpResult = await applyInitialDiscountMutation({
        billing,
        mpSubscriptionId,
        targetTransactionAmountMajor: discountedMajor,
        subscriptionId
    });
    if (!mpResult.success) {
        return { success: false, error: mpResult.error };
    }

    // MP accepted. Stamp promo_code_id, seed the counter, record the redemption.
    // Mirror promo-discount-apply.service.ts seeding mechanics: finite → seed N
    // (computeSignupDiscountCycleSeed), forever (durationCycles=null) → null.
    const durationCycles = effect.durationCycles;
    const remainingCyclesSeed =
        durationCycles === null ? null : computeSignupDiscountCycleSeed(durationCycles);

    const db = getDb();
    await db.execute(
        sql`UPDATE billing_subscriptions
            SET promo_code_id = ${promoCodeId},
                promo_effect_remaining_cycles = ${remainingCyclesSeed}
            WHERE id = ${subscriptionId}`
    );

    // Record the redemption (usage increment + usage row) against the new sub.
    // Imported lazily to keep the static import list focused on the pure helpers.
    const { redeemAndRecordUsage } = await import('@repo/service-core');
    const redeemResult = await redeemAndRecordUsage({
        promoCodeId,
        customerId,
        subscriptionId,
        discountAmount: mutation.discountAmount,
        currency: 'ARS',
        livemode
    });

    if (!redeemResult.success) {
        // The MP amount was already lowered AND the promo stamped, but the
        // redemption record failed (e.g. max-uses raced). Log loudly — the
        // discount is live; manual reconcile owns the orphaned usage record.
        // We do NOT auto-restore (that would race the just-applied lower amount).
        apiLogger.error(
            { subscriptionId, mpSubscriptionId, code, error: redeemResult.error.message },
            'Signup discount: MP amount lowered + promo stamped but redemption record failed — manual reconcile'
        );
        return { success: false, error: redeemResult.error };
    }

    apiLogger.info(
        { subscriptionId, mpSubscriptionId, code, discountedCentavos, remainingCyclesSeed },
        'Signup discount: applied to MONTHLY preapproval + seeded cycle counter'
    );

    return {
        success: true,
        data: { discountedAmountCentavos: discountedCentavos, remainingCyclesSeed }
    };
}
