/**
 * Promo code definition
 */
export interface PromoCodeDefinition {
    /** The promo code string (uppercase) */
    code: string;
    /** Description of the promo code */
    description: string;
    /**
     * Promo code type. Defaults to `'discount'` for backwards compatibility.
     *
     * - `'discount'`: classic percentage-off promo applied to an addon
     *   purchase or annual upfront payment. Driven by `discountPercent`.
     * - `'free_trial_extension'`: SPEC-126 D9 — extends the MercadoPago
     *   preapproval `free_trial` period by `extraTrialDays` days when the
     *   user starts a paid monthly subscription. The MP preapproval is
     *   created normally; MP delays the first charge by that many days.
     *   `discountPercent` is ignored for this type.
     *
     * Master plan Decision 4 (SPEC-122): for monthly recurring, the ONLY
     * promo type supported in MVP is `free_trial_extension`. Discount-type
     * promos remain limited to addon purchases and annual upfront flows.
     */
    type?: 'discount' | 'free_trial_extension';
    /** Discount percentage (0-100). Required for `type: 'discount'`. */
    discountPercent: number;
    /**
     * Extra free-trial days to add to the MercadoPago preapproval when
     * `type === 'free_trial_extension'`. Ignored for other types.
     */
    extraTrialDays?: number;
    /** Whether the discount is permanent or first period only */
    isPermanent: boolean;
    /** Number of billing cycles the discount applies (null = forever) */
    durationCycles: number | null;
    /** Maximum number of times this code can be used (null = unlimited) */
    maxRedemptions: number | null;
    /** Expiry date (null = never expires) */
    expiresAt: Date | null;
    /** Plan slugs this code is restricted to (null = all plans) */
    restrictedToPlans: string[] | null;
    /** Whether only new users can use this code */
    newUserOnly: boolean;
    /** Whether the code is currently active */
    isActive: boolean;
}

// ─── DEFAULT PROMO CODES ───────────────────────────────────────

export const HOSPEDA_FREE_CODE: PromoCodeDefinition = {
    code: 'HOSPEDA_FREE',
    description: 'Permanent free platform access. Internal use.',
    discountPercent: 100,
    isPermanent: true,
    durationCycles: null,
    maxRedemptions: null,
    expiresAt: null,
    restrictedToPlans: null,
    newUserOnly: false,
    isActive: true
};

export const LANZAMIENTO_50_CODE: PromoCodeDefinition = {
    code: 'LANZAMIENTO50',
    description: '50% launch discount. First 3 months.',
    discountPercent: 50,
    isPermanent: false,
    durationCycles: 3,
    maxRedemptions: 100,
    expiresAt: null,
    restrictedToPlans: null,
    newUserOnly: true,
    isActive: true
};

export const BIENVENIDO_30_CODE: PromoCodeDefinition = {
    code: 'BIENVENIDO30',
    description: '30% discount for new users. First month.',
    discountPercent: 30,
    isPermanent: false,
    durationCycles: 1,
    maxRedemptions: 500,
    expiresAt: null,
    restrictedToPlans: null,
    newUserOnly: true,
    isActive: true
};

/**
 * SPEC-126 D9: free-trial extension promo (30 extra days on the MP
 * preapproval). Applies only to monthly paid subscriptions started via
 * the `/start-paid` flow. The MP preapproval is created normally; MP
 * delays the first charge by `extraTrialDays` so the user gets a free
 * month before the recurring billing kicks in.
 */
export const FREEMONTH_CODE: PromoCodeDefinition = {
    code: 'FREEMONTH',
    description: '30 extra free-trial days on monthly paid subscriptions.',
    type: 'free_trial_extension',
    discountPercent: 0,
    extraTrialDays: 30,
    isPermanent: false,
    durationCycles: 1,
    maxRedemptions: null,
    expiresAt: null,
    restrictedToPlans: null,
    newUserOnly: true,
    isActive: true
};

/** All default promo codes to seed */
export const DEFAULT_PROMO_CODES: PromoCodeDefinition[] = [
    HOSPEDA_FREE_CODE,
    LANZAMIENTO_50_CODE,
    BIENVENIDO_30_CODE,
    FREEMONTH_CODE
];

/**
 * Resolve a code string to a `free_trial_extension` promo definition.
 *
 * Returns `null` when:
 * - The code is not registered in the config, or
 * - The code is registered but with a different `type`, or
 * - The code is registered but inactive or expired, or
 * - `extraTrialDays` is missing/non-positive (defensive — config bug).
 *
 * Used by the `/start-paid` flow to translate a user-supplied promo
 * code into a `freeTrialDays` input on the qzpay subscription create
 * call. Discount-type promos remain out of scope here per master plan
 * Decision 4 (only free-trial extensions apply to monthly recurring).
 *
 * @deprecated SPEC-262 T-005: `subscription-checkout.service.ts` now
 * reads `extraDays` from the DB-persisted `trial_extension` effect
 * (via `PromoCodeService.getByCode`) and only falls back to this
 * config-backed function for legacy rows that have not yet been
 * backfilled by extras/020. Remove this fallback once T-003 backfill
 * has run in production and all `trial_extension` codes are in the DB.
 * TODO(SPEC-262 T-008): retire once the full route rewrite ships.
 */
export function resolveFreeTrialExtensionPromo(
    code: string,
    now: Date = new Date()
): { extraTrialDays: number; definition: PromoCodeDefinition } | null {
    const normalized = code.trim().toUpperCase();
    const definition = DEFAULT_PROMO_CODES.find((p) => p.code === normalized);
    if (!definition) return null;
    if (definition.type !== 'free_trial_extension') return null;
    if (!definition.isActive) return null;
    if (definition.expiresAt !== null && definition.expiresAt <= now) return null;
    const extraTrialDays = definition.extraTrialDays ?? 0;
    if (!Number.isFinite(extraTrialDays) || extraTrialDays <= 0) return null;
    return { extraTrialDays, definition };
}
