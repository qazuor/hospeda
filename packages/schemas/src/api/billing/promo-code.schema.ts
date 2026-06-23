import { z } from 'zod';
import { queryBooleanParam } from '../../common/query-helpers.js';

// ---------------------------------------------------------------------------
// Legacy enum (kept for backward compat — still used by response shape)
// ---------------------------------------------------------------------------

/**
 * Discount type enum for promo codes.
 * Defines whether the discount is a percentage off or a fixed amount.
 *
 * @deprecated Prefer {@link ValueKindEnum} for new code. Kept for backward
 * compatibility with the `type` field in {@link PromoCodeResponseSchema}.
 */
export enum PromoCodeDiscountTypeEnum {
    /** Discount is a percentage of the total (e.g. 20%) */
    PERCENTAGE = 'percentage',
    /** Discount is a fixed monetary amount (e.g. $500 ARS) */
    FIXED = 'fixed'
}

/**
 * Zod schema for the PromoCodeDiscountTypeEnum
 */
export const PromoCodeDiscountTypeEnumSchema = z.nativeEnum(PromoCodeDiscountTypeEnum, {
    error: () => ({ message: 'zodError.billing.promoCode.discountType.invalid' })
});

// ---------------------------------------------------------------------------
// Effect-kind enums (SPEC-262)
// ---------------------------------------------------------------------------

/**
 * The kind of effect a promo code produces.
 *
 * - `discount` — a percentage or fixed-amount deduction applied for N cycles
 *   (or forever when `durationCycles` is null).
 * - `trial_extension` — extends the subscription trial period by N days.
 * - `comp` — permanently comps the subscription (no charge, ever). Triggers
 *   the `comp` subscription status (Model β, SPEC-262 §7.3 / §14 decision 1).
 *
 * @see {@link PromoEffectSchema} for the full discriminated-union shape.
 */
export enum PromoEffectKindEnum {
    /** Money discount, one-shot or multi-cycle */
    DISCOUNT = 'discount',
    /** Trial period extension */
    TRIAL_EXTENSION = 'trial_extension',
    /** Permanently complimentary — no billing ever */
    COMP = 'comp'
}

/**
 * Zod schema for {@link PromoEffectKindEnum}
 */
export const PromoEffectKindEnumSchema = z.nativeEnum(PromoEffectKindEnum, {
    error: () => ({ message: 'zodError.billing.promoCode.effectKind.invalid' })
});

/**
 * The sub-kind of a discount value: percentage of the total or a fixed amount
 * in centavos (smallest monetary unit).
 */
export enum ValueKindEnum {
    /** Percentage off (1–100) */
    PERCENTAGE = 'percentage',
    /** Fixed amount in centavos */
    FIXED = 'fixed'
}

/**
 * Zod schema for {@link ValueKindEnum}
 */
export const ValueKindEnumSchema = z.nativeEnum(ValueKindEnum, {
    error: () => ({ message: 'zodError.billing.promoCode.valueKind.invalid' })
});

// ---------------------------------------------------------------------------
// Discriminated-union PromoEffectSchema (SPEC-262 §4, AC-1.2, AC-1.3)
// ---------------------------------------------------------------------------

/**
 * Promo effect: `discount` branch.
 *
 * Rules:
 * - `valueKind === 'percentage'` → `value` must be 0–100 (inclusive) (AC-1.2).
 * - `value` must always be ≥ 0.
 * - `durationCycles`, when not null, must be a positive integer (> 0) (AC-1.3).
 * - `durationCycles = null` means "apply forever".
 */
const DiscountEffectSchema = z
    .object({
        /** Discriminant */
        kind: z.literal(PromoEffectKindEnum.DISCOUNT),
        /** Whether the value is a percentage or a fixed centavo amount */
        valueKind: ValueKindEnumSchema,
        /**
         * Discount value.
         * - `percentage` kind: integer 0–100 (inclusive).
         * - `fixed` kind: positive integer in centavos.
         */
        value: z
            .number({ message: 'zodError.billing.promoCode.effect.discount.value.invalidType' })
            .int({ message: 'zodError.billing.promoCode.effect.discount.value.int' })
            .min(0, { message: 'zodError.billing.promoCode.effect.discount.value.min' }),
        /**
         * Number of billing cycles to apply the discount.
         * - `1` = one-shot (legacy default for migrated codes).
         * - `N > 1` = apply for the first N paid cycles, then stop.
         * - `null` = apply forever (every renewal).
         */
        durationCycles: z
            .number({
                message: 'zodError.billing.promoCode.effect.discount.durationCycles.invalidType'
            })
            .int({
                message: 'zodError.billing.promoCode.effect.discount.durationCycles.int'
            })
            .min(1, {
                message: 'zodError.billing.promoCode.effect.discount.durationCycles.min'
            })
            .nullable()
    })
    .refine((data) => data.valueKind !== ValueKindEnum.PERCENTAGE || data.value <= 100, {
        message: 'zodError.billing.promoCode.effect.discount.value.percentageMax',
        path: ['value']
    });

/**
 * Promo effect: `trial_extension` branch.
 *
 * Extends the subscription trial by `extraDays` calendar days.
 * Days are the canonical unit; months must be converted at creation time
 * (SPEC-262 §14 decision 3).
 */
const TrialExtensionEffectSchema = z.object({
    /** Discriminant */
    kind: z.literal(PromoEffectKindEnum.TRIAL_EXTENSION),
    /**
     * Number of calendar days to extend the trial.
     * Must be a positive integer (> 0).
     */
    extraDays: z
        .number({
            message: 'zodError.billing.promoCode.effect.trialExtension.extraDays.invalidType'
        })
        .int({
            message: 'zodError.billing.promoCode.effect.trialExtension.extraDays.int'
        })
        .min(1, {
            message: 'zodError.billing.promoCode.effect.trialExtension.extraDays.min'
        })
});

/**
 * Promo effect: `comp` branch.
 *
 * Marks a subscription permanently complimentary (free-forever, Model β).
 * No monetary parameters — the subscription never creates or relies on a
 * MercadoPago preapproval for charges (SPEC-262 §7.3 / §14 decision 1).
 */
const CompEffectSchema = z.object({
    /** Discriminant */
    kind: z.literal(PromoEffectKindEnum.COMP)
});

/**
 * Discriminated union covering all three promo effect kinds.
 *
 * Discriminated on the `kind` field. Each branch enforces its own parameter
 * invariants (AC-1.2, AC-1.3, AC-5.4).
 *
 * @example
 * ```ts
 * // One-shot 30% discount (legacy migration default)
 * const effect: PromoEffect = { kind: 'discount', valueKind: 'percentage', value: 30, durationCycles: 1 };
 *
 * // 50% off first 3 cycles
 * const effect: PromoEffect = { kind: 'discount', valueKind: 'percentage', value: 50, durationCycles: 3 };
 *
 * // Free forever (100%, forever)
 * const effect: PromoEffect = { kind: 'comp' };
 *
 * // Extend trial by 30 days
 * const effect: PromoEffect = { kind: 'trial_extension', extraDays: 30 };
 * ```
 */
export const PromoEffectSchema = z.discriminatedUnion('kind', [
    DiscountEffectSchema,
    TrialExtensionEffectSchema,
    CompEffectSchema
]);

/** TypeScript type inferred from {@link PromoEffectSchema} */
export type PromoEffect = z.infer<typeof PromoEffectSchema>;

// ---------------------------------------------------------------------------
// Validate / Apply schemas (unchanged)
// ---------------------------------------------------------------------------

/**
 * Schema for validating a promo code before checkout.
 * Accepts the code and optional context (userId, planId, amount) to check eligibility.
 *
 * NOTE: `userId` is required and `amount` is supported because the
 * `/promo-codes/validate` route enforces self-validation and previews the
 * discount for a given amount.
 */
export const ValidatePromoCodeSchema = z.object({
    /** The promo code string to validate */
    code: z
        .string({ message: 'zodError.billing.promoCode.validate.code.invalidType' })
        .min(1, { message: 'zodError.billing.promoCode.validate.code.min' }),
    /** Plan ID to check plan-specific restrictions */
    planId: z
        .string({ message: 'zodError.billing.promoCode.validate.planId.invalidType' })
        .uuid({ message: 'zodError.billing.promoCode.validate.planId.invalid' })
        .optional(),
    /** User ID the code is being validated for (enforced server-side) */
    userId: z
        .string({ message: 'zodError.billing.promoCode.validate.userId.invalidType' })
        .uuid({ message: 'zodError.billing.promoCode.validate.userId.invalid' }),
    /** Optional base amount in cents to preview the discount */
    amount: z
        .number({ message: 'zodError.billing.promoCode.validate.amount.invalidType' })
        .int({ message: 'zodError.billing.promoCode.validate.amount.int' })
        .positive({ message: 'zodError.billing.promoCode.validate.amount.positive' })
        .optional()
});

/** TypeScript type inferred from ValidatePromoCodeSchema */
export type ValidatePromoCode = z.infer<typeof ValidatePromoCodeSchema>;

/**
 * Schema for applying a promo code to an active checkout session.
 * Links the code to a specific billing customer and optionally a base amount.
 *
 * SPEC-262 T-008: the optional `subscriptionId` field enables the route handler
 * to detect an existing subscription with a live MercadoPago preapproval and
 * route the `discount` effect through the fail-closed T-007 seam
 * (`applyMultiCycleDiscountToExistingSubscription`) instead of the normal
 * checkout-signup path.
 */
export const ApplyPromoCodeSchema = z.object({
    /** The promo code to apply */
    code: z
        .string({ message: 'zodError.billing.promoCode.apply.code.invalidType' })
        .min(1, { message: 'zodError.billing.promoCode.apply.code.min' }),
    /** The billing customer ID to apply the code to */
    customerId: z
        .string({ message: 'zodError.billing.promoCode.apply.customerId.invalidType' })
        .uuid({ message: 'zodError.billing.promoCode.apply.customerId.invalid' }),
    /** Optional base amount in cents used to compute fixed discounts */
    amount: z
        .number({ message: 'zodError.billing.promoCode.apply.amount.invalidType' })
        .int({ message: 'zodError.billing.promoCode.apply.amount.int' })
        .min(0, { message: 'zodError.billing.promoCode.apply.amount.min' })
        .optional(),
    /**
     * Optional existing subscription ID.
     *
     * When supplied and the promo code has a `discount` effect, the route
     * handler checks whether the subscription has a live MercadoPago
     * `mp_subscription_id`. If so, the discount is applied through the
     * fail-closed T-007 seam (MP amount mutation first, redeem only on
     * success). If the subscription has no live preapproval (annual or
     * pre-checkout), the normal `applyPromoCode` path is used.
     *
     * Not required for checkout-signup flows where no subscription exists yet.
     */
    subscriptionId: z
        .string({ message: 'zodError.billing.promoCode.apply.subscriptionId.invalidType' })
        .uuid({ message: 'zodError.billing.promoCode.apply.subscriptionId.invalid' })
        .optional()
});

/** TypeScript type inferred from ApplyPromoCodeSchema */
export type ApplyPromoCode = z.infer<typeof ApplyPromoCodeSchema>;

// ---------------------------------------------------------------------------
// CreatePromoCodeSchema (admin create/edit INPUT)
// ---------------------------------------------------------------------------

/**
 * Schema for creating a new promo code (admin operation).
 *
 * This is the SINGLE SOURCE OF TRUTH for the create-promo-code request
 * contract. The `effect` field replaces the former flat `discountType` /
 * `discountValue` fields (SPEC-262 T-004) and carries a typed discriminated
 * union that the service persists to the new `effect_kind`, `value_kind`,
 * `duration_cycles`, and `extra_days` columns (added in extras/018).
 *
 * Dates are coerced from ISO strings so the route handler can forward `Date`
 * instances straight to the service.
 *
 * MIGRATION NOTE: The legacy `discountType` / `discountValue` flat fields are
 * REMOVED from this schema. The API route handler (`apps/api`) must be updated
 * to map `body.effect` to `CreatePromoCodeInput` (T-005 downstream task).
 */
export const CreatePromoCodeSchema = z.object({
    /** Unique promo code string (uppercased server-side) */
    code: z
        .string({ message: 'zodError.billing.promoCode.create.code.invalidType' })
        .min(3, { message: 'zodError.billing.promoCode.create.code.min' })
        .max(50, { message: 'zodError.billing.promoCode.create.code.max' })
        .regex(/^[A-Z0-9_-]+$/i, {
            message: 'zodError.billing.promoCode.create.code.format'
        }),
    /**
     * The typed promo effect.
     * Replaces the former flat `discountType` / `discountValue` fields.
     * See {@link PromoEffectSchema} for the three supported kinds and their
     * parameter invariants (AC-1.2, AC-1.3, AC-5.4).
     */
    effect: PromoEffectSchema,
    /** Optional human-readable description (stored in config) */
    description: z
        .string({ message: 'zodError.billing.promoCode.create.description.invalidType' })
        .max(500, { message: 'zodError.billing.promoCode.create.description.max' })
        .optional(),
    /** ISO 8601 datetime after which the code expires (maps to expires_at) */
    expiryDate: z.coerce
        .date({ message: 'zodError.billing.promoCode.create.expiryDate.invalid' })
        .optional(),
    /** ISO 8601 datetime before which the code is not yet valid (maps to starts_at) */
    validFrom: z.coerce
        .date({ message: 'zodError.billing.promoCode.create.validFrom.invalid' })
        .optional(),
    /** Maximum number of total redemptions across all users */
    maxUses: z
        .number({ message: 'zodError.billing.promoCode.create.maxUses.invalidType' })
        .int({ message: 'zodError.billing.promoCode.create.maxUses.int' })
        .positive({ message: 'zodError.billing.promoCode.create.maxUses.positive' })
        .optional(),
    /** Maximum number of redemptions per individual user (maps to max_uses_per_user) */
    maxUsesPerUser: z
        .number({ message: 'zodError.billing.promoCode.create.maxUsesPerUser.invalidType' })
        .int({ message: 'zodError.billing.promoCode.create.maxUsesPerUser.int' })
        .positive({ message: 'zodError.billing.promoCode.create.maxUsesPerUser.positive' })
        .optional(),
    /** Optional list of plan IDs this code is restricted to (maps to valid_plans) */
    planRestrictions: z
        .array(
            z
                .string({
                    message: 'zodError.billing.promoCode.create.planRestrictions.item.invalidType'
                })
                .min(1, {
                    message: 'zodError.billing.promoCode.create.planRestrictions.item.min'
                }),
            { message: 'zodError.billing.promoCode.create.planRestrictions.invalidType' }
        )
        .optional(),
    /** If true, the code can only be redeemed on a user's first purchase */
    firstPurchaseOnly: z
        .boolean({ message: 'zodError.billing.promoCode.create.firstPurchaseOnly.invalidType' })
        .optional(),
    /** If true, the code can be combined with other codes (maps to combinable) */
    isStackable: z
        .boolean({ message: 'zodError.billing.promoCode.create.isStackable.invalidType' })
        .optional(),
    /** Minimum order amount required to use the code, in cents (stored in config) */
    minAmount: z
        .number({ message: 'zodError.billing.promoCode.create.minAmount.invalidType' })
        .int({ message: 'zodError.billing.promoCode.create.minAmount.int' })
        .positive({ message: 'zodError.billing.promoCode.create.minAmount.positive' })
        .optional(),
    /** Whether the code is active on creation (default true) */
    isActive: z
        .boolean({ message: 'zodError.billing.promoCode.create.isActive.invalidType' })
        .optional()
});

/** TypeScript type inferred from CreatePromoCodeSchema */
export type CreatePromoCode = z.infer<typeof CreatePromoCodeSchema>;

/**
 * Alias matching the naming convention used by service-core and API route handlers.
 * Prefer this name in new code.
 */
export type CreatePromoCodeInput = CreatePromoCode;

// ---------------------------------------------------------------------------
// UpdatePromoCodeSchema (unchanged — effect is immutable once created)
// ---------------------------------------------------------------------------

/**
 * Schema for updating an existing promo code (admin operation).
 *
 * Only the mutable fields are accepted; `code`, `effect` and its parameters
 * are immutable once created. `strict()` rejects any attempt to update an
 * immutable or unknown field.
 */
export const UpdatePromoCodeSchema = z
    .object({
        description: z
            .string({ message: 'zodError.billing.promoCode.update.description.invalidType' })
            .max(500, { message: 'zodError.billing.promoCode.update.description.max' })
            .optional(),
        expiryDate: z.coerce
            .date({ message: 'zodError.billing.promoCode.update.expiryDate.invalid' })
            .optional(),
        maxUses: z
            .number({ message: 'zodError.billing.promoCode.update.maxUses.invalidType' })
            .int({ message: 'zodError.billing.promoCode.update.maxUses.int' })
            .positive({ message: 'zodError.billing.promoCode.update.maxUses.positive' })
            .optional(),
        isActive: z
            .boolean({ message: 'zodError.billing.promoCode.update.isActive.invalidType' })
            .optional()
    })
    .strict();

/** TypeScript type inferred from UpdatePromoCodeSchema */
export type UpdatePromoCode = z.infer<typeof UpdatePromoCodeSchema>;

// ---------------------------------------------------------------------------
// ListPromoCodesQuerySchema (unchanged)
// ---------------------------------------------------------------------------

/**
 * Query schema for listing promo codes (admin operation).
 */
export const ListPromoCodesQuerySchema = z.object({
    active: queryBooleanParam(),
    expired: queryBooleanParam(),
    codeSearch: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20)
});

/** TypeScript type inferred from ListPromoCodesQuerySchema */
export type ListPromoCodesQuery = z.infer<typeof ListPromoCodesQuerySchema>;

// ---------------------------------------------------------------------------
// PromoCodeResponseSchema (API response / admin hydration) — ADDITIVE ONLY
// ---------------------------------------------------------------------------

/**
 * Schema for a promo code returned by the API.
 *
 * BACKWARD-COMPAT CONTRACT (AC-4.3): the legacy response fields `type` and
 * `value` are PRESERVED so existing web + admin clients that consume
 * one-shot discount codes see an UNCHANGED shape. The new `effect` field is
 * ADDITIVE and optional — clients that are not yet aware of SPEC-262 can
 * safely ignore it.
 *
 * | Field | Status | Notes |
 * |-------|--------|-------|
 * | `type` | kept | `'percentage' \| 'fixed'` for discount codes; `'comp'` or `'trial_extension'` for the new kinds |
 * | `value` | kept | discount amount; 0 for non-discount kinds |
 * | `effect` | NEW (optional) | full typed effect object; absent until the migration populates the columns |
 *
 * Mirrors the `PromoCode` DTO produced by the service's `mapDbToPromoCode`.
 */
export const PromoCodeResponseSchema = z.object({
    id: z.string().uuid(),
    code: z.string(),
    /**
     * Legacy type field — kept for backward compat (AC-4.3).
     * For existing `percentage`/`fixed` codes this matches the DB `type` column.
     * For new SPEC-262 codes the service maps `effect_kind` to this field.
     */
    type: z
        .string()
        .refine((v) => ['percentage', 'fixed', 'discount', 'trial_extension', 'comp'].includes(v), {
            message: 'zodError.billing.promoCode.response.type.invalid'
        }),
    /** Discount value in centavos (or percentage integer). 0 for non-discount kinds. */
    value: z.number(),
    active: z.boolean(),
    expiresAt: z.string().datetime().optional(),
    validFrom: z.string().datetime().optional(),
    maxUses: z.number().optional(),
    maxUsesPerUser: z.number().optional(),
    timesRedeemed: z.number(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    validPlans: z.array(z.string()).optional(),
    newCustomersOnly: z.boolean().optional(),
    isStackable: z.boolean().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    /**
     * Full typed effect — NEW field (SPEC-262, optional for backward compat).
     *
     * Present on codes created or migrated after SPEC-262. Absent (`undefined`)
     * on legacy codes fetched before the backfill migration runs. Clients that
     * only need the one-shot discount amount can rely solely on `type` + `value`.
     */
    effect: PromoEffectSchema.optional()
});

/** TypeScript type inferred from PromoCodeResponseSchema */
export type PromoCodeResponse = z.infer<typeof PromoCodeResponseSchema>;

// ---------------------------------------------------------------------------
// ValidationResultSchema (unchanged)
// ---------------------------------------------------------------------------

/**
 * Result schema for a promo code validation check.
 */
export const ValidationResultSchema = z.object({
    valid: z.boolean(),
    errorCode: z.string().optional(),
    errorMessage: z.string().optional(),
    discountAmount: z.number().optional()
});

/** TypeScript type inferred from ValidationResultSchema */
export type ValidationResult = z.infer<typeof ValidationResultSchema>;
