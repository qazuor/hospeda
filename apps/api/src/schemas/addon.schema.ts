/**
 * Add-on API Schemas
 *
 * Zod validation schemas for add-on API endpoints.
 * Provides request and response validation for:
 * - Listing available add-ons
 * - Purchasing add-ons (one-time and recurring)
 * - Managing user's active add-ons
 * - Canceling recurring add-ons
 *
 * @module schemas/addon
 */

import { z } from 'zod';

/**
 * Add-on billing type enum
 */
export const AddonBillingTypeSchema = z.enum(['one_time', 'recurring']);

/**
 * Add-on target category enum
 */
export const AddonTargetCategorySchema = z.enum(['owner', 'complex']);

/**
 * Purchase add-on request schema
 */
export const PurchaseAddonSchema = z.object({
    addonId: z.string().min(1, 'Add-on ID is required'),
    promoCode: z.string().optional()
});

/**
 * Purchase add-on response schema
 * Returns the checkout URL for Mercado Pago payment
 */
export const PurchaseAddonResponseSchema = z.object({
    checkoutUrl: z.string().url('Invalid checkout URL'),
    orderId: z.string().uuid('Invalid order ID'),
    addonId: z.string(),
    amount: z.number().int().positive(),
    currency: z.string().default('ARS'),
    expiresAt: z.string().datetime()
});

/**
 * Add-on details response schema
 */
export const AddonResponseSchema = z.object({
    slug: z.string(),
    name: z.string(),
    description: z.string(),
    billingType: AddonBillingTypeSchema,
    priceArs: z.number().int().positive(),
    durationDays: z.number().int().positive().nullable(),
    affectsLimitKey: z.string().nullable(),
    limitIncrease: z.number().int().positive().nullable(),
    grantsEntitlement: z.string().nullable(),
    targetCategories: z.array(AddonTargetCategorySchema),
    isActive: z.boolean(),
    sortOrder: z.number().int()
});

/**
 * User's active add-on response schema
 */
export const UserAddonResponseSchema = z.object({
    id: z.string().uuid(),
    addonSlug: z.string(),
    addonName: z.string(),
    billingType: AddonBillingTypeSchema,
    status: z.enum(['active', 'expired', 'canceled']),
    purchasedAt: z.string().datetime(),
    expiresAt: z.string().datetime().nullable(),
    canceledAt: z.string().datetime().nullable(),
    // Additional metadata
    priceArs: z.number().int().positive(),
    affectsLimitKey: z.string().nullable(),
    limitIncrease: z.number().int().positive().nullable(),
    grantsEntitlement: z.string().nullable()
});

/**
 * List add-ons query schema
 */
export const ListAddonsQuerySchema = z.object({
    billingType: AddonBillingTypeSchema.optional(),
    targetCategory: AddonTargetCategorySchema.optional(),
    active: z
        .string()
        .optional()
        .transform((val) => val === 'true')
});

/**
 * Cancel add-on request schema
 */
export const CancelAddonSchema = z.object({
    reason: z.string().max(500, 'Reason must be at most 500 characters').optional()
});

/**
 * Type exports
 */
export type PurchaseAddon = z.infer<typeof PurchaseAddonSchema>;
export type PurchaseAddonResponse = z.infer<typeof PurchaseAddonResponseSchema>;
export type AddonResponse = z.infer<typeof AddonResponseSchema>;
export type UserAddonResponse = z.infer<typeof UserAddonResponseSchema>;
export type ListAddonsQuery = z.infer<typeof ListAddonsQuerySchema>;
export type CancelAddon = z.infer<typeof CancelAddonSchema>;
