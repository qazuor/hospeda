/**
 * Add-on API Schemas (Consolidated)
 *
 * Single source of truth for all add-on validation schemas.
 * Used by API routes, admin panel, and web app.
 *
 * Covers:
 * - Listing available add-ons
 * - Purchasing add-ons (one-time and recurring)
 * - Managing user's active add-ons
 * - Canceling recurring add-ons
 *
 * @module schemas/api/billing/addon
 */

import { z } from 'zod';

// ─── Enums ──────────────────────────────────────────────────────────────────

/** Add-on billing type enum */
export const AddonBillingTypeSchema = z.enum(['one_time', 'recurring']);

/** Add-on target category enum */
export const AddonTargetCategorySchema = z.enum(['owner', 'complex']);

// ─── Purchase Request/Response ──────────────────────────────────────────────

/**
 * Purchase add-on request schema.
 * Uses `addonId` as the identifier for the add-on to purchase.
 */
export const PurchaseAddonSchema = z.object({
    /** The identifier of the addon to purchase */
    addonId: z
        .string({ message: 'validation.billing.addon.purchase.addonId.invalidType' })
        .min(1, { message: 'validation.billing.addon.purchase.addonId.min' }),
    /** Optional promo code to apply at checkout */
    promoCode: z
        .string({ message: 'validation.billing.addon.purchase.promoCode.invalidType' })
        .min(1, { message: 'validation.billing.addon.purchase.promoCode.min' })
        .max(50, { message: 'validation.billing.addon.purchase.promoCode.max' })
        .optional()
});

/**
 * Purchase add-on response schema.
 * Returns the checkout URL for Mercado Pago payment.
 */
export const PurchaseAddonResponseSchema = z.object({
    /** The checkout URL to redirect the user to */
    checkoutUrl: z.string().url('Invalid checkout URL'),
    /** The addon order ID (format: addon_<slug>_<timestamp>) */
    orderId: z.string().regex(/^addon_[\w-]+_\d+$/, 'Invalid addon order ID format'),
    /** The addon identifier */
    addonId: z.string(),
    /** Amount in ARS cents */
    amount: z.number().int().positive(),
    /** Currency code (defaults to ARS) */
    currency: z.string().default('ARS'),
    /** Checkout session expiration */
    expiresAt: z.string().datetime()
});

// ─── Addon Definition Response ──────────────────────────────────────────────

/** Add-on details response schema (for catalog/definition endpoints) */
export const AddonResponseSchema = z.object({
    /** Unique addon slug identifier */
    slug: z.string(),
    /** Display name */
    name: z.string(),
    /** Description of the addon */
    description: z.string(),
    /** Billing type (one_time or recurring) */
    billingType: AddonBillingTypeSchema,
    /** Price in ARS cents */
    priceArs: z.number().int().positive(),
    /** Duration in days for one-time addons (null for recurring) */
    durationDays: z.number().int().positive().nullable(),
    /** Limit key this addon affects (if any) */
    affectsLimitKey: z.string().nullable(),
    /** How much to increase the limit */
    limitIncrease: z.number().int().positive().nullable(),
    /** Entitlement key this addon grants (if any) */
    grantsEntitlement: z.string().nullable(),
    /** Target plan categories that can purchase this addon */
    targetCategories: z.array(AddonTargetCategorySchema),
    /** Whether the addon is currently available */
    isActive: z.boolean(),
    /** Sort order for display */
    sortOrder: z.number().int()
});

// ─── User Addon Response ────────────────────────────────────────────────────

/** User's active add-on response schema */
export const UserAddonResponseSchema = z.object({
    /** Purchase record UUID */
    id: z.string().uuid(),
    /** The addon slug */
    addonSlug: z.string(),
    /** The addon display name */
    addonName: z.string(),
    /** Billing type */
    billingType: AddonBillingTypeSchema,
    /** Current status */
    status: z.enum(['active', 'expired', 'canceled']),
    /** When the addon was purchased */
    purchasedAt: z.string().datetime(),
    /** When the addon expires (null for recurring) */
    expiresAt: z.string().datetime().nullable(),
    /** When the addon was canceled (null if not canceled) */
    canceledAt: z.string().datetime().nullable(),
    /** Price in ARS cents */
    priceArs: z.number().int().positive(),
    /** Limit key affected */
    affectsLimitKey: z.string().nullable(),
    /** Limit increase amount */
    limitIncrease: z.number().int().positive().nullable(),
    /** Entitlement granted */
    grantsEntitlement: z.string().nullable()
});

// ─── Query Schemas ──────────────────────────────────────────────────────────

/** List add-ons query schema */
export const ListAddonsQuerySchema = z.object({
    /** Filter by billing type */
    billingType: AddonBillingTypeSchema.optional(),
    /** Filter by target category */
    targetCategory: AddonTargetCategorySchema.optional(),
    /** Filter by active status */
    active: z
        .string()
        .optional()
        .transform((val) => val === 'true')
});

/** Cancel add-on request schema */
export const CancelAddonSchema = z.object({
    /** Optional reason for cancellation */
    reason: z
        .string({ message: 'validation.billing.addon.cancel.reason.invalidType' })
        .max(500, { message: 'validation.billing.addon.cancel.reason.max' })
        .optional()
});

// ─── Legacy Compat: PurchaseAddonRequestSchema (alias) ──────────────────────

/**
 * @deprecated Use PurchaseAddonSchema instead.
 * Kept for backward compatibility with existing @repo/schemas consumers.
 */
export const PurchaseAddonRequestSchema = PurchaseAddonSchema;

/**
 * @deprecated Use CancelAddon type instead.
 * Kept for backward compatibility with existing @repo/schemas consumers.
 */
export const CancelAddonRequestSchema = CancelAddonSchema;

// ─── Type Exports ───────────────────────────────────────────────────────────

/** TypeScript type inferred from PurchaseAddonSchema */
export type PurchaseAddon = z.infer<typeof PurchaseAddonSchema>;

/** @deprecated Use PurchaseAddon instead */
export type PurchaseAddonRequest = z.infer<typeof PurchaseAddonRequestSchema>;

/** TypeScript type inferred from PurchaseAddonResponseSchema */
export type PurchaseAddonResponse = z.infer<typeof PurchaseAddonResponseSchema>;

/** TypeScript type inferred from AddonResponseSchema */
export type AddonResponse = z.infer<typeof AddonResponseSchema>;

/** TypeScript type inferred from UserAddonResponseSchema */
export type UserAddonResponse = z.infer<typeof UserAddonResponseSchema>;

/** TypeScript type inferred from ListAddonsQuerySchema */
export type ListAddonsQuery = z.infer<typeof ListAddonsQuerySchema>;

/** TypeScript type inferred from CancelAddonSchema */
export type CancelAddon = z.infer<typeof CancelAddonSchema>;

/** @deprecated Use CancelAddon instead */
export type CancelAddonRequest = z.infer<typeof CancelAddonRequestSchema>;
