/**
 * @file nav-avatar.ts
 * @description Desktop avatar navigation (owner decision D2): four registry
 * quick links, then one management shortcut per eligible business vertical.
 * The mobile avatar uses the full sidebar model, not these narrower shortcuts.
 */

import { DASHBOARD_NAV_ITEM_ID, getNavForSurface, type NavItem } from '@/config/navigation';
import { type ResolvedBusinessShortcut, resolveBusinessShortcuts } from '@/lib/business-verticals';
import { isVisibleByPermissions } from '@/lib/nav-gating';

/** i18n key of the «Administración» block title. */
export const ADMINISTRATION_LABEL_KEY = 'account.nav.administration';

/** Input for `getCuratedAccountNav`. */
export interface GetCuratedAccountNavParams {
    /** The user's effective permission strings (pass `[]` while loading — fail-closed). */
    readonly permissions: readonly string[];
    /** Whether the account owns a host-trade listing (provider shortcut). */
    readonly ownsHostTradeListing?: boolean;
    /**
     * Whether the account owns a live partner row (partner shortcut). Comes
     * from `/auth/me` through `useAccountPermissions`; absent reads as `false`.
     */
    readonly ownsPartner?: boolean;
}

/** Output of `getCuratedAccountNav`. */
export interface CuratedAccountNav {
    /** Account, profile, favorites and subscription, from the sidebar registry. */
    readonly quickItems: readonly NavItem[];
    /** The identity-zone «Mi cuenta» link, or `null` if unavailable. */
    readonly dashboardItem: NavItem | null;
    /** The «Administración» shortcuts, in catalog order; empty for a pure tourist. */
    readonly adminItems: readonly ResolvedBusinessShortcut[];
}

/**
 * Resolves desktop quick links and the existing business shortcuts.
 *
 * @param params - See {@link GetCuratedAccountNavParams} (RO-RO).
 * @returns `{ quickItems, dashboardItem, adminItems }`.
 */
export function getCuratedAccountNav({
    permissions,
    ownsHostTradeListing = false,
    ownsPartner = false
}: GetCuratedAccountNavParams): CuratedAccountNav {
    const visibility = (node: Parameters<typeof isVisibleByPermissions>[0]) =>
        isVisibleByPermissions(node, permissions);
    const { groups } = getNavForSurface({ surface: 'sidebar', visibility });
    const items = groups.flatMap((group) => group.items);
    const quickItems = [DASHBOARD_NAV_ITEM_ID, 'editProfile', 'favorites', 'subscription'].flatMap(
        (id) => {
            const item = items.find((entry) => entry.id === id);
            return item ? [item] : [];
        }
    );
    const dashboardItem =
        groups.flatMap((group) => group.items).find((item) => item.id === DASHBOARD_NAV_ITEM_ID) ??
        null;
    return {
        quickItems,
        dashboardItem,
        adminItems: resolveBusinessShortcuts({ permissions, ownsHostTradeListing, ownsPartner })
    };
}
