/**
 * @file account-nav-collapse.ts
 * @description Pure helpers behind the collapsible account navigation areas
 * (HOS-2124). The server renders each area as a native `<details>` whose `open`
 * attribute comes from `resolveGroupDefaultOpen`; a small client script then
 * applies the browser-remembered state (`parseStoredNavState`) on top, never
 * closing the area that contains the current page.
 */

import type { NavGroup } from '@/config/navigation';

/** Id of the Tourist area, the only one that can start collapsed. */
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
 * Decides whether an area renders open on the server (no JS, no stored state).
 *
 * - The area holding the current page is always open.
 * - Every area is open by default, except Tourist, which starts collapsed
 *   unless the user has no other area besides Cuenta (then collapsing it would
 *   hide the only thing they can do).
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
