import type { UserStatsResponse } from '@repo/schemas';

/** Plan catalog slugs that have dashboard name translations. */
export const DASHBOARD_PLAN_SLUGS = [
    'owner-basico',
    'owner-pro',
    'owner-premium',
    'tourist-free',
    'tourist-vip',
    'gastronomy-basico',
    'gastronomy-pro',
    'gastronomy-premium',
    'experience-basico',
    'experience-pro',
    'experience-premium',
    'partner-silver',
    'partner-gold'
] as const;

/** Resolve API stats into a renderable free, multiple, or single-plan dashboard state. */
export function resolveDashboardPlanStat(input: {
    readonly plan: UserStatsResponse['plan'];
    readonly activeSubscriptionsCount: UserStatsResponse['activeSubscriptionsCount'];
    readonly planNames: Readonly<Record<string, string>>;
}):
    | { readonly kind: 'free' }
    | { readonly kind: 'multiple'; readonly count: number }
    | {
          readonly kind: 'single';
          readonly label: string;
          readonly statusKey: 'active' | 'grace-period' | 'suspended' | 'cancel-scheduled';
      } {
    const { plan, activeSubscriptionsCount, planNames } = input;
    if (activeSubscriptionsCount >= 2) return { kind: 'multiple', count: activeSubscriptionsCount };
    if (!plan) return { kind: 'free' };

    const statusKeys = {
        ACTIVE: 'active',
        GRACE_PERIOD: 'grace-period',
        SUSPENDED: 'suspended',
        CANCEL_SCHEDULED: 'cancel-scheduled'
    } as const;
    return {
        kind: 'single',
        label:
            planNames[plan.slug] && planNames[plan.slug] !== plan.slug
                ? planNames[plan.slug]
                : plan.name,
        statusKey: statusKeys[plan.status]
    };
}

/** Parse the serialized plan-name map without throwing on missing or malformed input. */
export function parsePlanNames(raw: string | null): Record<string, string> {
    if (!raw) return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return Object.fromEntries(
            Object.entries(parsed).filter(
                (entry): entry is [string, string] => typeof entry[1] === 'string'
            )
        );
    } catch {
        return {};
    }
}
