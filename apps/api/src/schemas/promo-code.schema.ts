/**
 * Promo Code API Schemas
 *
 * Zod validation schemas for promo code API endpoints.
 * Provides request and response validation for:
 * - Creating promo codes
 * - Updating promo codes
 * - Validating promo codes
 * - Applying promo codes to checkout
 *
 * @module schemas/promo-code
 */

import { z } from 'zod';

/**
 * Discount type enum
 */
export const DiscountTypeSchema = z.enum(['percentage', 'fixed']);

/**
 * Create promo code request schema
 */
export const CreatePromoCodeSchema = z
    .object({
        code: z
            .string()
            .min(3, 'Code must be at least 3 characters')
            .max(50, 'Code must be at most 50 characters')
            .regex(
                /^[A-Z0-9_-]+$/i,
                'Code must contain only letters, numbers, underscores, and hyphens'
            ),
        discountType: DiscountTypeSchema,
        discountValue: z
            .number()
            .positive('Discount value must be positive')
            .refine((val) => val > 0, { message: 'Discount value must be greater than 0' }),
        description: z.string().optional(),
        expiryDate: z.coerce.date().optional(),
        maxUses: z.number().int().positive().optional(),
        planRestrictions: z.array(z.string().uuid()).optional(),
        firstPurchaseOnly: z.boolean().default(false),
        minAmount: z.number().int().positive().optional(),
        isActive: z.boolean().default(true)
    })
    .refine(
        (data) => {
            // If discount type is percentage, value must be between 0-100
            if (data.discountType === 'percentage') {
                return data.discountValue <= 100;
            }
            return true;
        },
        {
            message: 'Percentage discount must be between 0 and 100',
            path: ['discountValue']
        }
    );

/**
 * Update promo code request schema
 */
export const UpdatePromoCodeSchema = z
    .object({
        description: z.string().optional(),
        expiryDate: z.coerce.date().optional(),
        maxUses: z.number().int().positive().optional(),
        isActive: z.boolean().optional()
    })
    .strict(); // Don't allow updating code, discountType, or discountValue

/**
 * List promo codes query schema
 */
export const ListPromoCodesQuerySchema = z.object({
    active: z
        .string()
        .optional()
        .transform((val) => val === 'true'),
    expired: z
        .string()
        .optional()
        .transform((val) => val === 'true'),
    codeSearch: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20)
});

/**
 * Validate promo code request schema
 */
export const ValidatePromoCodeSchema = z.object({
    code: z.string().min(1, 'Code is required'),
    planId: z.string().uuid().optional(),
    userId: z.string().uuid('Invalid user ID'),
    amount: z.number().int().positive().optional()
});

/**
 * Apply promo code request schema
 */
export const ApplyPromoCodeSchema = z.object({
    code: z.string().min(1, 'Code is required'),
    customerId: z.string().uuid('Invalid customer ID'),
    amount: z.number().int().positive().optional()
});

/**
 * Promo code response schema
 */
export const PromoCodeResponseSchema = z.object({
    id: z.string().uuid(),
    code: z.string(),
    discountType: DiscountTypeSchema,
    discountValue: z.number(),
    description: z.string().nullable(),
    expiresAt: z.string().datetime().nullable(),
    maxRedemptions: z.number().nullable(),
    redemptionCount: z.number(),
    restrictions: z
        .object({
            plans: z.array(z.string()).nullable(),
            firstPurchaseOnly: z.boolean(),
            minimumAmount: z.number().nullable()
        })
        .nullable(),
    active: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    deletedAt: z.string().datetime().nullable()
});

/**
 * Validation result response schema
 */
export const ValidationResultSchema = z.object({
    valid: z.boolean(),
    errorCode: z.string().optional(),
    errorMessage: z.string().optional(),
    discountAmount: z.number().optional()
});

/**
 * Type exports
 */
export type CreatePromoCode = z.infer<typeof CreatePromoCodeSchema>;
export type UpdatePromoCode = z.infer<typeof UpdatePromoCodeSchema>;
export type ListPromoCodesQuery = z.infer<typeof ListPromoCodesQuerySchema>;
export type ValidatePromoCode = z.infer<typeof ValidatePromoCodeSchema>;
export type ApplyPromoCode = z.infer<typeof ApplyPromoCodeSchema>;
export type PromoCodeResponse = z.infer<typeof PromoCodeResponseSchema>;
export type ValidationResult = z.infer<typeof ValidationResultSchema>;
