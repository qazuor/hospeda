/**
 * @file nav-avatar.ts
 * @description The account links of the header user menu (`UserMenu.client.tsx`)
 * and of the mobile hamburguesa's account block (`MobileMenu.client.tsx`).
 * Both render the SAME set (HOS-131 §6.5, mobile "option A"), so they can
 * never drift into two divergent lists.
 *
 * HOS-2551 (owner decisions of 22/11): the set is
 * 1. Identity: the `dashboard` item («Mi cuenta», `/mi-cuenta/`).
 * 2. «Administración»: one «Administrar …» shortcut per business vertical the
 *    person has (`resolveBusinessShortcuts`, catalog in `config/account-zones.ts`).
 *
 * Profile entries, favorites and «Asistentes de IA» are NOT in the menu any
 * more: they live in the personal zone of the account sidebar.
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
     * Whether the account owns a partner row (partner shortcut). No client
     * source carries it yet, so callers leave it `false`.
     */
    readonly ownsPartner?: boolean;
}

/** Output of `getCuratedAccountNav`. */
export interface CuratedAccountNav {
    /** The identity-zone «Mi cuenta» link, or `null` if unavailable. */
    readonly dashboardItem: NavItem | null;
    /** The «Administración» shortcuts, in catalog order; empty for a pure tourist. */
    readonly adminItems: readonly ResolvedBusinessShortcut[];
}

/**
 * Resolves the account links of the user menu and the mobile account block.
 *
 * @param params - See {@link GetCuratedAccountNavParams} (RO-RO).
 * @returns `{ dashboardItem, adminItems }`.
 */
export function getCuratedAccountNav({
    permissions,
    ownsHostTradeListing = false,
    ownsPartner = false
}: GetCuratedAccountNavParams): CuratedAccountNav {
    const visibility = (node: Parameters<typeof isVisibleByPermissions>[0]) =>
        isVisibleByPermissions(node, permissions);
    const { groups } = getNavForSurface({ surface: 'avatar', visibility });
    const dashboardItem =
        groups.flatMap((group) => group.items).find((item) => item.id === DASHBOARD_NAV_ITEM_ID) ??
        null;
    return {
        dashboardItem,
        adminItems: resolveBusinessShortcuts({ visibility, ownsHostTradeListing, ownsPartner })
    };
}
