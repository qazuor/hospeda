/**
 * useVisibleSidebarItems — filters and annotates sidebar items by the
 * current user's permissions (SPEC-154 §8 cherry-pick rule).
 *
 * Each item is either:
 * - Omitted entirely (`onMissing: 'hide'` + no access).
 * - Kept with `disabled: true` (`onMissing: 'disable'` + no access).
 * - Kept with `disabled: false` (access granted, or no gate).
 *
 * Groups are recursed: a group is omitted if ALL its visible children are
 * hidden. If some children are disabled, the group is kept (with those
 * children disabled). Separators are always kept.
 *
 * Permission check uses the KEY→VALUE bridge, centralised in
 * {@link isPermissionGateGranted}:
 *   - IA config `item.permissions` = PermissionExpression KEYS (e.g. 'ACCOMMODATION_VIEW_ALL').
 *   - `expandPermissions()` maps those keys to PermissionEnum VALUES (e.g. 'accommodation.viewAll').
 *   - `useUserPermissions()` returns VALUES.
 *   - Access = at least one expanded value is in the user's permissions array.
 *
 * @module use-visible-sidebar-items
 * @see apps/admin/src/lib/nav/permission-visibility.ts — isPermissionGateGranted
 * @see apps/admin/src/hooks/use-user-permissions.ts   — useUserPermissions
 * @see SPEC-154 T-022
 */

import type { GroupItem, LinkItem, SeparatorItem, SidebarItem } from '@/config/ia/schema';
import { isPermissionGateGranted } from '@/lib/nav/permission-visibility';
import type { PermissionEnum } from '@repo/schemas';
import { useMemo } from 'react';
import { useUserPermissions } from './use-user-permissions';

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/**
 * A sidebar link item annotated with a computed `disabled` flag.
 */
export interface VisibleLinkItem extends LinkItem {
    /** Whether the item is rendered greyed-out (no access, onMissing: 'disable'). */
    readonly disabled: boolean;
}

/**
 * A sidebar separator item — always kept, `disabled` is always false.
 */
export interface VisibleSeparatorItem extends SeparatorItem {
    readonly disabled: false;
}

/**
 * A sidebar group item annotated with `disabled` and recursed `items`.
 */
export interface VisibleGroupItem extends Omit<GroupItem, 'items'> {
    /** Whether the group itself is rendered greyed-out. */
    readonly disabled: boolean;
    /** Filtered + annotated children. */
    readonly items: ReadonlyArray<VisibleLinkItem | VisibleSeparatorItem>;
}

/**
 * Union of all visible sidebar item types (items that survived the filter pass).
 */
export type VisibleSidebarItem = VisibleLinkItem | VisibleGroupItem | VisibleSeparatorItem;

// ---------------------------------------------------------------------------
// Hook input
// ---------------------------------------------------------------------------

/**
 * Input for {@link useVisibleSidebarItems}.
 */
export interface UseVisibleSidebarItemsInput {
    /** The raw sidebar items from the validated config. */
    readonly items: readonly SidebarItem[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Annotates a link item with the `disabled` flag.
 *
 * @param item - The raw LinkItem from the config.
 * @param userPermissions - The current user's PermissionEnum values.
 * @returns The annotated {@link VisibleLinkItem}, or `null` if the item should be hidden.
 */
function processLinkItem(
    item: LinkItem,
    userPermissions: readonly PermissionEnum[]
): VisibleLinkItem | null {
    if (isPermissionGateGranted({ gate: item.permissions, userPermissions })) {
        // No gate or access granted — visible, never disabled.
        return { ...item, disabled: false };
    }
    if (item.onMissing === 'hide') {
        return null;
    }
    // onMissing === 'disable' (the Zod default)
    return { ...item, disabled: true };
}

/**
 * Processes a group item by recursing into its children.
 *
 * A group is omitted (`null`) when ALL its children end up hidden.
 * The group's OWN permission gate is checked first — if the group itself
 * is gated and the user has no access, hide/disable rules apply to the group
 * as a whole (children are not evaluated).
 *
 * @param item - The raw GroupItem from the config.
 * @param userPermissions - The current user's PermissionEnum values.
 * @returns The annotated {@link VisibleGroupItem}, or `null` if the group should be hidden.
 */
function processGroupItem(
    item: GroupItem,
    userPermissions: readonly PermissionEnum[]
): VisibleGroupItem | null {
    // Check the group's own permission gate first.
    if (!isPermissionGateGranted({ gate: item.permissions, userPermissions })) {
        if (item.onMissing === 'hide') return null;
        // Disabled group — still recurse children but mark group disabled.
        const visibleChildren = processGroupChildren(item.items, userPermissions);
        if (visibleChildren.length === 0) return null;
        return { ...item, disabled: true, items: visibleChildren };
    }

    // Group passes its own gate (or has no gate) — recurse children.
    const visibleChildren = processGroupChildren(item.items, userPermissions);
    if (visibleChildren.length === 0) {
        // All children were hidden — omit the group entirely.
        return null;
    }
    return { ...item, disabled: false, items: visibleChildren };
}

/**
 * Processes the children of a group item (links and separators only —
 * groups cannot be nested per schema constraint).
 *
 * @param items - The group's children (GroupChildItem[]).
 * @param userPermissions - The current user's PermissionEnum values.
 * @returns Filtered + annotated children.
 */
function processGroupChildren(
    items: GroupItem['items'],
    userPermissions: readonly PermissionEnum[]
): ReadonlyArray<VisibleLinkItem | VisibleSeparatorItem> {
    const result: Array<VisibleLinkItem | VisibleSeparatorItem> = [];
    for (const child of items) {
        if (child.type === 'separator') {
            result.push({ ...child, disabled: false as const });
        } else {
            // child.type === 'link'
            const processed = processLinkItem(child, userPermissions);
            if (processed !== null) {
                result.push(processed);
            }
        }
    }
    return result;
}

// ---------------------------------------------------------------------------
// Exported hook
// ---------------------------------------------------------------------------

/**
 * Filters and annotates a sidebar's items according to the current user's
 * permissions (SPEC-154 §8 cherry-pick rule).
 *
 * @param input - {@link UseVisibleSidebarItemsInput} containing the raw items.
 * @returns Array of {@link VisibleSidebarItem} — items that should be rendered.
 *
 * @example
 * ```ts
 * const sidebar = useCurrentSidebar();
 * const visibleItems = useVisibleSidebarItems({ items: sidebar?.items ?? [] });
 * // Render visibleItems — disabled items get greyed-out tooltip treatment.
 * ```
 */
export function useVisibleSidebarItems({
    items
}: UseVisibleSidebarItemsInput): readonly VisibleSidebarItem[] {
    const userPermissions = useUserPermissions();

    return useMemo(() => {
        const result: VisibleSidebarItem[] = [];

        for (const item of items) {
            if (item.type === 'separator') {
                result.push({ ...item, disabled: false as const });
            } else if (item.type === 'group') {
                const processed = processGroupItem(item, userPermissions);
                if (processed !== null) {
                    result.push(processed);
                }
            } else {
                // item.type === 'link'
                const processed = processLinkItem(item, userPermissions);
                if (processed !== null) {
                    result.push(processed);
                }
            }
        }

        return result;
    }, [items, userPermissions]);
}
