/**
 * Navigation permission-visibility — single source of truth (SPEC-154).
 *
 * This module centralises the two pieces of permission logic that the
 * config-driven navigation components previously reimplemented in four
 * different places:
 *
 * 1. {@link isPermissionGateGranted} — the atomic "does the user pass this
 *    permission gate" check. It is the ONLY place in the navigation layer that
 *    calls {@link expandPermissions} for gating purposes. It implements the
 *    KEY→VALUE bridge:
 *      - IA config gates use PermissionExpression KEYS (e.g. `'ACCOMMODATION_VIEW_ALL'`).
 *      - `expandPermissions()` maps those keys to PermissionEnum VALUES (e.g. `'accommodation.viewAll'`).
 *      - `useUserPermissions()` returns VALUES.
 *      - Access = at least one expanded value is in the user's permissions.
 *
 * 2. {@link hasSidebarAccessibleItem} — walks a `SidebarItem[]` tree (recursing
 *    into groups) and returns whether the user has at least one accessible item,
 *    mirroring the `onMissing` semantics used by `MainMenu` and `BottomNav` for
 *    section visibility.
 *
 * Both functions are pure and free of React / framework dependencies, so they
 * can be unit-tested directly and reused from hooks and components alike.
 *
 * @module lib/nav/permission-visibility
 * @see apps/admin/src/config/ia/permission-bundles.ts — expandPermissions
 * @see apps/admin/src/hooks/use-visible-sidebar-items.ts — sidebar item annotation
 * @see SPEC-154
 */

import { expandPermissions } from '@/config/ia/permission-bundles';
import type { PermissionExpression, SidebarItem } from '@/config/ia/schema';
import type { PermissionEnum } from '@repo/schemas';

// ---------------------------------------------------------------------------
// isPermissionGateGranted
// ---------------------------------------------------------------------------

/**
 * Input for {@link isPermissionGateGranted}.
 */
export interface IsPermissionGateGrantedInput {
    /**
     * The raw permission gate from the IA config (PermissionExpression KEYS),
     * or `undefined` when the item has no gate.
     */
    readonly gate: readonly PermissionExpression[] | undefined;
    /** The current user's PermissionEnum VALUES. */
    readonly userPermissions: readonly PermissionEnum[];
}

/**
 * Checks whether the user passes the given permission gate.
 *
 * Resolution rules (single source of truth for nav gating):
 * - `undefined` / empty gate → `true` (no gate means accessible to anyone with
 *   basic panel access).
 * - Otherwise, the gate KEYS are expanded to PermissionEnum VALUES via
 *   {@link expandPermissions}; access is granted when the user holds at least
 *   one expanded value.
 * - If expansion throws (unknown permission key in config), access is denied
 *   (safe default), matching the prior behaviour of every call site.
 *
 * This is the ONLY function in the navigation layer that calls
 * {@link expandPermissions} for gating.
 *
 * @param input - {@link IsPermissionGateGrantedInput}.
 * @returns `true` if the user has access, `false` otherwise.
 *
 * @example
 * ```ts
 * isPermissionGateGranted({ gate: undefined, userPermissions: [] }); // → true
 * isPermissionGateGranted({
 *   gate: ['ACCOMMODATION_VIEW_ALL'],
 *   userPermissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
 * }); // → true
 * ```
 */
export function isPermissionGateGranted({
    gate,
    userPermissions
}: IsPermissionGateGrantedInput): boolean {
    if (!gate || gate.length === 0) {
        // No gate — accessible to anyone with basic panel access.
        return true;
    }
    try {
        const granted = expandPermissions({ expressions: gate });
        return granted.some((permission) => userPermissions.includes(permission));
    } catch {
        // Unknown permission key in config — treat as no access (safe default).
        return false;
    }
}

// ---------------------------------------------------------------------------
// hasSidebarAccessibleItem
// ---------------------------------------------------------------------------

/**
 * Input for {@link hasSidebarAccessibleItem}.
 */
export interface HasSidebarAccessibleItemInput {
    /** Raw sidebar items from the validated config. */
    readonly items: readonly SidebarItem[];
    /** The current user's PermissionEnum VALUES. */
    readonly userPermissions: readonly PermissionEnum[];
}

/**
 * Checks whether a sidebar item tree has at least one accessible item for the
 * user, recursing into groups.
 *
 * Accessibility rules (mirroring the prior `MainMenu`/`BottomNav` logic exactly):
 * - Separators never count as accessible items.
 * - A `link` with no gate is always accessible.
 * - A gated `link` counts as accessible when the user passes the gate, OR when
 *   it would render disabled (`onMissing !== 'hide'`) — a disabled item still
 *   occupies the sidebar. A gated `link` with `onMissing: 'hide'` that the user
 *   cannot access does not count.
 * - A `group` is recursed into. If the group's own gate denies access and its
 *   `onMissing` is `'hide'`, the group is skipped entirely; otherwise its
 *   children are still evaluated.
 *
 * @param input - {@link HasSidebarAccessibleItemInput}.
 * @returns `true` if at least one item is accessible to this user.
 */
export function hasSidebarAccessibleItem({
    items,
    userPermissions
}: HasSidebarAccessibleItemInput): boolean {
    for (const item of items) {
        if (item.type === 'separator') {
            // Separators do not count as accessible items.
            continue;
        }

        if (item.type === 'group') {
            // If the group's own gate denies access and it is set to hide,
            // skip the whole group (children are not evaluated).
            if (
                !isPermissionGateGranted({ gate: item.permissions, userPermissions }) &&
                item.onMissing === 'hide'
            ) {
                continue;
            }
            // Otherwise recurse into children.
            if (hasSidebarAccessibleItem({ items: item.items, userPermissions })) {
                return true;
            }
            continue;
        }

        // item.type === 'link'
        if (isPermissionGateGranted({ gate: item.permissions, userPermissions })) {
            // Either no gate or the user passes — accessible.
            return true;
        }
        // User lacks access: a disabled item still occupies the sidebar, a
        // hidden one does not.
        if (item.onMissing !== 'hide') {
            return true;
        }
    }
    return false;
}
