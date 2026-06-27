/**
 * Subscription Promo Effect API Response Schema
 *
 * Defines the response shape for the admin endpoint that exposes the active
 * promo effect on a billing subscription. Data is sourced from the extras-carril
 * columns added in:
 * - `019-billing-subscriptions-promo-effect-columns.column.sql` (promo_effect_remaining_cycles)
 * - `018-billing-promo-codes-effect-columns.column.sql` (effect_kind, value_kind, value, duration_cycles, extra_days)
 *
 * Plain validators are intentional — this is a RESPONSE schema and must NOT
 * produce zodError.* keys that would require entries in validation.json.
 *
 * @module api/billing/subscription-promo-effect
 */

import { z } from 'zod';

/**
 * Response schema for `GET /api/v1/admin/billing/subscriptions/:id/promo-effect`.
 *
 * Describes the active promo code effect applied to a subscription, if any.
 *
 * @example
 * // Subscription with a 30% discount, 2 cycles remaining
 * {
 *   hasPromo: true,
 *   promoCodeId: '...uuid...',
 *   code: 'SUMMER30',
 *   effectKind: 'discount',
 *   valueKind: 'percentage',
 *   value: 30,
 *   durationCycles: 3,
 *   remainingCycles: 2,
 *   extraDays: null,
 *   exhausted: false
 * }
 *
 * @example
 * // Subscription with no promo applied
 * {
 *   hasPromo: false,
 *   promoCodeId: null,
 *   code: null,
 *   effectKind: null,
 *   valueKind: null,
 *   value: null,
 *   durationCycles: null,
 *   remainingCycles: null,
 *   extraDays: null,
 *   exhausted: false
 * }
 */
export const SubscriptionPromoEffectResponseSchema = z.object({
    /** Whether the subscription has an active promo code linked (promo_code_id != null) */
    hasPromo: z.boolean(),
    /** UUID of the linked promo code, or null if none */
    promoCodeId: z.string().uuid().nullable(),
    /** The promo code string (for display purposes), or null if none */
    code: z.string().nullable(),
    /** The kind of promo effect: discount, trial_extension, or comp */
    effectKind: z.enum(['discount', 'trial_extension', 'comp']).nullable(),
    /** Discount sub-type: percentage or fixed. Null for non-discount effects */
    valueKind: z.enum(['percentage', 'fixed']).nullable(),
    /** Discount amount (percentage integer or fixed centavos). Null for non-discount effects */
    value: z.number().nullable(),
    /** Total number of billing cycles the discount applies. Null means forever */
    durationCycles: z.number().nullable(),
    /** Number of billing cycles remaining for the discount. Null = forever or no promo */
    remainingCycles: z.number().nullable(),
    /** Number of extra trial days for trial_extension effects. Null for other effects */
    extraDays: z.number().nullable(),
    /**
     * Whether the discount effect has been exhausted.
     * True only when effectKind === 'discount' AND remainingCycles === 0.
     * Always false for non-discount effects or subscriptions with no promo.
     */
    exhausted: z.boolean()
});

/** TypeScript type inferred from {@link SubscriptionPromoEffectResponseSchema} */
export type SubscriptionPromoEffectResponse = z.infer<typeof SubscriptionPromoEffectResponseSchema>;
