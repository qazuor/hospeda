/**
 * Serializable view of the account navigation (HOS-2413 T-019 / T-021).
 *
 * `AccountNavModel` (`lib/account-nav-model.ts`) holds icon components, which
 * cannot cross an Astro island boundary. This helper resolves labels and URLs
 * into plain data, so ONE view feeds both the server-rendered `AccountSidebar`
 * and the hydrated mobile `AccountDrawer`, and they list the same groups by
 * construction.
 *
 * It renders the kit shell's split view (HOS-2551, `model.shell`): on a
 * personal page the personal entries under a «Mis áreas» link, anywhere else
 * only the areas.
 *
 * @module components/account/ui/account-sidebar-view
 */

import { DASHBOARD_NAV_ITEM_ID } from '@/config/navigation';
import type { AccountNavMode, AccountNavModel } from '@/lib/account-nav-model';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';

/** One link of the sidebar. */
export interface SidebarItemView {
    /** Stable id (nav item id or door id). */
    readonly id: string;
    /** Translated label. */
    readonly label: string;
    /** Absolute-path URL. */
    readonly href: string;
    /** True for the current page. */
    readonly active: boolean;
    /** True when the entry renders `hidden` until an island reveals it. */
    readonly hidden: boolean;
    /** `data-tour` target of the welcome tour, if any. */
    readonly tourTarget?: string;
}

/** One group of the sidebar. */
export interface SidebarGroupView {
    /** Group id. */
    readonly id: string;
    /** Translated group label. */
    readonly label: string;
    /** True when the header is suppressed (a single-item «cajón»). */
    readonly suppressHeader: boolean;
    /** True when it holds the current page. */
    readonly containsActive: boolean;
    /** Whether it renders open. */
    readonly open: boolean;
    /** Its links. */
    readonly items: readonly SidebarItemView[];
}

/** The whole sidebar view. */
export interface SidebarView {
    /** Which half of the account it shows (HOS-2551). */
    readonly mode: AccountNavMode;
    /** The «Mis áreas» link to `/mi-cuenta/`, shown on top on a personal page only. */
    readonly areasLink: SidebarItemView | null;
    /** Nav groups, in order. */
    readonly groups: readonly SidebarGroupView[];
    /** Translated label of the discovery-doors block. */
    readonly doorsLabel: string;
    /** Discovery doors. */
    readonly doors: readonly SidebarItemView[];
    /** Translated label of the active entry (the mobile bar shows it). */
    readonly activeLabel: string;
}

/**
 * Resolves an `AccountNavModel` into a serializable {@link SidebarView}.
 *
 * @param input - Options object.
 * @param input.model - The navigation model.
 * @param input.locale - Locale for labels and URLs.
 * @returns The plain-data view.
 */
export function buildSidebarView({
    model,
    locale
}: {
    readonly model: AccountNavModel;
    readonly locale: SupportedLocale;
}): SidebarView {
    const t = createT(locale);
    const { shell } = model;
    return {
        mode: shell.mode,
        areasLink:
            shell.mode === 'personal'
                ? {
                      id: DASHBOARD_NAV_ITEM_ID,
                      label: t('account.ui.sidebar.areasLink'),
                      href: buildUrl({ locale, path: 'mi-cuenta' }),
                      active: false,
                      hidden: false
                  }
                : null,
        groups: shell.groups.map((entry) => ({
            id: entry.group.id,
            label: t(entry.group.i18nKey),
            suppressHeader: entry.suppressHeader,
            containsActive: entry.containsActive,
            open: entry.shellDefaultOpen,
            items: entry.items.map((item) => ({
                id: item.item.id,
                label: t(item.item.i18nKey),
                href: buildUrl({ locale, path: item.item.href }),
                active: item.active,
                hidden: item.hiddenUntilRevealed,
                tourTarget: item.item.tourTarget
            }))
        })),
        doorsLabel: t('account.doors.sectionLabel'),
        doors: shell.doors.map((door) => ({
            id: door.door.id,
            label: t(door.labelKey),
            href: buildUrl({ locale, path: door.door.href }),
            active: door.active,
            hidden: false
        })),
        activeLabel: t(model.activeLabelKey)
    };
}
