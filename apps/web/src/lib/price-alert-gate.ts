import type { ApiResult } from '@/lib/api/types';

/**
 * Entitlement / limit key literals for the price-alert gate.
 *
 * Kept as plain strings rather than the `EntitlementKey` / `LimitKey` enums in
 * `@repo/billing`, mirroring `AnalyticsSection.client.tsx`. Since HOS-369 WB0-7
 * this module runs in the BROWSER (`use-price-alert-gate-state.ts` resolves the
 * gate client-side, because the accommodation detail page is edge-cacheable and
 * can no longer compute it during SSR). Importing the billing barrel from the
 * client graph ships the MercadoPago adapter, `@repo/logger` and the
 * `@repo/config` env registry — env-var names and their `howToObtain` prose
 * included — to public browsers. The `billing-barrel-client-isolation` static
 * guard fails on exactly that, and it caught this change.
 *
 * These MUST match the wire values the backend emits.
 * `test/lib/price-alert-gate.test.ts` asserts they still do, against the real
 * enums, so a rename upstream breaks loudly here instead of silently locking
 * every entitled visitor out of price alerts.
 */
const ENTITLEMENT_PRICE_ALERTS = 'price_alerts';
const LIMIT_MAX_ACTIVE_ALERTS = 'max_active_alerts';

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
    const canCreateAlerts = entitlements.includes(ENTITLEMENT_PRICE_ALERTS);
    const maxActiveAlerts = limits[LIMIT_MAX_ACTIVE_ALERTS];
    const maxReached =
        maxActiveAlerts !== undefined &&
        maxActiveAlerts !== -1 &&
        existingAlertsCount >= maxActiveAlerts;

    return { canCreateAlerts, maxReached };
};
