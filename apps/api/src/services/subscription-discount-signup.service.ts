/**
 * Signup-discount cycle-seed helper (SPEC-262 T-012 P2 / HOS-244).
 *
 * HOS-244 moved the discount bookkeeping (stamp promo + seed counter + record
 * redemption) inline into `link-preapproval.service.ts`'s
 * `applyPendingDiscountBestEffort`, where it is split into a fail-closed critical
 * phase and a best-effort redemption phase (the MP preapproval is now born
 * discounted at the plan level, so there is no reactive MercadoPago mutation and
 * no fail-closed cancellation contract left here). All that remains in this module
 * is the canonical cycle-seed constant, kept centralized so the SANDBOX-VERIFY
 * decision below is a single-source edit.
 *
 * @module services/subscription-discount-signup.service
 */

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
