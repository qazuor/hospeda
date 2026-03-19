/**
 * Re-export shim for backward compatibility.
 * The canonical implementation lives in @repo/service-core.
 *
 * @module services/billing-settings
 */
export {
    BillingSettingsService,
    getBillingSettingsService,
    resetBillingSettingsService,
    type BillingSettings
} from '@repo/service-core';
