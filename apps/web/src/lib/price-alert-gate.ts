import { EntitlementKey, LimitKey } from '@repo/billing';
import type { ApiResult } from '@/lib/api/types';

/**
 * Resolved gate state for the accommodation-detail `PriceAlertButton` — kept
 * out of the accommodation detail page module on purpose (SPEC-187 P2-T9
 * enforces that page has no direct entitlement imports).
 */
export interface PriceAlertGateState {
    readonly canCreateAlerts: boolean;
    readonly maxReached: boolean;
}

/**
 * Derives whether a tourist may create a new price alert from a
 * `billingApi.getEntitlements()` result and their current active-alert count.
 *
 * Returns the safe "locked" defaults (`canCreateAlerts: false`, `maxReached:
 * false`) when the entitlements call failed — `PriceAlertButton` renders its
 * locked state in that case.
 */
export const resolvePriceAlertGateState = (
    entitlementsResult: ApiResult<{
        readonly entitlements: ReadonlyArray<string>;
        readonly limits: Readonly<Record<string, number>>;
    }>,
    existingAlertsCount: number
): PriceAlertGateState => {
    if (!entitlementsResult.ok) {
        return { canCreateAlerts: false, maxReached: false };
    }

    const { entitlements, limits } = entitlementsResult.data;
    const canCreateAlerts = entitlements.includes(EntitlementKey.PRICE_ALERTS);
    const maxActiveAlerts = limits[LimitKey.MAX_ACTIVE_ALERTS];
    const maxReached =
        maxActiveAlerts !== undefined &&
        maxActiveAlerts !== -1 &&
        existingAlertsCount >= maxActiveAlerts;

    return { canCreateAlerts, maxReached };
};
