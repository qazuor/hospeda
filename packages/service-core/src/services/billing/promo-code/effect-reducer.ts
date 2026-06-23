/**
 * Promo Code Effect Reducer
 *
 * Pure function that computes the concrete mutation to apply for a given promo effect.
 * No DB access, no side effects — suitable for preview and for use inside applyPromoCode.
 *
 * @module services/billing/promo-code/effect-reducer
 */

import type { PromoEffect } from '@repo/schemas';
import { PromoEffectKindEnum } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/**
 * Mutation descriptor for a `discount` effect.
 *
 * All monetary fields are in centavos (smallest currency unit for ARS).
 */
export interface DiscountMutation {
    /** Discriminant */
    type: 'apply-discount';
    /**
     * Computed discount amount in centavos.
     * For percentage kinds, this is the floor of `(originalAmount * value) / 100`.
     */
    discountAmount: number;
    /** Amount the customer is charged after the discount is applied (minimum 0). */
    finalAmount: number;
    /**
     * Remaining billing cycles AFTER this apply.
     * - `null`  — forever discount (no cycle limit)
     * - `0`     — exhausted (this was the last cycle)
     * - `N > 0` — N more cycles remain
     */
    remainingCycles: number | null;
    /**
     * Floating-point rounding loss when computing a percentage discount.
     * Only present when `rawDiscount > Math.floor(rawDiscount)`.
     */
    roundingDelta?: number;
}

/**
 * Mutation descriptor for a `trial_extension` effect.
 */
export interface TrialExtensionMutation {
    /** Discriminant */
    type: 'extend-trial';
    /** Number of calendar days to add to the trial period. */
    daysAdded: number;
}

/**
 * Mutation descriptor for a `comp` effect.
 */
export interface CompMutation {
    /** Discriminant */
    type: 'comp-subscription';
}

/**
 * Discriminated union of all possible promo code mutations.
 * Narrows to the specific mutation type based on the `type` field.
 */
export type PromoMutation = DiscountMutation | TrialExtensionMutation | CompMutation;

// ---------------------------------------------------------------------------
// Pure computation
// ---------------------------------------------------------------------------

/**
 * Compute the concrete mutation to apply for a validated promo effect.
 *
 * This is a **pure function** — it performs no database access, makes no HTTP
 * calls, and has no side effects. It is the single source of truth for all
 * promo-code monetary and effect calculations.
 *
 * `applyPromoCode` delegates to this function for the discount branch.
 * The preview endpoint (T-008) can call it directly without touching the DB.
 *
 * @param effect - A Zod-validated `PromoEffect` discriminated-union value
 * @param originalAmount - The original charge amount in centavos (must be ≥ 0)
 * @param currentCycle - (discount only) 1-indexed cycle number for this apply.
 *   Not used in the current computation — `durationCycles` drives `remainingCycles`
 *   directly — but included in the signature for future per-cycle audit needs.
 * @returns The concrete mutation to apply
 *
 * @example
 * ```ts
 * // 30% one-shot discount on 10 000 centavos
 * const mutation = calculatePromoCodeEffect(
 *   { kind: 'discount', valueKind: 'percentage', value: 30, durationCycles: 1 },
 *   10000,
 * );
 * // => { type: 'apply-discount', discountAmount: 3000, finalAmount: 7000, remainingCycles: 0 }
 *
 * // Trial extension of 30 days
 * const mutation = calculatePromoCodeEffect(
 *   { kind: 'trial_extension', extraDays: 30 },
 *   0,
 * );
 * // => { type: 'extend-trial', daysAdded: 30 }
 *
 * // Comp (permanently free)
 * const mutation = calculatePromoCodeEffect({ kind: 'comp' }, 5000);
 * // => { type: 'comp-subscription' }
 * ```
 */
export function calculatePromoCodeEffect(
    effect: PromoEffect,
    originalAmount: number,
    currentCycle?: number
): PromoMutation {
    // Suppress unused-parameter warning — included in signature for future use
    void currentCycle;

    if (effect.kind === PromoEffectKindEnum.COMP) {
        return { type: 'comp-subscription' };
    }

    if (effect.kind === PromoEffectKindEnum.TRIAL_EXTENSION) {
        return { type: 'extend-trial', daysAdded: effect.extraDays };
    }

    // --- DISCOUNT branch ---------------------------------------------------
    // effect.kind === PromoEffectKindEnum.DISCOUNT at this point
    const { valueKind, value, durationCycles } = effect;

    let discountAmount: number;
    let roundingDelta: number | undefined;

    if (valueKind === 'percentage') {
        const rawDiscount = (originalAmount * value) / 100;
        discountAmount = Math.floor(rawDiscount);
        const delta = rawDiscount - discountAmount;
        if (delta > 0) {
            roundingDelta = delta;
        }
    } else {
        // valueKind === 'fixed'
        discountAmount = Math.min(value, originalAmount);
    }

    const finalAmount = Math.max(0, originalAmount - discountAmount);

    // Remaining cycles AFTER this application:
    //   null  → forever (no limit)
    //   1     → this was the last (only) cycle, now exhausted
    //   N > 1 → N-1 remain
    let remainingCycles: number | null;
    if (durationCycles === null) {
        remainingCycles = null;
    } else if (durationCycles === 1) {
        remainingCycles = 0;
    } else {
        remainingCycles = durationCycles - 1;
    }

    const mutation: DiscountMutation = {
        type: 'apply-discount',
        discountAmount,
        finalAmount,
        remainingCycles
    };

    if (roundingDelta !== undefined) {
        mutation.roundingDelta = roundingDelta;
    }

    return mutation;
}
