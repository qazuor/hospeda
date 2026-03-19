/**
 * Re-export from @repo/service-core (migrated to packages/service-core/src/services/billing/addon/).
 * This shim maintains backward compatibility for existing consumers in the API layer.
 *
 * @module services/addon.types
 */
export type {
    ServiceResult,
    ListAvailableAddonsInput,
    PurchaseAddonInput,
    PurchaseAddonResult,
    UserAddon,
    CancelAddonInput,
    ConfirmPurchaseInput,
    AddonAdjustment
} from '@repo/service-core';

export { addonAdjustmentSchema, addonAdjustmentsArraySchema } from '@repo/service-core';
