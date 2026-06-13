import { BILLING_CRON_LAG_GRACE_HOURS } from '../constants/billing.constants.js';

/**
 * Input shape for `isSubscriptionLive`.
 *
 * All date fields are optional. When absent or `null`, the subscription is
 * treated as live (fail-open), matching the current behaviour of the
 * `checkEligibility` gate which does not inspect dates at all.
 */
export interface IsSubscriptionLiveInput {
    /** Billing subscription status string (e.g. 'active', 'trialing', 'cancelled'). */
    readonly status: string;
    /**
     * Timestamp at which the trial period ends.
     * Only meaningful when `status === 'trialing'`.
     * `null` or `undefined` → treated as live (fail-open).
     */
    readonly trialEnd?: Date | null;
    /**
     * Timestamp at which the current billing period ends.
     * Meaningful when `status === 'active'` (cron-lag grace applies) or
     * `status === 'cancelled'` (soft-cancel grace: live until period end, no extra grace).
     * `null` or `undefined` → treated as live (fail-open).
     */
    readonly currentPeriodEnd?: Date | null;
    /**
     * Current time as a Unix epoch in milliseconds.
     * Defaults to `Date.now()` at call time when omitted.
     * Always pass an explicit value in tests for determinism.
     */
    readonly nowMs?: number;
    /**
     * Cron-lag grace window in hours.
     * Defaults to `BILLING_CRON_LAG_GRACE_HOURS` (6 h) when omitted.
     * Applies only to `'active'` subscriptions; `'cancelled'` always uses 0 h grace
     * (access is valid exactly until `currentPeriodEnd`, not beyond).
     * The subscription is considered live while `(now - periodEnd) <= graceHours`.
     */
    readonly graceHours?: number;
}

/**
 * Determines whether a billing subscription is currently live (i.e. should
 * grant access to entitlements).
 *
 * Logic:
 * - `'active'`: live iff `currentPeriodEnd` is absent/null **or** the period
 *   has not exceeded the cron-lag grace window (default 6 h).
 * - `'trialing'`: live iff `trialEnd` is absent/null **or** the trial has not
 *   exceeded the cron-lag grace window.
 * - `'cancelled'` (soft-cancel grace): live iff `currentPeriodEnd` is
 *   absent/null **or** `currentPeriodEnd > now`. No extra grace window applies;
 *   access is valid exactly until the period the host already paid for ends.
 * - All other statuses (`past_due`, `paused`, `expired`, etc.) → `false`.
 * - A date that cannot be parsed (i.e. `isNaN(date.getTime())`) is treated as
 *   absent, preserving the fail-open policy.
 * - The grace window uses `<=` at the boundary: a subscription overdue by
 *   exactly `graceHours` is still considered live (cron-lag semantics).
 *
 * @param input - Subscription fields required for the liveness check.
 * @returns `true` when the subscription grants access; `false` otherwise.
 *
 * @example
 * ```ts
 * // Active subscription inside the 6-hour cron-lag grace window
 * const oneHourAgo = Date.now() - 1 * 3_600_000;
 * isSubscriptionLive({
 *   status: 'active',
 *   currentPeriodEnd: new Date(oneHourAgo),
 * }); // true
 *
 * // Active subscription 7 hours past period end (outside grace)
 * const sevenHoursAgo = Date.now() - 7 * 3_600_000;
 * isSubscriptionLive({
 *   status: 'active',
 *   currentPeriodEnd: new Date(sevenHoursAgo),
 * }); // false
 *
 * // Cancelled subscription within soft-cancel grace (period_end still in future)
 * const futurePeriodEnd = new Date(Date.now() + 5 * 24 * 3_600_000);
 * isSubscriptionLive({
 *   status: 'cancelled',
 *   currentPeriodEnd: futurePeriodEnd,
 * }); // true
 *
 * // Cancelled subscription with period_end in the past → no access
 * const pastPeriodEnd = new Date(Date.now() - 1 * 3_600_000);
 * isSubscriptionLive({
 *   status: 'cancelled',
 *   currentPeriodEnd: pastPeriodEnd,
 * }); // false
 * ```
 */
export function isSubscriptionLive(input: IsSubscriptionLiveInput): boolean {
    const {
        status,
        trialEnd,
        currentPeriodEnd,
        nowMs = Date.now(),
        graceHours = BILLING_CRON_LAG_GRACE_HOURS
    } = input;

    if (status === 'trialing') {
        const graceLimitMs = graceHours * 3_600_000;
        return isWithinGrace({ date: trialEnd, nowMs, graceLimitMs });
    }

    if (status === 'active') {
        const graceLimitMs = graceHours * 3_600_000;
        return isWithinGrace({ date: currentPeriodEnd, nowMs, graceLimitMs });
    }

    if (status === 'cancelled') {
        // Soft-cancel grace: the host paid through currentPeriodEnd — grant access
        // until that moment, but no extra cron-lag window beyond it.
        return isWithinGrace({ date: currentPeriodEnd, nowMs, graceLimitMs: 0 });
    }

    // All other statuses (past_due, paused, expired, unpaid, etc.) are not live.
    return false;
}

/**
 * Returns `true` when `date` is absent, invalid, in the future, or within
 * `graceLimitMs` milliseconds in the past relative to `nowMs`.
 */
function isWithinGrace(params: {
    readonly date: Date | null | undefined;
    readonly nowMs: number;
    readonly graceLimitMs: number;
}): boolean {
    const { date, nowMs, graceLimitMs } = params;

    if (date == null) {
        return true;
    }

    const dateMs = date.getTime();

    if (Number.isNaN(dateMs)) {
        // Invalid Date — fail open (cannot determine expiry)
        return true;
    }

    const overdueMs = nowMs - dateMs;
    return overdueMs <= graceLimitMs;
}
