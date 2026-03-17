/**
 * Add-on API Schemas
 *
 * @deprecated Import directly from '@repo/schemas' instead.
 * This file re-exports from the canonical source for backward compatibility.
 *
 * @module schemas/addon
 */

export {
    AddonBillingTypeSchema,
    AddonResponseSchema,
    AddonTargetCategorySchema,
    CancelAddonSchema,
    ListAddonsQuerySchema,
    PurchaseAddonResponseSchema,
    PurchaseAddonSchema,
    UserAddonResponseSchema
} from '@repo/schemas';

export type {
    AddonResponse,
    CancelAddon,
    ListAddonsQuery,
    PurchaseAddon,
    PurchaseAddonResponse,
    UserAddonResponse
} from '@repo/schemas';
