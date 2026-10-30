import { type EntitlementsData, fetchEntitlementsUncached } from '@/lib/entitlements-cache';

export const MAX_ACCOMMODATIONS_LIMIT_KEY = 'max_accommodations';

export interface UsageBadgeData {
    readonly currentUsage: number;
    readonly maxAllowed: number;
    readonly threshold: 'ok' | 'warning' | 'critical' | 'exceeded';
}

export interface HostUsageBadgeLoadResult {
    readonly usageData: UsageBadgeData | null;
    readonly hasOwnerPlan: boolean;
    readonly entitlementsReadOk: boolean;
    readonly effectiveSet: EntitlementsData;
}

export function getUsageThreshold(
    currentUsage: number,
    maxAllowed: number
): UsageBadgeData['threshold'] {
    if (maxAllowed <= 0) return 'ok';
    const percentage = (currentUsage / maxAllowed) * 100;
    if (percentage >= 100) return 'exceeded';
    if (percentage >= 90) return 'critical';
    if (percentage >= 80) return 'warning';
    return 'ok';
}

export function buildUsageBadge({
    effectiveSet,
    currentUsage
}: {
    readonly effectiveSet: EntitlementsData;
    readonly currentUsage: number;
}): UsageBadgeData | null {
    const maxAllowed = effectiveSet.limits[MAX_ACCOMMODATIONS_LIMIT_KEY];
    if (
        effectiveSet.failed ||
        maxAllowed === undefined ||
        maxAllowed === Infinity ||
        maxAllowed <= 0
    )
        return null;
    return { currentUsage, maxAllowed, threshold: getUsageThreshold(currentUsage, maxAllowed) };
}

export async function fetchHostUsageBadge({
    cookieHeader
}: {
    readonly cookieHeader?: string;
}): Promise<HostUsageBadgeLoadResult> {
    const effectiveSet = await fetchEntitlementsUncached({
        vertical: 'accommodation',
        cookieHeader
    });
    return {
        usageData: null,
        hasOwnerPlan: !effectiveSet.failed && effectiveSet.hasLiveNonTrialTitle,
        entitlementsReadOk: !effectiveSet.failed,
        effectiveSet
    };
}
