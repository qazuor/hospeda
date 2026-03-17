/**
 * Add-on Service Types
 *
 * Shared types and interfaces for add-on service modules.
 *
 * @module services/addon.types
 */

import { z } from 'zod';

/**
 * Discriminated union result type for add-on service methods.
 *
 * Aligns with the `ServiceOutput<T>` pattern from `@repo/service-core` but uses
 * `success` as the discriminant and keeps string error codes (addon services use
 * custom codes like 'CHECKOUT_ERROR', 'ADDON_INACTIVE', etc., not `ServiceErrorCode`).
 *
 * Type narrowing example:
 * ```ts
 * const result = await service.listAvailable();
 * if (result.success) {
 *   result.data; // T -- guaranteed present
 * } else {
 *   result.error; // { code: string; message: string } -- guaranteed present
 * }
 * ```
 *
 * TODO: Migrate addon services to extend BaseCrudService from `@repo/service-core`
 * once addon domain has a proper DB model layer. At that point this type should be
 * replaced by `ServiceOutput<T>`.
 */
export type ServiceResult<T> =
    | { readonly success: true; readonly data: T; readonly error?: never }
    | {
          readonly success: false;
          readonly data?: never;
          readonly error: { readonly code: string; readonly message: string };
      };

/**
 * List available add-ons input
 */
export interface ListAvailableAddonsInput {
    /** Filter by billing type */
    billingType?: 'one_time' | 'recurring';
    /** Filter by target category (owner/complex) */
    targetCategory?: 'owner' | 'complex';
    /** Filter by active status */
    active?: boolean;
}

/**
 * Purchase add-on input
 */
export interface PurchaseAddonInput {
    /** User's billing customer ID */
    customerId: string;
    /** Add-on slug to purchase */
    addonSlug: string;
    /** Optional promo code */
    promoCode?: string;
    /** User ID for tracking */
    userId: string;
}

/**
 * Purchase add-on result
 */
export interface PurchaseAddonResult {
    /** Checkout URL to redirect user to Mercado Pago */
    checkoutUrl: string;
    /** Order/checkout session ID */
    orderId: string;
    /** Add-on slug */
    addonId: string;
    /** Amount in cents (ARS) */
    amount: number;
    /** Currency code */
    currency: string;
    /** Checkout expiration timestamp */
    expiresAt: string;
}

/**
 * User add-on (active purchase)
 */
export interface UserAddon {
    id: string;
    addonSlug: string;
    addonName: string;
    billingType: 'one_time' | 'recurring';
    status: 'active' | 'expired' | 'canceled';
    purchasedAt: string;
    expiresAt: string | null;
    canceledAt: string | null;
    priceArs: number;
    affectsLimitKey: string | null;
    limitIncrease: number | null;
    grantsEntitlement: string | null;
}

/**
 * Cancel add-on input
 */
export interface CancelAddonInput {
    /** User's billing customer ID */
    customerId: string;
    /**
     * UUID of the billing_addon_purchases record to cancel.
     * This is the primary key used for the WHERE clause on the UPDATE query.
     */
    purchaseId: string;
    /** Optional cancellation reason */
    reason?: string;
    /** User ID for tracking */
    userId: string;
}

/**
 * Confirm add-on purchase input
 */
export interface ConfirmPurchaseInput {
    /** Customer ID */
    customerId: string;
    /** Add-on slug */
    addonSlug: string;
    /** Payment ID from Mercado Pago */
    paymentId?: string;
    /** Subscription ID */
    subscriptionId?: string;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
}

/**
 * Schema for validating addon adjustment metadata from JSON.
 * Used for backward compatibility with JSON-stored addon data.
 */
export const addonAdjustmentSchema = z.object({
    addonSlug: z.string(),
    limitKey: z.string().optional().nullable(),
    limitIncrease: z.number().optional().nullable(),
    entitlement: z.string().optional().nullable(),
    appliedAt: z
        .string()
        .datetime({ message: 'appliedAt must be a valid ISO 8601 datetime string' })
});

/**
 * Schema for an array of addon adjustments.
 */
export const addonAdjustmentsArraySchema = z.array(addonAdjustmentSchema);

/**
 * Inferred type from addonAdjustmentSchema.
 */
export type AddonAdjustment = z.infer<typeof addonAdjustmentSchema>;
