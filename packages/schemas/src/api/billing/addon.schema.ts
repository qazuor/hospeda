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
import { queryBooleanParam } from '../../common/query-helpers.js';

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
    /** The addon order ID (format: addon_<slug>_<uuid>; SPEC-109 fix #5/#6
     * switched the suffix from epoch-ms to a v4 UUID so MP's
     * X-Idempotency-Key can re-use it. The regex permits either shape to
     * stay backwards-compatible with any historical timestamp-format ids
     * that may still live in audit logs or external references. */
    orderId: z.string().regex(/^addon_[\w-]+_[\w-]+$/, 'Invalid addon order ID format'),
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
    status: z.enum(['active', 'expired', 'canceled', 'pending']),
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
    active: queryBooleanParam()
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

// ─── Admin CRUD Schemas ──────────────────────────────────────────────────────

/**
 * Schema for creating a new add-on (admin operation).
 *
 * SINGLE SOURCE OF TRUTH for the create-addon request contract. All fields
 * correspond directly to the `billing_addons` DB columns defined in SPEC-192.
 *
 * `slug` is WRITE-ONCE: accepted here on creation but absent from
 * {@link UpdateAddonSchema} because subscription records reference addons by
 * their slug and renaming would break historical references.
 *
 * `priceArs` is stored as integer centavos (e.g. 100000 = $1000 ARS) — never
 * use floats for money.
 */
export const CreateAddonSchema = z
    .object({
        /**
         * Unique add-on slug — stored as `billing_addons.slug`. Immutable after
         * creation.
         */
        slug: z
            .string({ message: 'validation.billing.addon.create.slug.invalidType' })
            .min(2, { message: 'validation.billing.addon.create.slug.min' })
            .max(60, { message: 'validation.billing.addon.create.slug.max' })
            .regex(/^[a-z0-9-]+$/, { message: 'validation.billing.addon.create.slug.format' }),
        /** Human-readable display name */
        name: z
            .string({ message: 'validation.billing.addon.create.name.invalidType' })
            .min(1, { message: 'validation.billing.addon.create.name.min' })
            .max(120, { message: 'validation.billing.addon.create.name.max' }),
        /** Add-on description */
        description: z
            .string({ message: 'validation.billing.addon.create.description.invalidType' })
            .max(1000, { message: 'validation.billing.addon.create.description.max' }),
        /** Whether this is a one-time purchase or a recurring subscription */
        billingType: AddonBillingTypeSchema,
        /** Price in ARS cents — must be a positive integer (never use floats for money) */
        priceArs: z
            .number({ message: 'validation.billing.addon.create.priceArs.invalidType' })
            .int({ message: 'validation.billing.addon.create.priceArs.int' })
            .positive({ message: 'validation.billing.addon.create.priceArs.positive' }),
        /**
         * Duration in days for one-time addons. `null` for recurring addons
         * (they remain active until canceled/expired).
         */
        durationDays: z
            .number({ message: 'validation.billing.addon.create.durationDays.invalidType' })
            .int({ message: 'validation.billing.addon.create.durationDays.int' })
            .positive({ message: 'validation.billing.addon.create.durationDays.positive' })
            .nullable(),
        /**
         * The limit key this addon affects (e.g. `"maxListings"`). `null` when
         * the addon does not modify any quota.
         */
        affectsLimitKey: z
            .string({ message: 'validation.billing.addon.create.affectsLimitKey.invalidType' })
            .min(1, { message: 'validation.billing.addon.create.affectsLimitKey.min' })
            .nullable(),
        /**
         * How much to increase the limit identified by `affectsLimitKey`. `null`
         * when `affectsLimitKey` is null.
         */
        limitIncrease: z
            .number({ message: 'validation.billing.addon.create.limitIncrease.invalidType' })
            .int({ message: 'validation.billing.addon.create.limitIncrease.int' })
            .positive({ message: 'validation.billing.addon.create.limitIncrease.positive' })
            .nullable(),
        /**
         * Entitlement key unlocked by this addon (e.g. `"featured_listing"`).
         * `null` when the addon does not grant an entitlement.
         */
        grantsEntitlement: z
            .string({ message: 'validation.billing.addon.create.grantsEntitlement.invalidType' })
            .min(1, { message: 'validation.billing.addon.create.grantsEntitlement.min' })
            .nullable(),
        /** Plan categories that may purchase this addon (`owner`, `complex`) */
        targetCategories: z
            .array(AddonTargetCategorySchema, {
                message: 'validation.billing.addon.create.targetCategories.invalidType'
            })
            .min(1, { message: 'validation.billing.addon.create.targetCategories.min' }),
        /** Whether the addon is currently available for purchase */
        isActive: z.boolean({ message: 'validation.billing.addon.create.isActive.invalidType' }),
        /** Display sort order (non-negative integer) */
        sortOrder: z
            .number({ message: 'validation.billing.addon.create.sortOrder.invalidType' })
            .int({ message: 'validation.billing.addon.create.sortOrder.int' })
            .min(0, { message: 'validation.billing.addon.create.sortOrder.min' })
    })
    .strict();

/** TypeScript type inferred from {@link CreateAddonSchema} */
export type CreateAddon = z.infer<typeof CreateAddonSchema>;

/**
 * Schema for updating an existing add-on (admin operation, PATCH semantics).
 *
 * Every field is optional. `slug` is intentionally absent — it is immutable
 * after creation. `.strict()` rejects any attempt to pass `slug`.
 */
export const UpdateAddonSchema = z
    .object({
        /** Human-readable display name */
        name: z
            .string({ message: 'validation.billing.addon.update.name.invalidType' })
            .min(1, { message: 'validation.billing.addon.update.name.min' })
            .max(120, { message: 'validation.billing.addon.update.name.max' })
            .optional(),
        /** Add-on description */
        description: z
            .string({ message: 'validation.billing.addon.update.description.invalidType' })
            .max(1000, { message: 'validation.billing.addon.update.description.max' })
            .optional(),
        /** Whether this is a one-time purchase or a recurring subscription */
        billingType: AddonBillingTypeSchema.optional(),
        /** Price in ARS cents (positive integer) */
        priceArs: z
            .number({ message: 'validation.billing.addon.update.priceArs.invalidType' })
            .int({ message: 'validation.billing.addon.update.priceArs.int' })
            .positive({ message: 'validation.billing.addon.update.priceArs.positive' })
            .optional(),
        /** Duration in days for one-time addons (null for recurring) */
        durationDays: z
            .number({ message: 'validation.billing.addon.update.durationDays.invalidType' })
            .int({ message: 'validation.billing.addon.update.durationDays.int' })
            .positive({ message: 'validation.billing.addon.update.durationDays.positive' })
            .nullable()
            .optional(),
        /** The limit key this addon affects (null when not applicable) */
        affectsLimitKey: z
            .string({ message: 'validation.billing.addon.update.affectsLimitKey.invalidType' })
            .min(1, { message: 'validation.billing.addon.update.affectsLimitKey.min' })
            .nullable()
            .optional(),
        /** How much to increase the limit (null when not applicable) */
        limitIncrease: z
            .number({ message: 'validation.billing.addon.update.limitIncrease.invalidType' })
            .int({ message: 'validation.billing.addon.update.limitIncrease.int' })
            .positive({ message: 'validation.billing.addon.update.limitIncrease.positive' })
            .nullable()
            .optional(),
        /** Entitlement key unlocked by this addon (null when not applicable) */
        grantsEntitlement: z
            .string({ message: 'validation.billing.addon.update.grantsEntitlement.invalidType' })
            .min(1, { message: 'validation.billing.addon.update.grantsEntitlement.min' })
            .nullable()
            .optional(),
        /** Plan categories that may purchase this addon */
        targetCategories: z
            .array(AddonTargetCategorySchema, {
                message: 'validation.billing.addon.update.targetCategories.invalidType'
            })
            .min(1, { message: 'validation.billing.addon.update.targetCategories.min' })
            .optional(),
        /** Whether the addon is currently available for purchase */
        isActive: z
            .boolean({ message: 'validation.billing.addon.update.isActive.invalidType' })
            .optional(),
        /** Display sort order */
        sortOrder: z
            .number({ message: 'validation.billing.addon.update.sortOrder.invalidType' })
            .int({ message: 'validation.billing.addon.update.sortOrder.int' })
            .min(0, { message: 'validation.billing.addon.update.sortOrder.min' })
            .optional()
    })
    .strict();

/** TypeScript type inferred from {@link UpdateAddonSchema} */
export type UpdateAddon = z.infer<typeof UpdateAddonSchema>;

/**
 * Query schema for listing/searching add-ons (admin operation).
 *
 * Uses `page` + `pageSize` pagination — NOT `limit` — consistent with all
 * other admin list routes in this project (see `BillingPlanSearchSchema`).
 */
export const AdminAddonListQuerySchema = z.object({
    /** Filter by billing type */
    billingType: AddonBillingTypeSchema.optional(),
    /** Filter by a single target category */
    targetCategory: AddonTargetCategorySchema.optional(),
    /** Filter by active flag (coerced from query-string `"true"` / `"false"`) */
    isActive: queryBooleanParam(),
    /**
     * When true, soft-deleted addons (`deletedAt IS NOT NULL`) are included in
     * the result. Defaults to excluding them. Admin-only.
     */
    includeDeleted: queryBooleanParam(),
    /** Free-text search over slug/name */
    search: z.string().optional(),
    /** Page number (1-based) */
    page: z.coerce.number().int().positive().default(1),
    /** Number of records per page (max 100) */
    pageSize: z.coerce.number().int().positive().max(100).default(20)
});

/** TypeScript type inferred from {@link AdminAddonListQuerySchema} */
export type AdminAddonListQuery = z.infer<typeof AdminAddonListQuerySchema>;

/**
 * Admin-facing response schema for a single add-on row.
 *
 * Extends {@link AddonResponseSchema} (the public catalog shape) with the DB
 * primary key (`id` UUID) and full timestamps including `deletedAt`. The
 * public schema omits `id` and `deletedAt`; this DTO surfaces them so the
 * admin UI can perform mutations by UUID and show soft-delete state.
 *
 * Mirrors the convention in {@link AdminBillingPlanResponseSchema} (billing-plan.schema.ts).
 */
export const AdminAddonResponseSchema = AddonResponseSchema.extend({
    /** DB primary key (UUID) — the mutation identifier for admin operations */
    id: z.string().uuid(),
    /** ISO 8601 creation timestamp */
    createdAt: z.string().datetime(),
    /** ISO 8601 last-update timestamp */
    updatedAt: z.string().datetime(),
    /**
     * ISO 8601 soft-delete timestamp. `null` when the addon is not deleted.
     * Exposed only in admin responses — never leaked to the public endpoint.
     */
    deletedAt: z.string().datetime().nullable()
});

/** TypeScript type inferred from {@link AdminAddonResponseSchema} */
export type AdminAddonResponse = z.infer<typeof AdminAddonResponseSchema>;

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
