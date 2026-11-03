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

/** Text the dashboard subscription card shows when the stats report no paid plan. */
export interface DashboardFreeCard {
    /** Main value of the card. */
    readonly value: string;
    /** Status line under it, or `null` when there is nothing to say. */
    readonly statusText: string | null;
}

/**
 * Decide what the card says when `/users/me/stats` reports no paid plan.
 *
 * An active trial wins over the free label. The end date line appears only when the trial has a
 * parseable end date; an empty `trialSummaries` (every read failed or timed out) keeps the free
 * label, which is the pre-trial behaviour.
 *
 * @param input.trialSummaries - The trial reads that answered; failed reads are left out.
 * @param input.labels - Translated labels; `trialEndsOn` carries a `{{date}}` placeholder.
 * @param input.formatDate - Formats an ISO instant, returning `null` when it cannot.
 * @returns The value and optional status line to render.
 */
export function resolveDashboardFreeCard(input: {
    readonly trialSummaries: readonly TrialSummaryResponse[];
    readonly labels: {
        readonly free: string;
        readonly trial: string;
        readonly trialEndsOn: string;
    };
    readonly formatDate: (iso: string) => string | null;
}): DashboardFreeCard {
    const { trialSummaries, labels, formatDate } = input;
    const trial = resolveDashboardTrialStat({ summaries: trialSummaries });
    if (trial.kind === 'none') return { value: labels.free, statusText: null };
    const date = trial.endsAt ? formatDate(trial.endsAt) : null;
    return {
        value: labels.trial,
        statusText: date ? labels.trialEndsOn.replace('{{date}}', date) : null
    };
}
