import { z } from 'zod';
import { queryBooleanParam } from '../../common/query-helpers.js';

/**
 * Discount type enum for promo codes.
 * Defines whether the discount is a percentage off or a fixed amount.
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
        .optional()
});

/** TypeScript type inferred from ApplyPromoCodeSchema */
export type ApplyPromoCode = z.infer<typeof ApplyPromoCodeSchema>;

/**
 * Schema for creating a new promo code (admin operation).
 *
 * This is the SINGLE SOURCE OF TRUTH for the create-promo-code request
 * contract. It mirrors the full set of fields the service persists
 * (`CreatePromoCodeInput` in @repo/service-core), which in turn map 1:1 to
 * the qzpay `billing_promo_codes` columns. Dates are coerced from ISO strings
 * so the route handler can forward `Date` instances straight to the service.
 */
export const CreatePromoCodeSchema = z
    .object({
        /** Unique promo code string (uppercased server-side) */
        code: z
            .string({ message: 'zodError.billing.promoCode.create.code.invalidType' })
            .min(3, { message: 'zodError.billing.promoCode.create.code.min' })
            .max(50, { message: 'zodError.billing.promoCode.create.code.max' })
            .regex(/^[A-Z0-9_-]+$/i, {
                message: 'zodError.billing.promoCode.create.code.format'
            }),
        /** Whether the discount is a percentage or a fixed amount */
        discountType: PromoCodeDiscountTypeEnumSchema,
        /** Discount value — percentage (1-100) or fixed amount in cents (positive int) */
        discountValue: z
            .number({ message: 'zodError.billing.promoCode.create.discountValue.invalidType' })
            .int({ message: 'zodError.billing.promoCode.create.discountValue.int' })
            .positive({ message: 'zodError.billing.promoCode.create.discountValue.positive' })
            .max(9999999, { message: 'zodError.billing.promoCode.create.discountValue.max' }),
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
                        message:
                            'zodError.billing.promoCode.create.planRestrictions.item.invalidType'
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
    })
    .refine(
        (data) =>
            data.discountType !== PromoCodeDiscountTypeEnum.PERCENTAGE || data.discountValue <= 100,
        {
            message: 'zodError.billing.promoCode.create.discountValue.percentageMax',
            path: ['discountValue']
        }
    );

/** TypeScript type inferred from CreatePromoCodeSchema */
export type CreatePromoCode = z.infer<typeof CreatePromoCodeSchema>;

/**
 * Schema for updating an existing promo code (admin operation).
 *
 * Only the mutable fields are accepted; `code`, `discountType`, and
 * `discountValue` are immutable once created. `strict()` rejects any attempt
 * to update an immutable or unknown field.
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

/**
 * Response schema for a promo code returned by the API.
 *
 * Mirrors the `PromoCode` DTO produced by the service's `mapDbToPromoCode`.
 */
export const PromoCodeResponseSchema = z.object({
    id: z.string().uuid(),
    code: z.string(),
    type: PromoCodeDiscountTypeEnumSchema,
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
    updatedAt: z.string().datetime()
});

/** TypeScript type inferred from PromoCodeResponseSchema */
export type PromoCodeResponse = z.infer<typeof PromoCodeResponseSchema>;

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
