/**
 * Billing system constants for the Hospeda platform
 */

/** Default trial period in days for owner plans */
export const OWNER_TRIAL_DAYS = 14;

/** Default trial period for complex plans */
export const COMPLEX_TRIAL_DAYS = 14;

/** Default grace period in days after payment failure */
export const PAYMENT_GRACE_PERIOD_DAYS = 3;

/** Maximum retry attempts for failed payments */
export const MAX_PAYMENT_RETRY_ATTEMPTS = 3;

/** Entitlement cache TTL in milliseconds (5 minutes) */
export const ENTITLEMENT_CACHE_TTL_MS = 5 * 60 * 1000;

/** Plan data cache TTL in milliseconds (30 minutes) */
export const PLAN_CACHE_TTL_MS = 30 * 60 * 1000;

/** Default currency for all billing operations */
export const DEFAULT_CURRENCY = 'ARS';

/** Reference currency for USD equivalents */
export const REFERENCE_CURRENCY = 'USD';
