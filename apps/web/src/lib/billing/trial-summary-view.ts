/** Resolve a trial summary into the presentation states used by Mi Suscripción. */
import { TrialStatusEnum, type TrialSummaryResponse } from '@repo/schemas';

type SummaryWithTrial = Extract<TrialSummaryResponse, { totalDays: number }>;

/** Data needed to render a current trial summary. */
export interface RunningTrialSummaryView {
    readonly kind: 'running';
    readonly totalDays: number;
    readonly origins: SummaryWithTrial['origins'];
    readonly startedAt: string | null;
    readonly endsAt: string | null;
}

/** Display state for one trial summary response. */
export type TrialSummaryView =
    | { readonly kind: 'hidden' }
    | RunningTrialSummaryView
    | { readonly kind: 'ended_converted' }
    | { readonly kind: 'ended_converted_without_plan'; readonly endsAt: string | null }
    | { readonly kind: 'ended_expired'; readonly endsAt: string | null };

type ViewResolver = (params: {
    readonly summary: SummaryWithTrial;
    readonly hasLiveSubscription: boolean;
}) => TrialSummaryView;

const VIEW_BY_STATUS: Record<TrialStatusEnum, ViewResolver> = {
    [TrialStatusEnum.TRIAL_ACTIVE]: ({ summary }) => ({
        kind: 'running',
        totalDays: summary.totalDays,
        origins: summary.origins,
        startedAt: summary.startedAt,
        endsAt: summary.endsAt
    }),
    [TrialStatusEnum.TRIAL_CONVERTED]: ({ summary, hasLiveSubscription }) =>
        hasLiveSubscription
            ? { kind: 'ended_converted' }
            : { kind: 'ended_converted_without_plan', endsAt: summary.endsAt },
    [TrialStatusEnum.TRIAL_EXPIRED]: ({ summary }) => ({
        kind: 'ended_expired',
        endsAt: summary.endsAt
    })
};

/**
 * Resolve a trial response without consulting time, formatting dates, or copy.
 *
 * @param params.summary - The response already resolved by the billing core.
 * @param params.hasLiveSubscription - Whether the account holds a live subscription in this
 *   vertical. A converted trial only claims "you have your plan" when this is true (HOS-1772).
 * @returns The view state for this vertical's summary.
 */
export function resolveTrialSummaryView({
    summary,
    hasLiveSubscription
}: {
    readonly summary: TrialSummaryResponse;
    readonly hasLiveSubscription: boolean;
}): TrialSummaryView {
    if (!('totalDays' in summary) || summary.totalDays <= 0) return { kind: 'hidden' };
    return VIEW_BY_STATUS[summary.status]({ summary, hasLiveSubscription });
}
