import { z } from 'zod';

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
 * Accepts the code and optional context (userId, planId) to check eligibility.
 */
export const ValidatePromoCodeRequestSchema = z.object({
    /** The promo code string to validate */
    code: z
        .string({
            message: 'zodError.billing.promoCode.validate.code.invalidType'
        })
        .min(1, { message: 'zodError.billing.promoCode.validate.code.min' })
        .max(50, { message: 'zodError.billing.promoCode.validate.code.max' }),
    /** Optional user ID to check user-specific eligibility (e.g. first-purchase restriction) */
    userId: z
        .string({
            message: 'zodError.billing.promoCode.validate.userId.invalidType'
        })
        .min(1, { message: 'zodError.billing.promoCode.validate.userId.min' })
        .optional(),
    /** Optional plan ID to check plan-specific restrictions */
    planId: z
        .string({
            message: 'zodError.billing.promoCode.validate.planId.invalidType'
        })
        .min(1, { message: 'zodError.billing.promoCode.validate.planId.min' })
        .optional()
});

/** TypeScript type inferred from ValidatePromoCodeRequestSchema */
export type ValidatePromoCodeRequest = z.infer<typeof ValidatePromoCodeRequestSchema>;

/**
 * Schema for applying a promo code to an active checkout session.
 * Links the code to a specific checkout and optionally provides the base amount.
 */
export const ApplyPromoCodeRequestSchema = z.object({
    /** The promo code to apply */
    code: z
        .string({
            message: 'zodError.billing.promoCode.apply.code.invalidType'
        })
        .min(1, { message: 'zodError.billing.promoCode.apply.code.min' })
        .max(50, { message: 'zodError.billing.promoCode.apply.code.max' }),
    /** The billing customer ID to apply the code to */
    customerId: z
        .string({
            message: 'zodError.billing.promoCode.apply.customerId.invalidType'
        })
        .min(1, { message: 'zodError.billing.promoCode.apply.customerId.min' }),
    /** Optional base amount in ARS cents used to compute fixed discounts (must be a non-negative integer) */
    amount: z
        .number({
            message: 'zodError.billing.promoCode.apply.amount.invalidType'
        })
        .int({ message: 'zodError.billing.promoCode.apply.amount.int' })
        .min(0, { message: 'zodError.billing.promoCode.apply.amount.min' })
        .optional()
});

/** TypeScript type inferred from ApplyPromoCodeRequestSchema */
export type ApplyPromoCodeRequest = z.infer<typeof ApplyPromoCodeRequestSchema>;

/**
 * Schema for creating a new promo code (admin operation).
 * Defines the code string, discount rules, usage limits, and optional restrictions.
 */
export const CreatePromoCodeSchema = z.object({
    /** Unique promo code string (uppercase alphanumeric recommended) */
    code: z
        .string({
            message: 'zodError.billing.promoCode.create.code.invalidType'
        })
        .min(1, { message: 'zodError.billing.promoCode.create.code.min' })
        .max(50, { message: 'zodError.billing.promoCode.create.code.max' }),
    /** Whether the discount is a percentage or a fixed amount */
    discountType: PromoCodeDiscountTypeEnumSchema,
    /** The discount value — percentage (0-100) or fixed amount in ARS cents (positive integer, max 9999999 ≈ $99,999.99) */
    discountValue: z
        .number({
            message: 'zodError.billing.promoCode.create.discountValue.invalidType'
        })
        .int({ message: 'zodError.billing.promoCode.create.discountValue.int' })
        .positive({ message: 'zodError.billing.promoCode.create.discountValue.positive' })
        .max(9999999, { message: 'zodError.billing.promoCode.create.discountValue.max' }),
    /** Maximum number of total redemptions allowed across all users */
    maxUses: z
        .number({
            message: 'zodError.billing.promoCode.create.maxUses.invalidType'
        })
        .int({ message: 'zodError.billing.promoCode.create.maxUses.int' })
        .positive({ message: 'zodError.billing.promoCode.create.maxUses.positive' })
        .optional(),
    /** ISO 8601 datetime string after which the code expires */
    expiryDate: z
        .string({
            message: 'zodError.billing.promoCode.create.expiryDate.invalidType'
        })
        .datetime({ message: 'zodError.billing.promoCode.create.expiryDate.invalid' })
        .optional(),
    /** Optional list of plan IDs this code is restricted to */
    planRestrictions: z
        .array(
            z
                .string({
                    message: 'zodError.billing.promoCode.create.planRestrictions.item.invalidType'
                })
                .min(1, {
                    message: 'zodError.billing.promoCode.create.planRestrictions.item.min'
                }),
            {
                message: 'zodError.billing.promoCode.create.planRestrictions.invalidType'
            }
        )
        .optional(),
    /** If true, the code can only be redeemed on a user's first purchase */
    firstPurchaseOnly: z
        .boolean({
            message: 'zodError.billing.promoCode.create.firstPurchaseOnly.invalidType'
        })
        .optional()
});

/** TypeScript type inferred from CreatePromoCodeSchema */
export type CreatePromoCode = z.infer<typeof CreatePromoCodeSchema>;
