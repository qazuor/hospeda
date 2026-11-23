/**
 * Pure pieces of the host dashboard (HOS-2474, D19 «tableros separados»).
 *
 * The host dashboard shows HOST data only: properties and unread owner
 * conversations. The account plan summary lives on the general dashboard and
 * is not repeated here (AC-11 compares {@link HOST_DASHBOARD_WIDGETS} with the
 * general dashboard's list).
 *
 * @module lib/account/host-dashboard
 */

import type { DashboardRow } from '@/lib/account/dashboard-rows';

/** Stable ids of the host dashboard's widgets (`data-widget`). */
export const HOST_DASHBOARD_WIDGETS = ['hostProperties', 'hostUnreadMessages'] as const;

/** Quick actions of the host dashboard, as list rows. */
export const HOST_QUICK_ACTIONS: readonly DashboardRow[] = [
    {
        id: 'properties',
        labelKey: 'host.dashboard.quickActions.properties',
        path: 'mi-cuenta/propiedades',
        icon: 'building'
    },
    {
        id: 'promotions',
        labelKey: 'host.dashboard.quickActions.promotions',
        path: 'mi-cuenta/promociones',
        icon: 'megaphone'
    },
    {
        // The OWNER inbox, never the guest one (HOS-2418).
        id: 'ownerMessages',
        labelKey: 'host.dashboard.quickActions.messages',
        path: 'mi-cuenta/consultas-propietario',
        icon: 'chat'
    }
];

/** Subset of `GET /protected/host/dashboard` this page reads. */
export interface HostDashboardPayload {
    readonly properties?: {
        readonly total?: number;
        readonly published?: number;
        readonly draft?: number;
    };
    readonly unreadConversations?: number;
    /** Sections whose zeros are a server-side failure fallback (HOS-2424). */
    readonly unavailable?: readonly string[];
}

/** Property counts the host dashboard renders, or `null` when not trustworthy. */
export interface HostPropertyCounts {
    readonly total: number;
    readonly published: number;
    readonly draft: number;
}

/** What the host dashboard draws once the read settled. */
export type HostDashboardOutcome =
    | { readonly kind: 'locked' }
    | { readonly kind: 'error' }
    | {
          readonly kind: 'ready';
          /** `null` when the API flagged the section as a failure fallback. */
          readonly properties: HostPropertyCounts | null;
          /** `null` when the API flagged the count as a failure fallback. */
          readonly unread: number | null;
      };

/** Error code the API answers to a host whose plan lacks `view_basic_stats`. */
const ENTITLEMENT_REQUIRED = 'ENTITLEMENT_REQUIRED';

/**
 * Turns the host dashboard read into what the page draws.
 *
 * A refusal for a missing entitlement is a LOCK, explained with the catalog
 * plans (HOS-2214), never a raw «Entitlement required». Any other refusal is
 * an error with retry. A section the API flagged in `unavailable` (or a number
 * missing from the payload) is `null`, which renders «—», never `0`.
 *
 * @param input.result - The API result of `hostDashboardApi.get()`.
 * @returns The outcome to render.
 */
export function resolveHostDashboardOutcome({
    result
}: {
    readonly result:
        | { readonly ok: true; readonly data: HostDashboardPayload }
        | { readonly ok: false; readonly error: { readonly code?: string } };
}): HostDashboardOutcome {
    if (!result.ok) {
        return result.error.code === ENTITLEMENT_REQUIRED ? { kind: 'locked' } : { kind: 'error' };
    }
    const unavailable = result.data.unavailable ?? [];
    const props = result.data.properties;
    const properties =
        !unavailable.includes('properties') &&
        typeof props?.total === 'number' &&
        typeof props.published === 'number' &&
        typeof props.draft === 'number'
            ? { total: props.total, published: props.published, draft: props.draft }
            : null;
    const unreadRaw = result.data.unreadConversations;
    const unread =
        !unavailable.includes('unreadConversations') && typeof unreadRaw === 'number'
            ? unreadRaw
            : null;
    return { kind: 'ready', properties, unread };
}
