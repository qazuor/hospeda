/**
 * @file account-nav-model.ts
 * @description The DATA behind the Mi Cuenta navigation, extracted from
 * `AccountLayout.astro` (HOS-2413 T-017) so the legacy layout, the new
 * `AccountSidebar` and the mobile `AccountDrawer` all consume one tested
 * model instead of three copies of the same filtering.
 *
 * It is pure: no `Astro`, no session read. The layout frontmatter keeps reading
 * the session and passes the facts in (`roles`, `ownsHostTradeListing`,
 * `mcpEnabled`, `activeSection`), which also keeps every page that renders this
 * session-blind.
 *
 * What it computes, in the order the legacy layout did:
 *
 * 1. the sidebar groups, gated by role (`getNavForSurface` + `isVisibleByRoles`);
 * 2. the provider group, placed right before Tourist (`placeProviderGroup`);
 * 3. per group: whether its header is suppressed, whether it holds the active
 *    page and whether it renders open (`resolveGroupDefaultOpen`);
 * 4. per item: its section key (through `ACTIVE_SECTION_OVERRIDES`), whether it
 *    is the active one, and whether the AI-assistants entry starts hidden;
 * 5. the discovery doors and their labels;
 * 6. the i18n key of the active entry, for the mobile bar;
 * 7. the kit shell's split view (HOS-2551, {@link AccountShellNavModel}): on a
 *    personal page only the personal entries, otherwise only the areas.
 *
 * @module lib/account-nav-model
 */

import type { DiscoveryDoor } from '@/config/discovery-doors';
import { ACCOUNT_DISCOVERY_DOORS } from '@/config/discovery-doors';
import type { NavGroup, NavItem } from '@/config/navigation';
import {
    AI_ASSISTANTS_NAV_ITEM_ID,
    getNavForSurface,
    INTERIM_PERSONAL_NAV_ITEM_IDS,
    PERSONAL_NAV_ITEM_IDS,
    PROVIDER_NAV_GROUP
} from '@/config/navigation';
import {
    ACCOUNT_GROUP_ID,
    placeProviderGroup,
    resolveGroupDefaultOpen,
    resolveShellGroupOpen
} from '@/lib/account-nav-collapse';
import { isDoorVisible, isVisibleByRoles, resolveDoorLabelKey } from '@/lib/nav-gating';

/**
 * `activeSection` (passed by every `/mi-cuenta/*` page) predates the nav
 * config's item `href`s and diverges from the URL path segment for the two
 * "consultas" routes: the guest inbox page passes `messages` and the owner
 * inbox page passes `owner-messages`, not `consultas`/`consultas-propietario`.
 * Kept as an explicit override (rather than renamed across every consuming
 * page) so the active-state highlight matches exactly what it did before
 * this was extracted (HOS-131 T-007).
 */
export const ACTIVE_SECTION_OVERRIDES: Readonly<Record<string, string>> = {
    'mi-cuenta/consultas': 'messages',
    'mi-cuenta/consultas-propietario': 'owner-messages'
};

/** i18n key of the generic menu label, used when no single entry is active. */
export const ACCOUNT_MENU_LABEL_KEY = 'account.menu';

/**
 * Derives the `activeSection`-comparable key for a nav item's `href`.
 *
 * @param input - Options object.
 * @param input.href - The item's path segment (e.g. `mi-cuenta/editar`).
 * @returns The section key to compare against the `activeSection` prop.
 */
export function getActiveSectionKey({ href }: { readonly href: string }): string {
    const override = ACTIVE_SECTION_OVERRIDES[href];
    if (override) return override;
    return href === 'mi-cuenta' ? href : href.replace('mi-cuenta/', '');
}

/** Facts the layout reads from the request and hands to the model. */
export interface AccountNavModelInput {
    /** The session's role SET (HOS-296), or `null` for no session. */
    readonly roles: readonly string[] | null;
    /** Row-ownership answer for the provider group (HOS-278 AC-7). */
    readonly ownsHostTradeListing: boolean;
    /** Whether the MCP feature is on (the AI-assistants entry is gated on it). */
    readonly mcpEnabled: boolean;
    /** The page's `activeSection` prop. */
    readonly activeSection: string;
}

/** One item of the model. */
export interface AccountNavItemModel {
    /** The nav config item. */
    readonly item: NavItem;
    /** Its section key, to compare with `activeSection`. */
    readonly sectionKey: string;
    /** True for the entry of the current page. */
    readonly active: boolean;
    /** True when the AI-assistants entry must render `hidden` until revealed. */
    readonly hiddenUntilRevealed: boolean;
}

/** One group of the model. */
export interface AccountNavGroupModel {
    /** The nav config group (id, i18n key). */
    readonly group: NavGroup;
    /** Its items, in order. */
    readonly items: readonly AccountNavItemModel[];
    /** True when the header is hidden (a single-item «cajón» group). */
    readonly suppressHeader: boolean;
    /** True when the current page belongs to this group. */
    readonly containsActive: boolean;
    /** Whether the group renders open on the server in the LEGACY layout. */
    readonly defaultOpen: boolean;
    /** Whether the group renders open in the kit shell (active group only, HOS-2549). */
    readonly shellDefaultOpen: boolean;
}

/** One discovery door of the model. */
export interface AccountNavDoorModel {
    /** The door config. */
    readonly door: DiscoveryDoor;
    /** i18n key of its label (the stateful variant once acquired). */
    readonly labelKey: string;
    /** Its section key. */
    readonly sectionKey: string;
    /** True for the door of the current page. */
    readonly active: boolean;
}

/**
 * Which half of the account the kit shell's sidebar shows (HOS-2551):
 * `personal` on a personal page (profile, subscription, preferences...),
 * `areas` everywhere else, including the areas home `/mi-cuenta/`.
 */
export type AccountNavMode = 'personal' | 'areas';

/** What the kit shell (sidebar and mobile drawer) renders (HOS-2551). */
export interface AccountShellNavModel {
    /** Which half is shown. */
    readonly mode: AccountNavMode;
    /**
     * `personal`: one header-less group with the personal entries.
     * `areas`: the areas the person has (no `cuenta` group); a single area
     * renders header-less, as a flat list.
     */
    readonly groups: readonly AccountNavGroupModel[];
    /** Discovery doors: shown with the areas, never on a personal page. */
    readonly doors: readonly AccountNavDoorModel[];
}

/** What {@link buildAccountNavModel} returns. */
export interface AccountNavModel {
    /** Visible groups in render order (provider right before Tourist), as the LEGACY layout lists them. */
    readonly groups: readonly AccountNavGroupModel[];
    /** Visible discovery doors. */
    readonly doors: readonly AccountNavDoorModel[];
    /** i18n key of the active entry, or {@link ACCOUNT_MENU_LABEL_KEY}. */
    readonly activeLabelKey: string;
    /** The split view of the kit shell (HOS-2551). */
    readonly shell: AccountShellNavModel;
}

/** Ids the personal sidebar lists, in order (HOS-2551). */
const PERSONAL_SIDEBAR_ITEM_IDS: readonly string[] = [
    ...PERSONAL_NAV_ITEM_IDS,
    ...INTERIM_PERSONAL_NAV_ITEM_IDS
];

/**
 * Recomputes `shellDefaultOpen` over a list of groups (HOS-2549): only the
 * group holding the current page opens, or the first headed one when none does.
 *
 * @param input - Options object.
 * @param input.groups - Groups with their `suppressHeader` already final.
 * @returns New group models; the input is not mutated.
 */
function withShellOpen({
    groups
}: {
    readonly groups: readonly AccountNavGroupModel[];
}): readonly AccountNavGroupModel[] {
    const firstHeadedIndex = groups.findIndex((entry) => !entry.suppressHeader);
    const anyGroupContainsActive = groups.some((entry) => entry.containsActive);
    return groups.map((entry, index) => ({
        ...entry,
        shellDefaultOpen: resolveShellGroupOpen({
            containsActive: entry.containsActive,
            anyGroupContainsActive,
            isFirstHeadedGroup: index === firstHeadedIndex
        })
    }));
}

/**
 * Builds the kit shell's split view (HOS-2551).
 *
 * A page is personal when its `activeSection` matches one of the personal
 * entries. There the sidebar lists only those entries, header-less. Anywhere
 * else it lists only the areas (every group but `cuenta`); when the person has
 * a single area (a pure tourist) that area renders header-less too.
 *
 * @param input - Options object.
 * @param input.groups - The full group models, in render order.
 * @param input.doors - The discovery doors.
 * @returns See {@link AccountShellNavModel}.
 */
export function buildShellNavModel({
    groups,
    doors
}: {
    readonly groups: readonly AccountNavGroupModel[];
    readonly doors: readonly AccountNavDoorModel[];
}): AccountShellNavModel {
    const accountGroup = groups.find((entry) => entry.group.id === ACCOUNT_GROUP_ID);
    const personalItems = PERSONAL_SIDEBAR_ITEM_IDS.flatMap((id) => {
        const found = accountGroup?.items.find((entry) => entry.item.id === id);
        return found ? [found] : [];
    });

    if (accountGroup && personalItems.some((entry) => entry.active)) {
        return {
            mode: 'personal',
            groups: [
                {
                    group: accountGroup.group,
                    items: personalItems,
                    suppressHeader: true,
                    containsActive: true,
                    defaultOpen: true,
                    shellDefaultOpen: true
                }
            ],
            doors: []
        };
    }

    const areaGroups = groups.filter((entry) => entry.group.id !== ACCOUNT_GROUP_ID);
    const singleArea = areaGroups.length === 1;
    return {
        mode: 'areas',
        groups: withShellOpen({
            groups: areaGroups.map((entry) => ({
                ...entry,
                suppressHeader: singleArea || entry.suppressHeader
            }))
        }),
        doors
    };
}

/**
 * Builds the navigation model for a request.
 *
 * @param input - See {@link AccountNavModelInput}.
 * @returns The groups, the doors, the active label key and the shell's split view.
 */
export function buildAccountNavModel({
    roles,
    ownsHostTradeListing,
    mcpEnabled,
    activeSection
}: AccountNavModelInput): AccountNavModel {
    const visibility = (node: Parameters<typeof isVisibleByRoles>[0]) =>
        isVisibleByRoles(node, roles);

    const { groups: baseGroups } = getNavForSurface({ surface: 'sidebar', visibility });

    const ordered = placeProviderGroup({
        groups: baseGroups,
        providerGroup: ownsHostTradeListing ? PROVIDER_NAV_GROUP : null
    });

    const visibleGroupIds = ordered.map((group) => group.id);

    const groups = withShellOpen({
        groups: ordered.map((group): AccountNavGroupModel => {
            const items: AccountNavItemModel[] = group.items.map((item) => {
                const sectionKey = getActiveSectionKey({ href: item.href });
                return {
                    item,
                    sectionKey,
                    active: sectionKey === activeSection,
                    hiddenUntilRevealed: item.id === AI_ASSISTANTS_NAV_ITEM_ID && !mcpEnabled
                };
            });
            const containsActive = items.some((entry) => entry.active);
            return {
                group,
                items,
                suppressHeader: group.suppressHeaderWhenSingle === true && group.items.length === 1,
                containsActive,
                defaultOpen: resolveGroupDefaultOpen({
                    groupId: group.id,
                    visibleGroupIds,
                    containsActive
                }),
                shellDefaultOpen: false
            };
        })
    });

    const doors: AccountNavDoorModel[] = ACCOUNT_DISCOVERY_DOORS.filter((door) =>
        isDoorVisible({ door, visibility })
    ).map((door) => {
        const sectionKey = getActiveSectionKey({ href: door.href });
        return {
            door,
            labelKey: resolveDoorLabelKey({ door, visibility }),
            sectionKey,
            active: sectionKey === activeSection
        };
    });

    const activeItem = groups.flatMap((group) => group.items).find((entry) => entry.active);
    const activeDoor = doors.find((entry) => entry.active);
    const activeLabelKey =
        activeItem?.item.i18nKey ?? activeDoor?.labelKey ?? ACCOUNT_MENU_LABEL_KEY;

    return {
        groups,
        doors,
        activeLabelKey,
        shell: buildShellNavModel({ groups, doors })
    };
}
