/**
 * API Services
 *
 * Barrel file for all API-level services.
 * These services handle API-specific logic that doesn't belong in the core service layer.
 *
 * @module services
 */

export type {
    ExpireAddonInput,
    ExpireAddonResult,
    ExpiredAddon,
    ExpiringAddon,
    FindExpiringAddonsInput,
    ProcessExpiredAddonsResult
} from './addon-expiration.service';
export { AddonExpirationService } from './addon-expiration.service';
export type { BillingCustomerSyncConfig } from './billing-customer-sync';
export { BillingCustomerSyncService } from './billing-customer-sync';
export { getMediaProvider } from './media';
export type {
    ReactivateFromTrialInput,
    ReactivateSubscriptionInput,
    ReactivateSubscriptionResult,
    StartTrialInput,
    TrialEndingSubscription,
    TrialStatus
} from './trial.service';
export { TrialService } from './trial.service';
