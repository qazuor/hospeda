/**
 * Usage Tracking Types and Pure Functions
 *
 * Shared types and pure utility functions for the usage tracking system.
 * These track resource usage against plan limits with threshold warnings.
 *
 * @module services/billing/addon/usage-tracking.types
 */

/**
 * Threshold status levels based on usage percentage.
 *
 * - `ok`: Usage below 80%
 * - `warning`: Usage at 80-89%
 * - `critical`: Usage at 90-99%
 * - `exceeded`: Usage at 100% or above
 */
export type UsageThreshold = 'ok' | 'warning' | 'critical' | 'exceeded';

/**
 * Usage information for a single limit
 */
export interface LimitUsage {
    /** The limit key identifier */
    readonly limitKey: string;
    /** Human-readable name in Spanish */
    readonly displayName: string;
    /** Current usage count */
    readonly currentUsage: number;
    /** Maximum allowed by plan + add-ons */
    readonly maxAllowed: number;
    /** Usage percentage (0-100) */
    readonly usagePercentage: number;
    /** Threshold status based on usage percentage */
    readonly threshold: UsageThreshold;
    /** Base limit from plan (before add-ons) */
    readonly planBaseLimit: number;
    /** Additional limit from add-ons */
    readonly addonBonusLimit: number;
}

/**
 * Complete usage summary for a customer
 */
export interface UsageSummary {
    /** Billing customer ID */
    readonly customerId: string;
    /** Usage details for each limit */
    readonly limits: readonly LimitUsage[];
    /** Worst threshold across all limits */
    readonly overallThreshold: UsageThreshold;
    /** URL to upgrade plan */
    readonly upgradeUrl: string;
}

/**
 * Calculate threshold based on current usage and max allowed.
 *
 * Thresholds:
 * - `ok`: below 80%
 * - `warning`: 80% to 89%
 * - `critical`: 90% to 99%
 * - `exceeded`: 100% or above
 *
 * If max is 0 or negative (unlimited/disabled), returns `ok`.
 *
 * @param input - Current usage count and maximum allowed count
 * @returns Threshold status
 */
export function calculateThreshold({
    current,
    max
}: {
    readonly current: number;
    readonly max: number;
}): UsageThreshold {
    // Unlimited or disabled (max = 0 or -1)
    if (max <= 0) {
        return 'ok';
    }

    const percentage = (current / max) * 100;

    if (percentage >= 100) {
        return 'exceeded';
    }
    if (percentage >= 90) {
        return 'critical';
    }
    if (percentage >= 80) {
        return 'warning';
    }

    return 'ok';
}

/**
 * Determine overall threshold from a list of thresholds.
 *
 * Returns the worst (highest severity) threshold.
 * Priority: exceeded > critical > warning > ok
 *
 * @param input - Array of threshold statuses
 * @returns Overall threshold (worst case)
 */
export function determineOverallThreshold({
    thresholds
}: {
    readonly thresholds: readonly UsageThreshold[];
}): UsageThreshold {
    if (thresholds.includes('exceeded')) {
        return 'exceeded';
    }
    if (thresholds.includes('critical')) {
        return 'critical';
    }
    if (thresholds.includes('warning')) {
        return 'warning';
    }
    return 'ok';
}
