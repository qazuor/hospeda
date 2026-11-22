import {
    type OwnPlanStatus,
    TrialStatusEnum,
    type TrialSummaryResponse,
    type UserStatsResponse
} from '@repo/schemas';

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

/** Key of the label a subscription status uses on the account dashboard card. */
export type DashboardStatusKey =
    | 'active'
    | 'grace-period'
    | 'suspended'
    | 'cancel-scheduled'
    | 'paused'
    | 'charge-declined'
    | 'pending-authorization';

/** Exact subscription status to its card label key; one entry per `OWN_PLAN_STATUSES` value. */
const STATUS_KEY_BY_STATUS = {
    ACTIVE: 'active',
    GRACE_PERIOD: 'grace-period',
    SUSPENDED: 'suspended',
    CANCEL_SCHEDULED: 'cancel-scheduled',
    PAUSED: 'paused',
    CHARGE_DECLINED: 'charge-declined',
    PENDING_AUTHORIZATION: 'pending-authorization'
} as const satisfies Record<OwnPlanStatus, DashboardStatusKey>;

/** Most subscriptions the `/mi-cuenta/` card lists before it offers "Ver todas" (HOS-2553). */
export const MAX_CARD_SUBSCRIPTIONS = 3;

/**
 * Whether a status needs the owner to DO something (HOS-2553): the card then adds a
 * line saying what, next to the link to the subscription page.
 *
 * @param input.statusKey - The card label key of the status.
 * @returns `true` for a declined charge and for a checkout waiting for authorization.
 */
export function statusNeedsAction(input: { readonly statusKey: DashboardStatusKey }): boolean {
    return input.statusKey === 'charge-declined' || input.statusKey === 'pending-authorization';
}

/** One subscription row of the `/mi-cuenta/` card. */
export interface DashboardSubscriptionRow {
    /** Plan name, read from the catalog (translated when the slug has a name). */
    readonly label: string;
    /** Exact status label key. */
    readonly statusKey: DashboardStatusKey;
}

/** Resolve API stats into a renderable free, multiple, list, or single-plan dashboard state. */
export function resolveDashboardPlanStat(input: {
    readonly plan: UserStatsResponse['plan'];
    readonly activeSubscriptionsCount: UserStatsResponse['activeSubscriptionsCount'];
    readonly planNames: Readonly<Record<string, string>>;
    /** Every live subscription (HOS-2553). Absent when the API predates the field. */
    readonly subscriptions?: UserStatsResponse['subscriptions'];
}):
    | { readonly kind: 'free' }
    | { readonly kind: 'multiple'; readonly count: number }
    | {
          readonly kind: 'list';
          readonly rows: readonly DashboardSubscriptionRow[];
          readonly total: number;
          readonly hasMore: boolean;
      }
    | {
          readonly kind: 'single';
          readonly label: string;
          readonly statusKey: DashboardStatusKey;
      } {
    const { plan, activeSubscriptionsCount, planNames, subscriptions = [] } = input;
    const labelFor = (item: { readonly slug: string; readonly name: string }): string =>
        planNames[item.slug] && planNames[item.slug] !== item.slug
            ? (planNames[item.slug] as string)
            : item.name;
    if (subscriptions.length >= 2) {
        return {
            kind: 'list',
            rows: subscriptions.slice(0, MAX_CARD_SUBSCRIPTIONS).map((item) => ({
                label: labelFor(item),
                statusKey: STATUS_KEY_BY_STATUS[item.status]
            })),
            total: subscriptions.length,
            hasMore: subscriptions.length > MAX_CARD_SUBSCRIPTIONS
        };
    }
    if (activeSubscriptionsCount >= 2) return { kind: 'multiple', count: activeSubscriptionsCount };
    if (!plan) return { kind: 'free' };

    return {
        kind: 'single',
        label: labelFor(plan),
        statusKey: STATUS_KEY_BY_STATUS[plan.status]
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

/**
 * Label for the host dashboard's subscription badge: one distinct text per exact
 * subscription status (HOS-2543), never collapsed into active/inactive.
 *
 * A scheduled cancellation carries its end date when the API sent one. An API that
 * predates `subscriptionStatus` falls back to the coarse `status`.
 *
 * @param input.info - The dashboard plan (`subscriptionStatus`, `serviceEndsAt`, legacy `status`).
 * @param input.t - Translator returning the fallback when a key is missing.
 * @param input.formatDate - Formats an ISO instant, returning `null` when it cannot.
 * @returns The translated badge text.
 */
export function resolvePlanStatusLabel(input: {
    readonly info: {
        readonly status: string;
        readonly subscriptionStatus: string | null;
        readonly serviceEndsAt: string | null;
    };
    readonly t: (key: string, fallback: string, params?: Record<string, unknown>) => string;
    readonly formatDate: (iso: string) => string | null;
}): string {
    const { info, t, formatDate } = input;
    switch (info.subscriptionStatus) {
        case 'ACTIVE':
            return t('host.dashboard.plan.active', 'Activo');
        case 'GRACE_PERIOD':
            return t('host.dashboard.plan.gracePeriod', 'Pago pendiente');
        case 'SUSPENDED':
            return t('host.dashboard.plan.suspended', 'Suspendida');
        case 'CHARGE_DECLINED':
            return t('host.dashboard.plan.chargeDeclined', 'Cobro rechazado');
        case 'PENDING_AUTHORIZATION':
            return t('host.dashboard.plan.pendingAuthorization', 'Esperando autorización');
        case 'PAUSED':
            return t('host.dashboard.plan.paused', 'Pausada');
        case 'CANCEL_SCHEDULED': {
            const date = info.serviceEndsAt ? formatDate(info.serviceEndsAt) : null;
            return date
                ? t('host.dashboard.plan.cancelScheduled', 'Baja programada hasta el {{date}}', {
                      date
                  })
                : t('host.dashboard.plan.cancelScheduledNoDate', 'Baja programada');
        }
        default:
            return info.status === 'active'
                ? t('host.dashboard.plan.active', 'Activo')
                : t('host.dashboard.plan.inactive', 'Inactivo');
    }
}

/**
 * Whether the host dashboard plan is in good standing (active badge style).
 *
 * Compares the EXACT subscription status (`ACTIVE`) when the API sent it, and the
 * coarse legacy status (`active`, lowercase) only for an API that predates it.
 * The two vocabularies differ in case, so they must never be compared with the
 * same literal (HOS-2543).
 *
 * @param input.info - The dashboard plan (`subscriptionStatus`, legacy `status`).
 * @returns `true` when the plan is active.
 */
export function isPlanActive(input: {
    readonly info: {
        readonly status: string;
        readonly subscriptionStatus: string | null;
    };
}): boolean {
    const { info } = input;
    return info.subscriptionStatus === null
        ? info.status === 'active'
        : info.subscriptionStatus === 'ACTIVE';
}

/**
 * The line the host dashboard adds under the plan badge when the owner has to act
 * (HOS-2553), or `null` for a status that needs nothing.
 *
 * @param input.info - The dashboard plan (`subscriptionStatus`).
 * @param input.t - Translator returning the fallback when a key is missing.
 * @returns What to do, in the owner's language, or `null`.
 */
export function resolvePlanActionText(input: {
    readonly info: { readonly subscriptionStatus: string | null };
    readonly t: (key: string, fallback: string) => string;
}): string | null {
    switch (input.info.subscriptionStatus) {
        case 'CHARGE_DECLINED':
            return input.t(
                'host.dashboard.plan.chargeDeclinedAction',
                'Mercado Pago rechazó el cobro. Revisá tu medio de pago para no perder tu plan.'
            );
        case 'PENDING_AUTHORIZATION':
            return input.t(
                'host.dashboard.plan.pendingAuthorizationAction',
                'Falta que autorices el pago en Mercado Pago para activar tu plan.'
            );
        default:
            return null;
    }
}
