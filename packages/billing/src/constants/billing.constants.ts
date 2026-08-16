/**
 * Billing system constants for the Hospeda platform
 */

/**
 * Trial period, in days, for self-service owner plans (owner-basico /
 * owner-pro / owner-premium).
 *
 * Owner decision (2026-08-15): raised from 14 to 30 days to match the
 * self-service tourist tier (`TOURIST_TRIAL_DAYS`, HOS-301 D1). `complex-*`
 * plans are NOT included in this change and stay at 14 — see
 * `COMPLEX_TRIAL_DAYS`, which was deliberately decoupled from this constant
 * in HOS-301 D1 precisely so the two tiers could move independently. Do NOT
 * re-alias `COMPLEX_TRIAL_DAYS` to this constant; that regression is exactly
 * what HOS-301 D1 fixed for the tourist tier.
 */
export const OWNER_TRIAL_DAYS = 30;

/** Default trial period for complex plans */
export const COMPLEX_TRIAL_DAYS = 14;

/**
 * Trial period for self-service tourist plans (tourist-plus / tourist-vip).
 *
 * Owner decision (HOS-301 D1, 2026-08-11): the tourist tier gets a 30-day
 * card-first trial while the owner tier stays at 14.
 *
 * This supersedes HOS-210 / SMOKE-19-07, which had aliased this to
 * `OWNER_TRIAL_DAYS` precisely so the two tiers could not drift apart. D1 makes
 * the divergence deliberate, so the alias is gone: raising the tourist trial
 * through it would have silently tripled the owner trial too. Keep this a
 * literal — the two tiers are independent commercial decisions now.
 */
export const TOURIST_TRIAL_DAYS = 30;

/**
 * Reference constant for the initial-payment grace window, in days.
 *
 * IMPORTANT: This constant is NOT the value enforced at runtime. qzpay-core's
 * `daysRemainingInGrace()` and `isInGracePeriod()` use `DUNNING_GRACE_PERIOD_DAYS=7`
 * against `current_period_end` for both the grace window and the dunning cutoff.
 * There is currently no separate payment-grace enforcement.
 *
 * This constant is kept as a reference for documentation and as a tripwire for
 * the warning log in `apps/api/src/middlewares/past-due-grace.middleware.ts`. The
 * middleware logs a warning at import time if this value diverges from 3, but
 * the runtime grace behavior follows qzpay-core regardless.
 *
 * See `docs/billing/grace-period-source-of-truth.md` for the full picture.
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

/**
 * Maximum lag window in hours that the cron renewal checker tolerates before
 * raising a Sentry alert for a subscription that has not been renewed.
 *
 * Rationale: MercadoPago webhook delivery is eventually consistent and can lag
 * several hours during high-traffic periods. A 6-hour window absorbs that jitter
 * at renewal time without masking real outages. PAST this window, access is
 * intentionally NOT blocked (billing is never a hard gate on service access), but
 * a Sentry alert fires so the team can investigate the delay.
 *
 * Owner decision 2026-06-09, SPEC-148 Part A.
 */
export const BILLING_CRON_LAG_GRACE_HOURS = 6;
