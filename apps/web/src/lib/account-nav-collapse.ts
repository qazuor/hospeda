/**
 * @file account-nav-collapse.ts
 * @description Pure helpers behind the collapsible account navigation areas
 * (HOS-2124). The server renders each area as a native `<details>` whose `open`
 * attribute comes from `resolveGroupDefaultOpen`; a small client script then
 * applies the browser-remembered state (`parseStoredNavState`) on top, never
 * closing the area that contains the current page.
 */

import type { NavGroup } from '@/config/navigation';

/** Id of the Tourist area, the only one that can start collapsed in the legacy layout. */
export const TOURIST_GROUP_ID = 'turista';

/** Id of the base Account area. */
export const ACCOUNT_GROUP_ID = 'cuenta';

/** localStorage key holding the per-browser open/closed state of each area. */
export const ACCOUNT_NAV_STORAGE_KEY = 'hospeda:account-nav:v1';

/** Remembered open (`true`) / closed (`false`) state, keyed by group id. */
export type StoredNavState = Readonly<Record<string, boolean>>;

/** Input for `resolveGroupDefaultOpen`. */
export interface ResolveGroupDefaultOpenParams {
    /** Id of the group being rendered. */
    readonly groupId: string;
    /** Ids of every group visible to the user, in render order. */
    readonly visibleGroupIds: readonly string[];
    /** Whether the current page belongs to this group. */
    readonly containsActive: boolean;
}

/**
 * LEGACY default (`AccountLayout.astro`): decides whether an area renders open
 * on the server (no JS, no stored state).
 *
 * - The area holding the current page is always open.
 * - Every area is open by default, except Tourist, which starts collapsed
 *   unless the user has no other area besides Cuenta (then collapsing it would
 *   hide the only thing they can do).
 *
 * The kit shell (`AccountShell.astro`) uses {@link resolveShellGroupOpen}.
 *
 * @param params - `{ groupId, visibleGroupIds, containsActive }` (RO-RO).
 * @returns `true` when the `<details>` should carry the `open` attribute.
 */
export function resolveGroupDefaultOpen({
    groupId,
    visibleGroupIds,
    containsActive
}: ResolveGroupDefaultOpenParams): boolean {
    if (containsActive) return true;
    if (groupId !== TOURIST_GROUP_ID) return true;
    const hasOtherArea = visibleGroupIds.some(
        (id) => id !== ACCOUNT_GROUP_ID && id !== TOURIST_GROUP_ID
    );
    return !hasOtherArea;
}

/** Input for `resolveShellGroupOpen`. */
export interface ResolveShellGroupOpenParams {
    /** Whether the current page belongs to this group. */
    readonly containsActive: boolean;
    /** Whether ANY group holds the current page. */
    readonly anyGroupContainsActive: boolean;
    /** Whether this is the first group that renders a header. */
    readonly isFirstHeadedGroup: boolean;
}

/**
 * Default for the kit shell (HOS-2549): only the area holding the current page
 * renders open, which keeps the desktop sidebar short. When no group holds the
 * current page (pages whose `activeSection` matches no nav item, such as
 * `publica`, `partner` or `aliados`) the first headed group opens instead, so
 * the sidebar never renders fully collapsed.
 *
 * @param params - See {@link ResolveShellGroupOpenParams}.
 * @returns `true` when the `<details>` should carry the `open` attribute.
 */
export function resolveShellGroupOpen({
    containsActive,
    anyGroupContainsActive,
    isFirstHeadedGroup
}: ResolveShellGroupOpenParams): boolean {
    if (containsActive) return true;
    return !anyGroupContainsActive && isFirstHeadedGroup;
}

/** Input for `placeProviderGroup`. */
export interface PlaceProviderGroupParams {
    /** Visible groups, already ordered. */
    readonly groups: readonly NavGroup[];
    /** The provider group, or `null` when the user owns no provider listing. */
    readonly providerGroup: NavGroup | null;
}

/**
 * Inserts the provider area right before Tourist so Tourist stays last
 * (order: Cuenta, Anfitrion, Comercio, Editorial, Proveedor, Turista).
 *
 * @param params - `{ groups, providerGroup }` (RO-RO).
 * @returns A new ordered array; the input is not mutated.
 */
export function placeProviderGroup({
    groups,
    providerGroup
}: PlaceProviderGroupParams): readonly NavGroup[] {
    if (!providerGroup) return groups;
    const touristIndex = groups.findIndex((group) => group.id === TOURIST_GROUP_ID);
    if (touristIndex === -1) return [...groups, providerGroup];
    return [...groups.slice(0, touristIndex), providerGroup, ...groups.slice(touristIndex)];
}

/**
 * Safely parses the persisted state. Anything malformed yields `{}` so the
 * server-rendered defaults stand.
 *
 * @param params - `{ raw }` the raw localStorage string (or `null`).
 * @returns Only the entries whose value is a boolean.
 */
export function parseStoredNavState({ raw }: { readonly raw: string | null }): StoredNavState {
    if (!raw) return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
        const result: Record<string, boolean> = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (typeof value === 'boolean') result[key] = value;
        }
        return result;
    } catch {
        return {};
    }
}

/**
 * Layers the remembered open/closed state onto the rendered `<details>` groups
 * and remembers every later toggle. The group holding the current page is
 * never closed by a remembered value. Every storage access is wrapped in
 * try/catch: when storage fails the server-rendered defaults stand.
 *
 * @param params - `{ root, storage }` (RO-RO). `storage` is a getter so a
 *   throwing `localStorage` accessor is caught here too.
 */
export function applyStoredNavState({
    root,
    storage
}: {
    readonly root: ParentNode;
    readonly storage: () => Pick<Storage, 'getItem' | 'setItem'>;
}): void {
    const groups = root.querySelectorAll<HTMLDetailsElement>(
        '[data-account-sidebar] details[data-nav-group]'
    );
    if (groups.length === 0) return;
    let raw: string | null = null;
    try {
        raw = storage().getItem(ACCOUNT_NAV_STORAGE_KEY);
    } catch {
        raw = null;
    }
    const stored = parseStoredNavState({ raw });
    for (const details of groups) {
        const id = details.dataset.navGroup;
        if (!id) continue;
        const remembered = stored[id];
        if (typeof remembered === 'boolean' && details.dataset.containsActive !== 'true') {
            details.open = remembered;
        }
        details.querySelector('summary')?.addEventListener('click', () => {
            const next = !details.open;
            try {
                const store = storage();
                const current = parseStoredNavState({
                    raw: store.getItem(ACCOUNT_NAV_STORAGE_KEY)
                });
                store.setItem(ACCOUNT_NAV_STORAGE_KEY, JSON.stringify({ ...current, [id]: next }));
            } catch {
                // Storage unavailable: the choice just won't be remembered.
            }
        });
    }
}
