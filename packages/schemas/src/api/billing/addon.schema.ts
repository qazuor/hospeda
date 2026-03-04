import { z } from 'zod';

/**
 * Schema for purchasing a billing addon.
 * Validates the request body when a user purchases an addon by slug.
 */
export const PurchaseAddonRequestSchema = z.object({
    /** The slug identifier of the addon to purchase */
    slug: z
        .string({
            message: 'zodError.billing.addon.purchase.slug.invalidType'
        })
        .min(1, { message: 'zodError.billing.addon.purchase.slug.min' })
        .max(100, { message: 'zodError.billing.addon.purchase.slug.max' }),
    /** Optional promo code to apply at checkout */
    promoCode: z
        .string({
            message: 'zodError.billing.addon.purchase.promoCode.invalidType'
        })
        .min(1, { message: 'zodError.billing.addon.purchase.promoCode.min' })
        .max(50, { message: 'zodError.billing.addon.purchase.promoCode.max' })
        .optional()
});

/** TypeScript type inferred from PurchaseAddonRequestSchema */
export type PurchaseAddonRequest = z.infer<typeof PurchaseAddonRequestSchema>;

/**
 * Schema for cancelling an active addon subscription.
 * Validates the optional cancellation reason provided by the user.
 */
export const CancelAddonRequestSchema = z.object({
    /** Optional reason for cancelling the addon */
    reason: z
        .string({
            message: 'zodError.billing.addon.cancel.reason.invalidType'
        })
        .min(1, { message: 'zodError.billing.addon.cancel.reason.min' })
        .max(500, { message: 'zodError.billing.addon.cancel.reason.max' })
        .optional()
});

/** TypeScript type inferred from CancelAddonRequestSchema */
export type CancelAddonRequest = z.infer<typeof CancelAddonRequestSchema>;

/**
 * Schema for querying the list of available addons.
 * Supports filtering by billing type and free-text search.
 */
export const ListAddonsQuerySchema = z.object({
    /** Filter addons by billing type (e.g. 'monthly', 'one_time') */
    billingType: z
        .string({
            message: 'zodError.billing.addon.list.billingType.invalidType'
        })
        .min(1, { message: 'zodError.billing.addon.list.billingType.min' })
        .max(50, { message: 'zodError.billing.addon.list.billingType.max' })
        .optional(),
    /** Free-text search term to filter addons by name or description */
    search: z
        .string({
            message: 'zodError.billing.addon.list.search.invalidType'
        })
        .min(1, { message: 'zodError.billing.addon.list.search.min' })
        .max(200, { message: 'zodError.billing.addon.list.search.max' })
        .optional()
});

/** TypeScript type inferred from ListAddonsQuerySchema */
export type ListAddonsQuery = z.infer<typeof ListAddonsQuerySchema>;
