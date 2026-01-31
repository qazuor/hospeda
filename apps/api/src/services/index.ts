/**
 * API Services
 *
 * Barrel file for all API-level services.
 * These services handle API-specific logic that doesn't belong in the core service layer.
 *
 * @module services
 */

export { BillingCustomerSyncService } from './billing-customer-sync';
export type { BillingCustomerSyncConfig } from './billing-customer-sync';

export { TrialService } from './trial.service';
export type {
    TrialStatus,
    StartTrialInput,
    ReactivateFromTrialInput
} from './trial.service';

export { AddonExpirationService } from './addon-expiration.service';
export type {
    ExpiredAddon,
    ExpiringAddon,
    FindExpiringAddonsInput,
    ExpireAddonInput,
    ExpireAddonResult,
    ProcessExpiredAddonsResult
} from './addon-expiration.service';
