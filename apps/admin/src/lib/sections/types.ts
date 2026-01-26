/**
 * Types for the 3-level navigation system
 *
 * Level 1: Header sections (Dashboard, Content, Administration, Analytics)
 * Level 2: Sidebar items (contextual based on active section)
 * Level 3: Page tabs (for entity detail pages)
 */

import type { ReactNode } from 'react';

/**
 * Type of sidebar item
 * - link: Navigates to a route
 * - action: Executes a callback function
 * - separator: Visual divider
 * - group: Collapsible group with child items
 */
export type SidebarItemType = 'link' | 'action' | 'separator' | 'group';

/**
 * Single sidebar item configuration
 */
export interface SidebarItem {
    /** Type of the sidebar item */
    type: SidebarItemType;
    /** Unique identifier for the item */
    id: string;
    /** Display label (i18n key or plain text) */
    label?: string;
    /** Icon component to display */
    icon?: ReactNode;
    /** Route path for link items */
    href?: string;
    /** Callback for action items */
    onClick?: () => void;
    /** Child items for group type */
    items?: SidebarItem[];
    /** Required permissions to display this item */
    permissions?: string[];
    /** Whether the group is expanded by default */
    defaultExpanded?: boolean;
}

/**
 * Sidebar configuration for a section
 */
export interface SidebarConfig {
    /** Title displayed at the top of the sidebar */
    title: string;
    /** i18n key for the title (optional) */
    titleKey?: string;
    /** List of sidebar items */
    items: SidebarItem[];
}

/**
 * Function that generates dynamic sidebar config based on route params
 */
export type DynamicSidebarConfig = (params: Record<string, string>) => SidebarConfig;

/**
 * Section configuration
 * Represents a top-level navigation section (Level 1)
 */
export interface SectionConfig {
    /** Unique section identifier */
    id: string;
    /** Display label for the header nav */
    label: string;
    /** i18n key for the label */
    labelKey?: string;
    /** Icon for the header nav */
    icon?: ReactNode;
    /** Route patterns that belong to this section */
    routes: string[];
    /** Default route when section is clicked */
    defaultRoute: string;
    /** Sidebar configuration (static or dynamic) */
    sidebar: SidebarConfig | DynamicSidebarConfig;
    /** Required permissions to access this section */
    permissions?: string[];
}

/**
 * Tab configuration for entity detail pages (Level 3)
 */
export interface TabConfig {
    /** Unique tab identifier */
    id: string;
    /** Display label */
    label: string;
    /** i18n key for the label */
    labelKey?: string;
    /** Route path */
    href: string;
    /** Optional icon */
    icon?: ReactNode;
    /** Required permissions */
    permissions?: string[];
}

/**
 * Page tabs configuration
 */
export interface PageTabsConfig {
    /** Base path for the entity (e.g., /accommodations/$id) */
    basePath: string;
    /** List of tabs */
    tabs: TabConfig[];
}

/**
 * Sidebar context state
 */
export interface SidebarContextState {
    /** Current sidebar configuration */
    config: SidebarConfig | null;
    /** Whether the sidebar is showing contextual content */
    isContextual: boolean;
    /** Whether the sidebar is collapsed (mobile) */
    isCollapsed: boolean;
    /** Whether the mobile drawer is open */
    isMobileOpen: boolean;
}

/**
 * Header navigation item (Level 1)
 */
export interface HeaderNavItem {
    /** Section ID */
    id: string;
    /** Display label */
    label: string;
    /** i18n key for label */
    labelKey?: string;
    /** Route to navigate to */
    href: string;
    /** Icon component */
    icon?: ReactNode;
    /** Whether this section is currently active */
    isActive?: boolean;
}
