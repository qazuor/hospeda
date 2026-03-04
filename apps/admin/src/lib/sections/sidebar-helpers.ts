/**
 * Helper functions for creating sidebar items
 *
 * Usage:
 * import { sidebar } from '@/lib/sections';
 *
 * const items = [
 *   sidebar.link('home', 'Home', '/dashboard', <HomeIcon />),
 *   sidebar.separator(),
 *   sidebar.group('settings', 'Settings', [
 *     sidebar.link('profile', 'Profile', '/settings/profile'),
 *     sidebar.link('security', 'Security', '/settings/security'),
 *   ]),
 * ];
 */

import type { ReactNode } from 'react';
import type { SectionConfig, SidebarConfig, SidebarItem } from './types';

/**
 * Create a link sidebar item
 */
function link(
    id: string,
    label: string,
    href: string,
    icon?: ReactNode,
    permissions?: string[]
): SidebarItem {
    return {
        type: 'link',
        id,
        label,
        href,
        icon,
        permissions
    };
}

/**
 * Create a separator sidebar item
 */
function separator(): SidebarItem {
    return {
        type: 'separator',
        id: `sep-${crypto.randomUUID()}`
    };
}

/**
 * Create a group sidebar item with children
 */
function group(
    id: string,
    label: string,
    items: SidebarItem[],
    icon?: ReactNode,
    defaultExpanded = false
): SidebarItem {
    return {
        type: 'group',
        id,
        label,
        items,
        icon,
        defaultExpanded
    };
}

/**
 * Create an action sidebar item (executes callback)
 */
function action(
    id: string,
    label: string,
    onClick: () => void,
    icon?: ReactNode,
    permissions?: string[]
): SidebarItem {
    return {
        type: 'action',
        id,
        label,
        onClick,
        icon,
        permissions
    };
}

/**
 * Create a sidebar configuration
 */
function config(title: string, items: SidebarItem[], titleKey?: string): SidebarConfig {
    return {
        title,
        titleKey,
        items
    };
}

/**
 * Sidebar helper namespace
 * Provides fluent API for creating sidebar configurations
 */
export const sidebar = {
    link,
    separator,
    group,
    action,
    config
} as const;

/**
 * Filter section configs by user permissions.
 * A section is visible if it has no permissions defined (empty array)
 * or the user has at least one of the listed permissions (OR logic).
 */
export function filterSectionsByPermissions({
    sectionConfigs,
    userPermissions
}: {
    readonly sectionConfigs: readonly SectionConfig[];
    readonly userPermissions: string[] | undefined;
}): SectionConfig[] {
    if (!userPermissions) return [...sectionConfigs];

    return sectionConfigs.filter((section) => {
        if (!section.permissions || section.permissions.length === 0) return true;
        return section.permissions.some((p) => userPermissions.includes(p));
    });
}

/**
 * Filter sidebar items by user permissions
 */
export function filterByPermissions(
    items: SidebarItem[],
    userPermissions: string[] | undefined
): SidebarItem[] {
    // If no permissions defined, show all items (development mode)
    if (!userPermissions) {
        return items;
    }

    return items.reduce<SidebarItem[]>((acc, item) => {
        // Check if item requires permissions
        if (item.permissions && item.permissions.length > 0) {
            const hasPermission = item.permissions.some((p) => userPermissions.includes(p));
            if (!hasPermission) {
                return acc;
            }
        }

        // For groups, filter children recursively
        if (item.type === 'group' && item.items) {
            const filteredChildren = filterByPermissions(item.items, userPermissions);
            if (filteredChildren.length > 0) {
                acc.push({
                    ...item,
                    items: filteredChildren
                });
            }
        } else {
            acc.push(item);
        }

        return acc;
    }, []);
}

/**
 * Find the active item in a sidebar configuration based on current path
 */
export function findActiveItem(items: SidebarItem[], currentPath: string): SidebarItem | null {
    for (const item of items) {
        if (item.type === 'link' && item.href === currentPath) {
            return item;
        }

        if (item.type === 'group' && item.items) {
            const found = findActiveItem(item.items, currentPath);
            if (found) {
                return found;
            }
        }
    }

    return null;
}

/**
 * Check if any item in a group is active (for auto-expanding groups)
 */
export function isGroupActive(group: SidebarItem, currentPath: string): boolean {
    if (group.type !== 'group' || !group.items) {
        return false;
    }

    return group.items.some((item) => {
        if (item.type === 'link') {
            // Check exact match or if current path starts with item href
            return (
                item.href === currentPath ||
                (item.href && currentPath.startsWith(item.href) && item.href !== '/')
            );
        }
        if (item.type === 'group') {
            return isGroupActive(item, currentPath);
        }
        return false;
    });
}

/**
 * Get all link hrefs from sidebar items (for route matching)
 */
export function getAllHrefs(items: SidebarItem[]): string[] {
    const hrefs: string[] = [];

    for (const item of items) {
        if (item.type === 'link' && item.href) {
            hrefs.push(item.href);
        }

        if (item.type === 'group' && item.items) {
            hrefs.push(...getAllHrefs(item.items));
        }
    }

    return hrefs;
}
