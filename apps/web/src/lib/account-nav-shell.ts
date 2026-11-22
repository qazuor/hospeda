/**
 * @file account-nav-shell.ts
 * @description The zoned view the kit shell renders (HOS-2551, owner decisions
 * of 22/11): the account sidebar and the mobile drawer show EITHER the personal
 * zone OR the business zone, depending on the page.
 *
 * - **Personal zone** (`/mi-cuenta/`, profile pages, former tourist pages and
 *   any page that is not a business page): «Inicio», «Mi perfil», «Mis viajes»
 *   and the discovery doors. «Qué hay de nuevo» and «Ayuda» are header icons
 *   (HOS-2550), not sidebar entries.
 * - **Business zone** (host, comercio, editorial, partner and provider pages):
 *   only the business verticals the person has, under a «← Mi cuenta» link
 *   (the link itself is added by the view).
 *
 * Pure; it reshapes the group models `buildAccountNavModel` already built.
 *
 * @module lib/account-nav-shell
 */

import {
    BUSINESS_GROUP_IDS,
    HOME_GROUP_ID,
    PARTNER_NAV_GROUP,
    PROFILE_GROUP_ID,
    PROFILE_NAV_ITEM_IDS
} from '@/config/account-zones';
import {
    ACCOUNT_NAV_GROUPS,
    AI_ASSISTANTS_NAV_ITEM_ID,
    DASHBOARD_NAV_ITEM_ID,
    PROVIDER_NAV_GROUP
} from '@/config/navigation';
import {
    ACCOUNT_GROUP_ID,
    resolveShellGroupOpen,
    TOURIST_GROUP_ID
} from '@/lib/account-nav-collapse';
import type {
    AccountNavDoorModel,
    AccountNavGroupModel,
    AccountNavItemModel
} from '@/lib/account-nav-model';
import { getActiveSectionKey } from '@/lib/account-nav-section';

/** Which zone the kit shell shows (HOS-2551). */
export type AccountNavMode = 'personal' | 'business';

/** What the kit shell (sidebar and mobile drawer) renders (HOS-2551). */
export interface AccountShellNavModel {
    /** Which zone is shown. */
    readonly mode: AccountNavMode;
    /** The groups of that zone, in render order. */
    readonly groups: readonly AccountNavGroupModel[];
    /** Discovery doors: in the personal zone only. */
    readonly doors: readonly AccountNavDoorModel[];
}

/** Input for {@link buildShellNavModel}. */
export interface BuildShellNavModelParams {
    /** The full group models of `buildAccountNavModel`, in render order. */
    readonly groups: readonly AccountNavGroupModel[];
    /** The visible discovery doors. */
    readonly doors: readonly AccountNavDoorModel[];
    /** The page's `activeSection`. */
    readonly activeSection: string;
    /** Whether the account owns a partner row (adds the partner group). */
    readonly ownsPartner: boolean;
    /** Whether the person is a real client (has a business vertical). */
    readonly isClient: boolean;
}

/** i18n key of the «Inicio» label of the `/mi-cuenta/` link. */
const HOME_LABEL_KEY = 'account.nav.home';

/** i18n key of «Mi perfil». */
const PROFILE_LABEL_KEY = 'account.nav.groupProfile';

/** i18n key of «Mis viajes», the former tourist area. */
const TRIPS_LABEL_KEY = 'account.nav.groupTrips';

/**
 * Every `activeSection` that belongs to the business zone, whether or not the
 * person can see the entry (a page that refuses access still sits in its zone).
 */
export const BUSINESS_SECTION_KEYS: ReadonlySet<string> = new Set(
    [...ACCOUNT_NAV_GROUPS, PARTNER_NAV_GROUP, PROVIDER_NAV_GROUP]
        .filter((group) => (BUSINESS_GROUP_IDS as readonly string[]).includes(group.id))
        .flatMap((group) => group.items.map((item) => getActiveSectionKey({ href: item.href })))
);

/**
 * Recomputes `shellDefaultOpen` over a list of groups (HOS-2549): only the
 * group holding the current page opens, or the first headed one when none does.
 *
 * @param input - Options object.
 * @param input.groups - Groups with their `suppressHeader` already final.
 * @returns New group models; the input is not mutated.
 */
export function withShellOpen({
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

/** Builds a group model from already-built item models. */
function groupOf({
    id,
    i18nKey,
    items,
    suppressHeader
}: {
    readonly id: string;
    readonly i18nKey: string;
    readonly items: readonly AccountNavItemModel[];
    readonly suppressHeader: boolean;
}): AccountNavGroupModel {
    const containsActive = items.some((entry) => entry.active);
    return {
        group: { id, i18nKey, items: items.map((entry) => entry.item) },
        items,
        suppressHeader,
        containsActive,
        defaultOpen: true,
        shellDefaultOpen: false
    };
}

/** Picks the item models with the given ids, in that order. */
function pick({
    source,
    ids
}: {
    readonly source: AccountNavGroupModel | undefined;
    readonly ids: readonly string[];
}): readonly AccountNavItemModel[] {
    return ids.flatMap((id) => {
        const found = source?.items.find((entry) => entry.item.id === id);
        return found ? [found] : [];
    });
}

/** The partner group model, when the account owns a partner row. */
function partnerGroup({ activeSection }: { readonly activeSection: string }): AccountNavGroupModel {
    const items = PARTNER_NAV_GROUP.items.map((item) => {
        const sectionKey = getActiveSectionKey({ href: item.href });
        return {
            item,
            sectionKey,
            active: sectionKey === activeSection,
            hiddenUntilRevealed: false
        };
    });
    return {
        ...groupOf({
            id: PARTNER_NAV_GROUP.id,
            i18nKey: PARTNER_NAV_GROUP.i18nKey,
            items,
            suppressHeader: items.length === 1
        }),
        group: PARTNER_NAV_GROUP
    };
}

/**
 * Builds the business zone: the verticals the person has, in
 * `BUSINESS_GROUP_IDS` order. A single vertical renders header-less.
 */
function businessZone({
    groups,
    activeSection,
    ownsPartner
}: Pick<
    BuildShellNavModelParams,
    'groups' | 'activeSection' | 'ownsPartner'
>): AccountShellNavModel {
    const byId = new Map(groups.map((entry) => [entry.group.id, entry]));
    if (ownsPartner) byId.set(PARTNER_NAV_GROUP.id, partnerGroup({ activeSection }));
    const verticals = BUSINESS_GROUP_IDS.flatMap((id) => {
        const found = byId.get(id);
        return found ? [found] : [];
    });
    const single = verticals.length === 1;
    return {
        mode: 'business',
        groups: withShellOpen({
            groups: verticals.map((entry) => ({
                ...entry,
                suppressHeader: single || entry.suppressHeader
            }))
        }),
        doors: []
    };
}

/**
 * Builds the personal zone: «Inicio», «Mi perfil» («Asistentes de IA» only
 * for a real client), «Mis viajes», then the doors.
 * Only the titled group holding the current page opens; when the current
 * page sits in a header-less group (or none), every titled group opens.
 */
function personalZone({
    groups,
    doors,
    isClient
}: Pick<BuildShellNavModelParams, 'groups' | 'doors' | 'isClient'>): AccountShellNavModel {
    const account = groups.find((entry) => entry.group.id === ACCOUNT_GROUP_ID);
    const tourist = groups.find((entry) => entry.group.id === TOURIST_GROUP_ID);
    const home = pick({ source: account, ids: [DASHBOARD_NAV_ITEM_ID] }).map((entry) => ({
        ...entry,
        item: { ...entry.item, i18nKey: HOME_LABEL_KEY }
    }));
    const profileIds = PROFILE_NAV_ITEM_IDS.filter(
        (id) => isClient || id !== AI_ASSISTANTS_NAV_ITEM_ID
    );
    const zone = [
        groupOf({ id: HOME_GROUP_ID, i18nKey: HOME_LABEL_KEY, items: home, suppressHeader: true }),
        groupOf({
            id: PROFILE_GROUP_ID,
            i18nKey: PROFILE_LABEL_KEY,
            items: pick({ source: account, ids: profileIds }),
            suppressHeader: false
        }),
        groupOf({
            id: TOURIST_GROUP_ID,
            i18nKey: TRIPS_LABEL_KEY,
            items: tourist?.items ?? [],
            suppressHeader: false
        })
    ].filter((entry) => entry.items.length > 0);
    // On a page whose entry sits in a header-less group (the `/mi-cuenta/`
    // home under «Inicio») no titled group holds the current page, and the
    // HOS-2549 rule would leave «Mi perfil» and «Mis viajes» both collapsed.
    // There every titled personal group opens; a remembered state still wins.
    const activeInTitledGroup = zone.some((entry) => entry.containsActive && !entry.suppressHeader);
    const zoneGroups = activeInTitledGroup
        ? withShellOpen({ groups: zone })
        : zone.map((entry) => ({ ...entry, shellDefaultOpen: !entry.suppressHeader }));
    return { mode: 'personal', groups: zoneGroups, doors };
}

/**
 * Builds the kit shell's zoned view (HOS-2551). A page is in the business zone
 * when its `activeSection` is one of {@link BUSINESS_SECTION_KEYS}; every
 * other account page is in the personal zone.
 *
 * @param params - See {@link BuildShellNavModelParams}.
 * @returns See {@link AccountShellNavModel}.
 */
export function buildShellNavModel({
    groups,
    doors,
    activeSection,
    ownsPartner,
    isClient
}: BuildShellNavModelParams): AccountShellNavModel {
    if (BUSINESS_SECTION_KEYS.has(activeSection)) {
        return businessZone({ groups, activeSection, ownsPartner });
    }
    return personalZone({ groups, doors, isClient });
}
