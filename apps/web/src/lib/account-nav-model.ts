/**
 * @file account-nav-model.ts
 * @description The DATA behind the Mi Cuenta navigation, extracted from
 * `AccountLayout.astro` (HOS-2413 T-017) so the legacy layout, the new
 * `AccountSidebar` and the mobile `AccountDrawer` all consume one tested
 * model instead of three copies of the same filtering.
 *
 * It is pure: no `Astro`, no session read. The layout frontmatter keeps reading
 * the session and passes the facts in (`roles`, `permissions`,
 * `ownsHostTradeListing`, `ownsPartner`, `mcpEnabled`, `activeSection`), which
 * also keeps every page that renders this session-blind.
 *
 * What it computes, in the order the legacy layout did:
 *
 * 1. the sidebar groups, gated by role (`getNavForSurface` + `isVisibleByRoles`);
 * 2. the provider group, placed right before Tourist (`placeProviderGroup`);
 * 3. per group: whether its header is suppressed, whether it holds the active
 *    page and whether it renders open (`resolveGroupDefaultOpen`);
 * 4. per item: its section key (through `ACTIVE_SECTION_OVERRIDES`) and whether
 *    it is the active one. The «Asistentes de IA» entry is dropped unless the
 *    person is a real client and the MCP feature is on (HOS-2562);
 * 5. the discovery doors and their labels;
 * 6. the i18n key of the active entry, for the mobile bar;
 * 7. the kit shell's zoned view (HOS-2551, `buildShellNavModel` in
 *    `account-nav-shell.ts`): the personal zone or the business zone.
 *
 * @module lib/account-nav-model
 */

import { isRealClient } from '@repo/schemas';
import type { DiscoveryDoor } from '@/config/discovery-doors';
import { ACCOUNT_DISCOVERY_DOORS } from '@/config/discovery-doors';
import type { NavGroup, NavItem } from '@/config/navigation';
import {
    ADDONS_NAV_ITEM_ID,
    AI_ASSISTANTS_NAV_ITEM_ID,
    getNavForSurface,
    PROVIDER_NAV_GROUP
} from '@/config/navigation';
import { placeProviderGroup, resolveGroupDefaultOpen } from '@/lib/account-nav-collapse';
import { getActiveSectionKey } from '@/lib/account-nav-section';
import {
    type AccountShellNavModel,
    buildShellNavModel,
    withShellOpen
} from '@/lib/account-nav-shell';
import { isDoorVisible, isVisibleByRoles, resolveDoorLabelKey } from '@/lib/nav-gating';

export { ACTIVE_SECTION_OVERRIDES, getActiveSectionKey } from '@/lib/account-nav-section';
export type { AccountNavMode, AccountShellNavModel } from '@/lib/account-nav-shell';

/** i18n key of the generic menu label, used when no single entry is active. */
export const ACCOUNT_MENU_LABEL_KEY = 'account.menu';

/** Facts the layout reads from the request and hands to the model. */
export interface AccountNavModelInput {
    /** Whether a successful owner read found at least one subscription. Absent hides add-ons. */
    readonly hasSubscription?: boolean;
    /** The session's role SET (HOS-296), or `null` for no session. */
    readonly roles: readonly string[] | null;
    /**
     * The session's EFFECTIVE permissions (`SessionUser.permissions`). They,
     * with the ownership facts, decide whether the person is a real client
     * (HOS-2562), through the same rule the API applies. Optional: absent
     * reads as none (fail-closed).
     */
    readonly permissions?: readonly string[];
    /** Row-ownership answer for the provider group (HOS-278 AC-7). */
    readonly ownsHostTradeListing: boolean;
    /**
     * Row-ownership answer for the partner group (HOS-2551), from
     * `SessionUser.ownsPartner`. Optional: absent defaults to `false`.
     */
    readonly ownsPartner?: boolean;
    /**
     * Whether the MCP feature is on. «Asistentes de IA» is listed only for a
     * real client AND with the feature on (HOS-2562).
     */
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

/** What {@link buildAccountNavModel} returns. */
export interface AccountNavModel {
    /** Visible groups in render order (provider right before Tourist), as the LEGACY layout lists them. */
    readonly groups: readonly AccountNavGroupModel[];
    /** Visible discovery doors. */
    readonly doors: readonly AccountNavDoorModel[];
    /** i18n key of the active entry, or {@link ACCOUNT_MENU_LABEL_KEY}. */
    readonly activeLabelKey: string;
    /** The zoned view of the kit shell (HOS-2551). */
    readonly shell: AccountShellNavModel;
}

/**
 * Builds the navigation model for a request.
 *
 * @param input - See {@link AccountNavModelInput}.
 * @returns The groups, the doors, the active label key and the shell's split view.
 */
export function buildAccountNavModel({
    roles,
    permissions = [],
    ownsHostTradeListing,
    ownsPartner = false,
    mcpEnabled,
    hasSubscription = false,
    activeSection
}: AccountNavModelInput): AccountNavModel {
    const visibility = (node: Parameters<typeof isVisibleByRoles>[0]) =>
        isVisibleByRoles(node, roles);
    // HOS-2562: «Asistentes de IA» exists only for a real client, decided by
    // the shared rule from the EFFECTIVE permissions (never the roles), and
    // only while the MCP feature is on.
    const showAiAssistants =
        mcpEnabled && isRealClient({ permissions, ownsHostTradeListing, ownsPartner });

    const { groups: baseGroups } = getNavForSurface({ surface: 'sidebar', visibility });

    const ordered = placeProviderGroup({
        groups: baseGroups,
        providerGroup: ownsHostTradeListing ? PROVIDER_NAV_GROUP : null
    });

    const visibleGroupIds = ordered.map((group) => group.id);

    const groups = withShellOpen({
        groups: ordered.map((group): AccountNavGroupModel => {
            const items: AccountNavItemModel[] = group.items
                .filter((item) => showAiAssistants || item.id !== AI_ASSISTANTS_NAV_ITEM_ID)
                .filter((item) => hasSubscription || item.id !== ADDONS_NAV_ITEM_ID)
                .map((item) => {
                    const sectionKey = getActiveSectionKey({ href: item.href });
                    return { item, sectionKey, active: sectionKey === activeSection };
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

    const shell = buildShellNavModel({
        groups,
        doors,
        activeSection,
        ownsPartner
    });

    // Legacy groups first; the partner entry only exists in the shell.
    const activeItem = [...groups, ...shell.groups]
        .flatMap((group) => group.items)
        .find((entry) => entry.active);
    const activeDoor = doors.find((entry) => entry.active);
    const activeLabelKey =
        activeItem?.item.i18nKey ?? activeDoor?.labelKey ?? ACCOUNT_MENU_LABEL_KEY;

    return { groups, doors, activeLabelKey, shell };
}
