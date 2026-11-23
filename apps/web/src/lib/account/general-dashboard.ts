/**
 * Pure pieces of the general Mi Cuenta dashboard (HOS-2473).
 *
 * D19 «tableros separados»: the general dashboard shows only ACCOUNT-level
 * numbers (favorites, reviews, plan). The host, venue and experience numbers
 * live on their own dashboards, and this one links to them. AC-11 checks that
 * the two widget sets never meet: {@link GENERAL_DASHBOARD_WIDGETS} is the
 * list a test compares against the host dashboard's.
 *
 * @module lib/account/general-dashboard
 */

import { PermissionEnum, type TrialSummaryResponse, type UserStatsResponse } from '@repo/schemas';
import type { DashboardRow } from '@/lib/account/dashboard-rows';
import {
    type DashboardActionStatusKey,
    type DashboardStatusKey,
    getActionStatusKey,
    resolveDashboardFreeCard,
    resolveDashboardPlanStat
} from '@/lib/billing/dashboard-plan-stat';
import type { TranslationFn } from '@/lib/i18n';
import { hasAccommodationsNavAccess, isVisibleByRoles } from '@/lib/nav-gating';

/** Stable ids of the general dashboard's widgets (`data-widget`). */
export const GENERAL_DASHBOARD_WIDGETS = ['favorites', 'reviews', 'subscription'] as const;

/** One general dashboard widget id. */
export type GeneralDashboardWidget = (typeof GENERAL_DASHBOARD_WIDGETS)[number];

/**
 * The entry points the general dashboard offers, by the roles the user holds.
 *
 * Gated over the whole role SET through the shared predicates (HOS-296), never
 * by comparing a role literal. Host and venue/experience entries are separate
 * conditions: one account can hold both hats. «Editar perfil» is not here: it
 * is the page header's one action, and listing it twice is what this page
 * used to do.
 *
 * @param input - `{ roles }`: every role the user holds.
 * @returns The links, in display order.
 */
export function buildGeneralDashboardLinks({
    roles
}: {
    readonly roles: readonly string[];
}): readonly DashboardRow[] {
    const isHost = hasAccommodationsNavAccess({ roles });
    const ownsVenues = isVisibleByRoles(
        { requiredPermission: PermissionEnum.VENUE_EDIT_OWN },
        roles
    );
    const ownsExperiences = isVisibleByRoles(
        { requiredPermission: PermissionEnum.EXPERIENCE_EDIT_OWN },
        roles
    );
    const isOwner = ownsVenues || ownsExperiences;

    return [
        ...(isHost
            ? [
                  {
                      id: 'hostDashboard',
                      labelKey: 'account.pages.dashboard.nav.hostDashboard',
                      descriptionKey: 'account.pages.dashboard.nav.hostDashboardDesc',
                      path: 'mi-cuenta/host-dashboard',
                      icon: 'dashboard' as const
                  },
                  {
                      id: 'properties',
                      labelKey: 'account.pages.dashboard.nav.myProperties',
                      descriptionKey: 'account.pages.dashboard.nav.myPropertiesDesc',
                      path: 'mi-cuenta/propiedades',
                      icon: 'building' as const
                  }
              ]
            : []),
        ...(ownsVenues
            ? [
                  {
                      id: 'venueDashboard',
                      labelKey: 'account.nav.venueDashboard',
                      descriptionKey: 'account.pages.dashboard.nav.venueDashboardDesc',
                      path: 'mi-cuenta/tablero-locales',
                      icon: 'dashboard' as const
                  }
              ]
            : []),
        ...(ownsExperiences
            ? [
                  {
                      id: 'experienceDashboard',
                      labelKey: 'account.nav.experienceDashboard',
                      descriptionKey: 'account.pages.dashboard.nav.experienceDashboardDesc',
                      path: 'mi-cuenta/tablero-experiencias',
                      icon: 'dashboard' as const
                  }
              ]
            : []),
        ...(isOwner
            ? [
                  {
                      // Same label key as the sidebar entry, so the two cannot drift.
                      id: 'listings',
                      labelKey: 'listing.owner.nav',
                      descriptionKey: 'account.pages.dashboard.nav.myListingDesc',
                      path: 'mi-cuenta/comercio',
                      icon: 'briefcase' as const
                  }
              ]
            : []),
        {
            id: 'messages',
            labelKey: 'account.pages.dashboard.nav.myMessages',
            // The merchant RECEIVES enquiries; the tourist copy names the other party.
            descriptionKey: isOwner
                ? 'account.pages.dashboard.nav.myMessagesListingDesc'
                : 'account.pages.dashboard.nav.myMessagesDesc',
            path: 'mi-cuenta/consultas',
            icon: 'chat'
        },
        {
            id: 'preferences',
            labelKey: 'account.pages.dashboard.nav.preferences',
            descriptionKey: 'account.pages.dashboard.nav.preferencesDesc',
            path: 'mi-cuenta/preferencias',
            icon: 'settings'
        },
        {
            id: 'newsletter',
            labelKey: 'account.pages.dashboard.nav.newsletter',
            descriptionKey: 'account.pages.dashboard.nav.newsletterDesc',
            path: 'mi-cuenta/newsletter',
            icon: 'newsletter'
        }
    ];
}

/** Status line key per exact subscription status (one entry per `DashboardStatusKey`). */
const STATUS_LABEL_KEY = {
    active: 'account.pages.dashboard.stats.activeStatus',
    'grace-period': 'account.pages.dashboard.stats.gracePeriodStatus',
    suspended: 'account.pages.dashboard.stats.suspendedStatus',
    'cancel-scheduled': 'account.pages.dashboard.stats.cancelScheduledStatus',
    paused: 'account.pages.dashboard.stats.pausedStatus',
    'charge-declined': 'account.pages.dashboard.stats.chargeDeclinedStatus',
    'pending-authorization': 'account.pages.dashboard.stats.pendingAuthorizationStatus'
} as const satisfies Record<DashboardStatusKey, string>;

/** What-to-do line key per status that needs the owner to act (HOS-2553). */
const ACTION_LABEL_KEY = {
    'charge-declined': 'account.pages.dashboard.stats.chargeDeclinedAction',
    'pending-authorization': 'account.pages.dashboard.stats.pendingAuthorizationAction'
} as const satisfies Record<DashboardActionStatusKey, string>;

/** One subscription row of the card when the user holds two or more (HOS-2553). */
export interface SubscriptionStatRow {
    /** Catalog plan name. */
    readonly plan: string;
    /** Translated exact status. */
    readonly status: string;
}

/** Text the subscription StatCard shows once the reads answered. */
export interface SubscriptionStatText {
    /** Main value (plan name, «Gratuito», «En prueba», «2 suscripciones activas»). */
    readonly value: string;
    /** Status line, or `null`. */
    readonly hint: string | null;
    /** One row per live subscription (max 3) when there are two or more; else empty. */
    readonly rows: readonly SubscriptionStatRow[];
    /** What to do about a declined charge or an unauthorized checkout, or `null`. */
    readonly action: string | null;
    /** `true` when more subscriptions exist than rows shown: the link reads «Ver todas». */
    readonly viewAll: boolean;
}

/**
 * What the subscription StatCard says.
 *
 * Two or more live subscriptions list each one with its exact status, at most
 * three (HOS-2553); a single live plan shows its catalog name and its exact
 * status; an API that predates `subscriptions` falls back to the count
 * (HOS-1066); none asks the trial first (HOS-1996) and only then falls back to
 * the free label. A declined charge or a checkout waiting for authorization
 * adds a line saying what to do (HOS-2553).
 *
 * @param input.stats - `GET /protected/users/me/stats`.
 * @param input.planNames - Translated names by catalog slug (read on the server).
 * @param input.trialSummaries - Trial reads that answered; failed reads left out.
 * @param input.t - Translator for the fixed copy.
 * @param input.formatDate - Formats an ISO instant, `null` when it cannot.
 * @returns The value, the optional status line, the rows and the action line.
 */
export function resolveSubscriptionStatText({
    stats,
    planNames,
    trialSummaries,
    t,
    formatDate
}: {
    readonly stats: Pick<UserStatsResponse, 'plan' | 'activeSubscriptionsCount'> &
        Partial<Pick<UserStatsResponse, 'subscriptions'>>;
    readonly planNames: Readonly<Record<string, string>>;
    readonly trialSummaries: readonly TrialSummaryResponse[];
    readonly t: TranslationFn;
    readonly formatDate: (iso: string) => string | null;
}): SubscriptionStatText {
    const planStat = resolveDashboardPlanStat({
        plan: stats.plan,
        activeSubscriptionsCount: stats.activeSubscriptionsCount,
        subscriptions: stats.subscriptions,
        planNames
    });
    const actionFor = (statusKey: DashboardStatusKey): string | null => {
        const actionKey = getActionStatusKey({ statusKey });
        return actionKey ? t(ACTION_LABEL_KEY[actionKey]) : null;
    };
    const countText = (count: number): string =>
        t(
            count === 1
                ? 'account.pages.dashboard.stats.multipleSubscriptions_one'
                : 'account.pages.dashboard.stats.multipleSubscriptions_other',
            undefined,
            { count }
        );
    // The listed rows may include unsettled ones (declined, awaiting authorization),
    // so their total is not "active": a neutral count heads the list.
    const listCountText = (count: number): string =>
        t(
            count === 1
                ? 'account.pages.dashboard.stats.subscriptionsCount_one'
                : 'account.pages.dashboard.stats.subscriptionsCount_other',
            undefined,
            { count }
        );
    switch (planStat.kind) {
        case 'single':
            return {
                value: planStat.label,
                hint: t(STATUS_LABEL_KEY[planStat.statusKey]),
                rows: [],
                action: actionFor(planStat.statusKey),
                viewAll: false
            };
        case 'list': {
            const firstAction = planStat.rows
                .map((row) => actionFor(row.statusKey))
                .find((text) => text !== null);
            return {
                value: listCountText(planStat.total),
                hint: null,
                rows: planStat.rows.map((row) => ({
                    plan: row.label,
                    status: t(STATUS_LABEL_KEY[row.statusKey])
                })),
                action: firstAction ?? null,
                viewAll: planStat.hasMore
            };
        }
        case 'multiple':
            return {
                value: countText(planStat.count),
                hint: null,
                rows: [],
                action: null,
                viewAll: false
            };
        case 'free': {
            const card = resolveDashboardFreeCard({
                trialSummaries,
                labels: {
                    free: t('account.pages.dashboard.stats.freeStatus'),
                    trial: t('account.pages.dashboard.stats.trialStatus'),
                    trialEndsOn: t('account.pages.dashboard.stats.trialEndsOn')
                },
                formatDate
            });
            return {
                value: card.value,
                hint: card.statusText,
                rows: [],
                action: null,
                viewAll: false
            };
        }
    }
}
