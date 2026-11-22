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

/** Status line key per exact subscription status of a single plan. */
const STATUS_LABEL_KEY = {
    active: 'account.pages.dashboard.stats.activeStatus',
    'grace-period': 'account.pages.dashboard.stats.gracePeriodStatus',
    suspended: 'account.pages.dashboard.stats.suspendedStatus',
    'cancel-scheduled': 'account.pages.dashboard.stats.cancelScheduledStatus',
    paused: 'account.pages.dashboard.stats.pausedStatus'
} as const;

/** Text the subscription StatCard shows once the reads answered. */
export interface SubscriptionStatText {
    /** Main value (plan name, «Gratuito», «En prueba», «2 suscripciones activas»). */
    readonly value: string;
    /** Status line, or `null`. */
    readonly hint: string | null;
}

/**
 * What the subscription StatCard says.
 *
 * A single live plan shows its catalog name and its exact status; two or more
 * show the count (HOS-1066); none asks the trial first (HOS-1996) and only
 * then falls back to the free label.
 *
 * @param input.stats - `GET /protected/users/me/stats`.
 * @param input.planNames - Translated names by catalog slug (read on the server).
 * @param input.trialSummaries - Trial reads that answered; failed reads left out.
 * @param input.t - Translator for the fixed copy.
 * @param input.formatDate - Formats an ISO instant, `null` when it cannot.
 * @returns The value and the optional status line.
 */
export function resolveSubscriptionStatText({
    stats,
    planNames,
    trialSummaries,
    t,
    formatDate
}: {
    readonly stats: Pick<UserStatsResponse, 'plan' | 'activeSubscriptionsCount'>;
    readonly planNames: Readonly<Record<string, string>>;
    readonly trialSummaries: readonly TrialSummaryResponse[];
    readonly t: TranslationFn;
    readonly formatDate: (iso: string) => string | null;
}): SubscriptionStatText {
    const planStat = resolveDashboardPlanStat({
        plan: stats.plan,
        activeSubscriptionsCount: stats.activeSubscriptionsCount,
        planNames
    });
    switch (planStat.kind) {
        case 'single':
            return { value: planStat.label, hint: t(STATUS_LABEL_KEY[planStat.statusKey]) };
        case 'multiple':
            return {
                value: t(
                    planStat.count === 1
                        ? 'account.pages.dashboard.stats.multipleSubscriptions_one'
                        : 'account.pages.dashboard.stats.multipleSubscriptions_other',
                    undefined,
                    { count: planStat.count }
                ),
                hint: null
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
            return { value: card.value, hint: card.statusText };
        }
    }
}
