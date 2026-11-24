import type { EntitlementsData } from '@/lib/entitlements-cache';

export interface PriceAlertGate {
    readonly canCreateAlerts: boolean;
    readonly maxReached: boolean;
}

export function resolvePriceAlertGate({
    effectiveSet,
    currentAlertCount
}: {
    readonly effectiveSet: EntitlementsData;
    readonly currentAlertCount: number;
}): PriceAlertGate {
    const max = effectiveSet.limits.max_active_alerts ?? 0;
    return {
        canCreateAlerts: !effectiveSet.failed && (effectiveSet.entitlements.price_alerts ?? 0) > 0,
        maxReached: currentAlertCount + 1 > max
    };
}

/**
 * HOS-2599: whether the price-alerts page shows the plan lock instead of its empty state.
 * `GET /protected/price-alerts` is not gated, so a Free tourist with no alerts used to get the
 * «Explorá alojamientos y activá alertas» empty state, an invitation the plan then refuses.
 * The lock shows only when the list is empty AND the effective set was read and lacks
 * `price_alerts`; a failed read keeps the empty state (the API still refuses on create), and
 * a tourist who already holds alerts keeps seeing them so they can remove them.
 *
 * @param input.alertCount - How many alerts the list read returned.
 * @param input.effectiveSet - The tourist effective set.
 * @returns `true` to render the LockedState.
 */
export function showPriceAlertsLock({
    alertCount,
    effectiveSet
}: {
    readonly alertCount: number;
    readonly effectiveSet: EntitlementsData;
}): boolean {
    return (
        alertCount === 0 &&
        !effectiveSet.failed &&
        !resolvePriceAlertGate({ effectiveSet, currentAlertCount: 0 }).canCreateAlerts
    );
}
