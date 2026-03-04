/**
 * Billing system constants for the Hospeda platform
 */

/** Default trial period in days for owner plans */
export const OWNER_TRIAL_DAYS = 14;

/** Default trial period for complex plans */
export const COMPLEX_TRIAL_DAYS = 14;

/**
 * Default grace period in days after payment failure.
 *
 * This is the initial grace period before the dunning process starts.
 * The operational dunning grace period is defined by DUNNING_GRACE_PERIOD_DAYS.
 */
export const PAYMENT_GRACE_PERIOD_DAYS = 3;

/**
 * Maximum retry attempts for failed payments (initial payment flow).
 *
 * This applies to the immediate payment retry logic.
 * The dunning retry intervals are defined by DUNNING_RETRY_INTERVALS.
 */
export const MAX_PAYMENT_RETRY_ATTEMPTS = 3;

/**
 * Grace period in days for the dunning process.
 *
 * After this period without successful payment, the subscription is cancelled.
 * The dunning job checks daily and processes retries at the intervals defined
 * by DUNNING_RETRY_INTERVALS within this window.
 */
export const DUNNING_GRACE_PERIOD_DAYS = 7;

/**
 * Retry intervals for the dunning process, in days after the initial failure.
 *
 * Each value represents the day on which a retry attempt is made:
 * - Day 1: First retry (24h after failure)
 * - Day 3: Second retry
 * - Day 5: Third retry
 * - Day 7: Final retry (coincides with grace period end)
 *
 * If all retries fail, the subscription is cancelled at the end of the grace period.
 */
export const DUNNING_RETRY_INTERVALS = [1, 3, 5, 7] as const;

/** Entitlement cache TTL in milliseconds (5 minutes) */
export const ENTITLEMENT_CACHE_TTL_MS = 5 * 60 * 1000;

/** Plan data cache TTL in milliseconds (30 minutes) */
export const PLAN_CACHE_TTL_MS = 30 * 60 * 1000;

/** Default currency for all billing operations */
export const DEFAULT_CURRENCY = 'ARS';

/** Reference currency for USD equivalents */
export const REFERENCE_CURRENCY = 'USD';

/** Default timeout for MercadoPago API requests in milliseconds */
export const MERCADO_PAGO_DEFAULT_TIMEOUT_MS = 5000;
