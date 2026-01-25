/**
 * Sidebar component
 *
 * Main navigation sidebar for the admin dashboard.
 * On desktop it is a static column. On mobile it slides in as a drawer.
 *
 * Composed of sub-components:
 * - SidebarHeader: Mobile header with close button
 * - SidebarNav: Primary icon rail navigation
 * - SidebarItem: Individual navigation items
 * - SidebarGroup: Secondary panel with child links
 * - SidebarFooter: Optional footer section
 */

import { useTranslations } from '@/hooks/use-translations';
import { useSidebarPersistence } from '@/hooks/useSidebarPersistence';
import type { PermissionValue } from '@/lib/menu';
import { filterMenuByPermissions, menuTree } from '@/lib/menu';
import { cn } from '@/lib/utils';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

import {
    SidebarGroup,
    SidebarHeader,
    type SidebarMenuItem,
    SidebarNav,
    getChildMenuIcon,
    getMenuIcon
} from './sidebar';

export type SidebarProps = {
    /**
     * Whether the sidebar drawer is visible on small screens.
     */
    readonly open: boolean;
    /**
     * Called to close the sidebar (used by overlay and close button).
     */
    readonly onClose: () => void;
};

/**
 * Header routes that should not show sidebar selection
 * Defined outside component to avoid recreating on each render
 */
const HEADER_ROUTES = ['/me/profile', '/me/settings', '/notifications'] as const;

/**
 * Sidebar renders the primary navigation. On desktop it is a static column.
 * On mobile it slides in as a drawer.
 */
export const Sidebar = ({ open, onClose }: SidebarProps) => {
    const { location } = useRouterState();
    const router = useRouter();
    const { t } = useTranslations();

    // TODO: Replace with real user permissions from Clerk session/ctx
    const userPermissions: PermissionValue[] | undefined = undefined;
    const items = filterMenuByPermissions(menuTree, userPermissions) as SidebarMenuItem[];

    const isHeaderRoute = useMemo(
        () => HEADER_ROUTES.some((r) => location.pathname.startsWith(r)),
        [location.pathname]
    );

    // Determine selected item from current location
    const selectedTopFromLocation = useMemo(() => {
        if (isHeaderRoute) return undefined;
        const path = location.pathname;

        // Check for direct match
        const direct = items.find((it) => it.to && it.to === path);
        if (direct) return direct.titleKey;

        // Check children for match
        for (const it of items) {
            if (it.children) {
                const child = it.children.find((c) => c.to === path);
                if (child) return it.titleKey;
            }
        }

        return items[0]?.titleKey;
    }, [items, location.pathname, isHeaderRoute]);

    // Persistent sidebar state
    const {
        selectedTitleKey: persistedTitleKey,
        setSelectedTitleKey: setPersistedTitleKey,
        isCollapsed: isSubPanelCollapsed,
        toggleCollapsed: toggleSubPanelCollapsed
    } = useSidebarPersistence({
        defaultTitleKey: selectedTopFromLocation
    });

    // State management for selection and hover
    const [selectedTitleKey, setSelectedTitleKey] = useState<string | undefined>(
        persistedTitleKey ?? selectedTopFromLocation
    );
    const [hoveredTitleKey, setHoveredTitleKey] = useState<string | undefined>(undefined);

    // Sync selected state with location (but prefer persisted if on same parent route)
    useEffect(() => {
        // Always sync with URL for correct highlighting
        setSelectedTitleKey(selectedTopFromLocation);
    }, [selectedTopFromLocation]);

    // Persist selection when manually changed
    const handleSelectTitleKey = (key: string | undefined) => {
        setSelectedTitleKey(key);
        setPersistedTitleKey(key);
    };

    // Computed values for display
    const selectedItem = useMemo(() => {
        if (!selectedTitleKey) return undefined;
        return items.find((i) => i.titleKey === selectedTitleKey);
    }, [items, selectedTitleKey]);

    const viewedItem = useMemo(() => {
        const effectiveKey = hoveredTitleKey ?? selectedTitleKey;
        if (!effectiveKey) return undefined;
        return items.find((i) => i.titleKey === effectiveKey);
    }, [items, hoveredTitleKey, selectedTitleKey]);

    const showSubPanel = Boolean(
        viewedItem?.children &&
            viewedItem.children.length > 0 &&
            (hoveredTitleKey || !isHeaderRoute) &&
            !isSubPanelCollapsed
    );

    // Event handlers
    const handleItemClick = (item: SidebarMenuItem) => {
        const hasChildren = Boolean(item.children && item.children.length > 0);
        if (hasChildren) {
            handleSelectTitleKey(item.titleKey);
        } else if (item.to) {
            router.navigate({ to: item.to });
            onClose();
        }
    };

    // Keyboard navigation handler
    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === '[' && event.ctrlKey) {
            // Ctrl+[ to toggle collapsed state
            event.preventDefault();
            toggleSubPanelCollapsed();
        }
    };

    const handleMouseLeave = () => {
        setHoveredTitleKey(undefined);
    };

    return (
        <aside
            className={cn(
                '-translate-x-full fixed top-14 right-auto bottom-0 left-0 z-40 w-64 border-r bg-sidebar text-sidebar-foreground transition-transform md:sticky md:top-14 md:min-h-[calc(100vh-3.5rem)] md:translate-x-0',
                !showSubPanel && 'md:w-14',
                isHeaderRoute && 'md:absolute',
                open && 'translate-x-0'
            )}
            aria-label="Primary"
            onKeyDown={handleKeyDown}
        >
            {/* Mobile Header */}
            <SidebarHeader
                t={t}
                onClose={onClose}
            />

            {/* Navigation Container */}
            <div
                className="flex h-full"
                onMouseLeave={handleMouseLeave}
            >
                {/* Primary Icon Rail */}
                <SidebarNav
                    items={items}
                    selectedTitleKey={selectedItem?.titleKey}
                    getIcon={getMenuIcon}
                    t={t}
                    onItemClick={handleItemClick}
                    onItemMouseEnter={setHoveredTitleKey}
                    onItemFocus={setHoveredTitleKey}
                />

                {/* Secondary Panel */}
                {showSubPanel && viewedItem && (
                    <SidebarGroup
                        item={viewedItem}
                        currentPath={location.pathname}
                        onClose={onClose}
                        getChildIcon={getChildMenuIcon}
                        t={t}
                    />
                )}
            </div>
        </aside>
    );
};
