import { isUnlimitedLimit } from '@/components/billing/plan-card-delta';
import { type EntitlementsData, fetchEntitlementsUncached } from '@/lib/entitlements-cache';

export const MAX_ACCOMMODATIONS_LIMIT_KEY = 'max_accommodations';

export interface UsageBadgeData {
    readonly currentUsage: number;
    readonly maxAllowed: number;
    readonly threshold: 'ok' | 'warning' | 'critical' | 'atLimit' | 'exceeded';
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
    // HOS-2443: reaching the cap exactly is a state, not an error. Only going PAST it
    // (a downgrade, a grant that lapsed) is `exceeded`.
    if (percentage > 100) return 'exceeded';
    if (percentage === 100) return 'atLimit';
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
        isUnlimitedLimit({ value: maxAllowed }) ||
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
