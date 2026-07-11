/**
 * @file nav-avatar.ts
 * @description Curated account-nav selection shared by the avatar dropdown
 * (`UserMenu.client.tsx`) and the mobile hamburguesa's account block
 * (`MobileMenu.client.tsx`) — HOS-131 §6.4 (UserMenu curation) and §6.5
 * (mobile "option A": same curated set on both surfaces, not two divergent
 * lists).
 *
 * Both islands render:
 * 1. Identity — the `dashboard` item ("Mi cuenta").
 * 2. Shortcuts — `favorites`, ONE business-panel shortcut (picked by
 *    priority via `pickBusinessShortcut`), `subscription`.
 *
 * The identity/shortcut items themselves come from `ACCOUNT_NAV_GROUPS`
 * (`src/config/navigation.ts`) via `getNavForSurface({ surface: 'avatar' })`
 * — this module only adds the ordering + business-shortcut-priority logic
 * that surface membership alone can't express.
 */

import { ACCOUNT_NAV_GROUPS, getNavForSurface, type NavItem } from '@/config/navigation';
import { isVisibleByPermissions } from '@/lib/nav-gating';

/**
 * Ordered candidate ids for the single business-panel shortcut (HOS-131
 * §6.4: "ONE business-panel shortcut, picked by priority"). Only the first
 * candidate the user has permission for is shown — never both. Future dense
 * verticals (e.g. gastronomy, experiences) append to this list.
 */
const BUSINESS_SHORTCUT_CANDIDATE_IDS: readonly string[] = ['hostDashboard', 'commerce'];

/**
 * Finds a `NavItem` by id anywhere in `ACCOUNT_NAV_GROUPS`, with its
 * effective gating permission resolved. Local helper — keeps the config as
 * the single source of truth for labels/hrefs/icons/permissions instead of
 * duplicating them here.
 *
 * `hostDashboard` and `commerce` (the two business-shortcut candidates)
 * declare `requiredPermission` on their GROUP (`anfitrion`/`comercio`), not
 * on the item itself — mirroring how `getNavForSurface` gates them (group
 * visibility first, then item visibility). Using `item.requiredPermission`
 * alone would silently treat both as always-visible. When the item has no
 * permission of its own, this inherits the owning group's.
 */
function findAccountNavItemById(id: string): NavItem | undefined {
    for (const group of ACCOUNT_NAV_GROUPS) {
        const found = group.items.find((item) => item.id === id);
        if (found) {
            return found.requiredPermission
                ? found
                : { ...found, requiredPermission: group.requiredPermission };
        }
    }
    return undefined;
}

/** Input for `pickBusinessShortcut`. */
export interface PickBusinessShortcutParams {
    /** The user's effective permission strings (pass `[]` while loading — fail-closed). */
    readonly permissions: readonly string[];
}

/** Output of `pickBusinessShortcut`. */
export interface PickBusinessShortcutResult {
    /** The chosen shortcut item, or `null` if the user has none of the candidate permissions. */
    readonly item: NavItem | null;
}

/**
 * Picks the single business-panel shortcut for the avatar dropdown and the
 * mobile account block (HOS-131 §6.4). Walks `BUSINESS_SHORTCUT_CANDIDATE_IDS`
 * in priority order and returns the first item whose `requiredPermission` is
 * present in `permissions` — never more than one, even if the user qualifies
 * for several (e.g. a user with both `accommodation.create` and
 * `commerce.editOwn` sees only "Panel del anfitrión").
 *
 * @param params - `{ permissions }` (RO-RO).
 * @returns `{ item }` — the prioritized shortcut, or `{ item: null }` if none apply.
 */
export function pickBusinessShortcut({
    permissions
}: PickBusinessShortcutParams): PickBusinessShortcutResult {
    for (const id of BUSINESS_SHORTCUT_CANDIDATE_IDS) {
        const candidate = findAccountNavItemById(id);
        if (candidate && isVisibleByPermissions(candidate, permissions)) {
            return { item: candidate };
        }
    }
    return { item: null };
}

/** Input for `getCuratedAccountNav`. */
export interface GetCuratedAccountNavParams {
    /** The user's effective permission strings (pass `[]` while loading — fail-closed). */
    readonly permissions: readonly string[];
}

/** Output of `getCuratedAccountNav`. */
export interface CuratedAccountNav {
    /** The identity-zone "Mi cuenta" link, or `null` if unavailable (should not happen for authenticated users). */
    readonly dashboardItem: NavItem | null;
    /** The shortcuts-zone items, in display order: favorites, business shortcut (if any), subscription. */
    readonly shortcutItems: readonly NavItem[];
}

/**
 * Resolves the full curated account-nav selection for the avatar dropdown
 * and the mobile account block (HOS-131 §6.4/§6.5, mobile "option A" — the
 * SAME curated set on both surfaces). Single selector reused by both
 * islands so they can never drift into two divergent lists.
 *
 * @param params - `{ permissions }` (RO-RO).
 * @returns `{ dashboardItem, shortcutItems }`.
 */
export function getCuratedAccountNav({
    permissions
}: GetCuratedAccountNavParams): CuratedAccountNav {
    const { groups } = getNavForSurface({
        surface: 'avatar',
        visibility: (node) => isVisibleByPermissions(node, permissions)
    });
    const flatItems = groups.flatMap((group) => group.items);
    const findItem = (id: string): NavItem | null =>
        flatItems.find((item) => item.id === id) ?? null;

    const dashboardItem = findItem('dashboard');
    const favoritesItem = findItem('favorites');
    const subscriptionItem = findItem('subscription');
    const { item: businessShortcut } = pickBusinessShortcut({ permissions });

    const shortcutItems = [favoritesItem, businessShortcut, subscriptionItem].filter(
        (item): item is NavItem => item !== null
    );

    return { dashboardItem, shortcutItems };
}
