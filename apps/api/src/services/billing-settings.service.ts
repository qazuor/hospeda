/**
 * Re-export shim for backward compatibility.
 * The canonical implementation lives in @repo/service-core.
 *
 * @module services/billing-settings
 */
export {
    type BillingSettings,
    BillingSettingsService,
    getBillingSettingsService,
    resetBillingSettingsService
} from '@repo/service-core';
