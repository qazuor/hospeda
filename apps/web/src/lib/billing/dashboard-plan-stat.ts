import { TrialStatusEnum, type TrialSummaryResponse, type UserStatsResponse } from '@repo/schemas';

/** Plan catalog slugs that have dashboard name translations. */
export const DASHBOARD_PLAN_SLUGS = [
    'owner-basico',
    'owner-pro',
    'owner-premium',
    'tourist-free',
    'tourist-vip',
    'venue-basico',
    'venue-pro',
    'venue-premium',
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

/** Dashboard subscription-card state derived from the trial reads. */
export type DashboardTrialStat =
    | { readonly kind: 'none' }
    | { readonly kind: 'trial'; readonly endsAt: string | null };

/**
 * Resolve the trial reads (`GET /protected/publish/trial-summary/:vertical`, one per vertical)
 * into the dashboard card state.
 *
 * The trial is Hospeda's own and never appears in the provider subscription, so
 * `/users/me/stats` reports `plan: null` while a trial runs. The caller asks for this only when
 * {@link resolveDashboardPlanStat} answered `free`. With several running trials the earliest
 * `endsAt` wins (the first date the owner has to act on); a running trial without a date sorts last.
 *
 * @param input.summaries - The summaries that answered; failed reads are simply left out.
 * @returns `trial` when at least one vertical's trial is `TRIAL_ACTIVE`, otherwise `none`.
 */
export function resolveDashboardTrialStat(input: {
    readonly summaries: readonly TrialSummaryResponse[];
}): DashboardTrialStat {
    const running = input.summaries.filter(
        (summary): summary is Extract<TrialSummaryResponse, { endsAt: string | null }> =>
            summary.status === TrialStatusEnum.TRIAL_ACTIVE
    );
    if (running.length === 0) return { kind: 'none' };
    const time = (iso: string | null): number => {
        const ms = iso ? Date.parse(iso) : Number.NaN;
        return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
    };
    const [first] = [...running].sort((a, b) => time(a.endsAt) - time(b.endsAt));
    return { kind: 'trial', endsAt: first?.endsAt ?? null };
}
