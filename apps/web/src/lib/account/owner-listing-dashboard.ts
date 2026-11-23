/**
 * Pure pieces of the venue and experience owner dashboards (HOS-2475,
 * HOS-2476).
 *
 * Both dashboards read ONE aggregate (`GET /protected/{venues|experiences}/
 * mine/stats`, HOS-2414 Q2) and draw two widgets from it. This module turns
 * that read into the state of each widget so the rules are testable without
 * rendering: a failed read is an error on every widget, a locked traffic block
 * is a lock (never `0`), and an unavailable traffic block is an error with
 * retry (never `0`).
 *
 * @module lib/account/owner-listing-dashboard
 */

import {
    type OwnerDashboardVertical,
    type OwnerListingDashboard,
    PermissionEnum
} from '@repo/schemas';
import type { DashboardRow } from '@/lib/account/dashboard-rows';
import { buildLoginRedirect } from '@/lib/auth-redirect';
import type { SupportedLocale } from '@/lib/i18n';
import { isVisibleByRoles } from '@/lib/nav-gating';
import { PUBLISH_PAGE_PATH_BY_VERTICAL } from '@/lib/publish/publish-page-paths';
import { buildUrl } from '@/lib/urls';

/** Stable widget ids per vertical (`data-widget`). */
export const OWNER_DASHBOARD_WIDGETS: Readonly<
    Record<OwnerDashboardVertical, readonly [string, string]>
> = {
    venue: ['venueListings', 'venueTraffic'],
    experience: ['experienceListings', 'experienceTraffic']
};

/** Page path of each owner dashboard. */
export const OWNER_DASHBOARD_PATH: Readonly<Record<OwnerDashboardVertical, string>> = {
    venue: 'mi-cuenta/tablero-locales',
    experience: 'mi-cuenta/tablero-experiencias'
};

/** Own-listing permission each owner dashboard requires (never a role literal). */
export const OWNER_DASHBOARD_PERMISSION: Readonly<Record<OwnerDashboardVertical, PermissionEnum>> =
    {
        venue: PermissionEnum.VENUE_EDIT_OWN,
        experience: PermissionEnum.EXPERIENCE_EDIT_OWN
    };

/**
 * Where an owner-dashboard request must be redirected, or `null` to render.
 *
 * Anonymous → login (middleware already does it; this is the safety net).
 * Signed in without the vertical's permission → the account home.
 *
 * @param input - Vertical, the session's roles (`null` when anonymous), locale and current URL.
 * @returns A redirect target, or `null`.
 */
export function resolveOwnerDashboardRedirect({
    vertical,
    roles,
    locale,
    currentUrl
}: {
    readonly vertical: OwnerDashboardVertical;
    readonly roles: readonly string[] | null;
    readonly locale: SupportedLocale;
    readonly currentUrl: string;
}): string | null {
    if (roles === null) return buildLoginRedirect({ locale, currentUrl });
    return isVisibleByRoles({ requiredPermission: OWNER_DASHBOARD_PERMISSION[vertical] }, roles)
        ? null
        : buildUrl({ locale, path: 'mi-cuenta' });
}

/** Quick actions of an owner dashboard. */
export function buildOwnerDashboardRows({
    vertical
}: {
    readonly vertical: OwnerDashboardVertical;
}): readonly DashboardRow[] {
    return [
        {
            id: 'listings',
            labelKey: `account.ownerDashboard.${vertical}.listingsLink`,
            descriptionKey: `account.ownerDashboard.${vertical}.listingsLinkDesc`,
            path: 'mi-cuenta/comercio',
            icon: 'briefcase'
        },
        {
            id: 'newListing',
            labelKey: `account.ownerDashboard.${vertical}.newListing`,
            path: PUBLISH_PAGE_PATH_BY_VERTICAL[vertical],
            icon: 'building'
        }
    ];
}

/** State of one owner-dashboard widget. */
export type OwnerWidgetState<T> =
    | { readonly status: 'loading' }
    | { readonly status: 'error' }
    | { readonly status: 'locked' }
    | { readonly status: 'ready'; readonly data: T };

/** What the dashboard draws, widget by widget. */
export interface OwnerDashboardView {
    readonly listings: OwnerWidgetState<OwnerListingDashboard['listings']>;
    readonly traffic: OwnerWidgetState<{
        readonly windowDays: number;
        readonly unique: number;
        readonly total: number;
    }>;
    /** True only once the read succeeded AND the owner has no listing at all. */
    readonly isEmpty: boolean;
}

/**
 * Turns the aggregate read into the state of each widget.
 *
 * @param input.read - `loading`, `error`, or the successful payload.
 * @returns The per-widget view.
 */
export function resolveOwnerDashboardView({
    read
}: {
    readonly read:
        | { readonly status: 'loading' }
        | { readonly status: 'error' }
        | { readonly status: 'ready'; readonly data: OwnerListingDashboard };
}): OwnerDashboardView {
    if (read.status !== 'ready') {
        return { listings: read, traffic: read, isEmpty: false };
    }
    const { data } = read;
    const traffic: OwnerDashboardView['traffic'] =
        data.trafficAccess === 'granted'
            ? { status: 'ready', data: data.traffic }
            : data.trafficAccess === 'locked'
              ? { status: 'locked' }
              : { status: 'error' };
    return {
        listings: { status: 'ready', data: data.listings },
        traffic,
        isEmpty: data.listings.total === 0
    };
}
