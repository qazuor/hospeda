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
