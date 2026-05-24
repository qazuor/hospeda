/**
 * Surviving types from the OLD section-based navigation system.
 *
 * Only the types still consumed by OUT-OF-SCOPE components are kept here
 * (SPEC-154 T-029 surgical deletion). The rest of the OLD system has been
 * deleted.
 *
 * CONSUMERS:
 * - `TabConfig`, `PageTabsConfig`  — apps/admin/src/components/layout/PageTabs.tsx
 * - `SidebarContextState`, `SidebarConfig` — apps/admin/src/contexts/sidebar-context.tsx
 *
 * DO NOT add new types here. New navigation types live in
 * `apps/admin/src/config/ia/schema.ts`.
 */

import type { ReactNode } from 'react';

// ============================================================================
// PageTabs types (consumed by PageTabs.tsx — L3 migration is out of scope)
// ============================================================================

/**
 * Tab configuration for entity detail pages (Level 3 navigation).
 * Used by `PageTabs.tsx` and its exported `*Tabs` constants.
 */
export interface TabConfig {
    /** Unique tab identifier */
    id: string;
    /** Display label */
    label: string;
    /** i18n key for the label */
    labelKey?: string;
    /** Route path (relative to the entity base path) */
    href: string;
    /** Optional icon */
    icon?: ReactNode;
    /** Required permissions */
    permissions?: string[];
}

/**
 * Page tabs configuration.
 * Used by legacy entities that pass tabs via PageTabs.tsx.
 */
export interface PageTabsConfig {
    /** Base path for the entity (e.g., /accommodations/$id) */
    basePath: string;
    /** List of tabs */
    tabs: TabConfig[];
}

// ============================================================================
// SidebarContext types (consumed by sidebar-context.tsx)
// ============================================================================

/**
 * Minimal sidebar configuration used by the SidebarContext to track
 * open/close state. The IA config is the actual source of truth for
 * sidebar content; this is retained only for the context's state shape.
 */
export interface SidebarConfig {
    /** Title displayed at the top of the sidebar */
    title: string;
    /** i18n key for the title (optional) */
    titleKey?: string;
    /** List of sidebar items (opaque in this context) */
    items: unknown[];
}

/**
 * Sidebar context state shape.
 * Consumed by `SidebarProvider` / `useSidebarContext` in sidebar-context.tsx.
 */
export interface SidebarContextState {
    /** Current sidebar configuration */
    config: SidebarConfig | null;
    /** Whether the sidebar is showing contextual content */
    isContextual: boolean;
    /** Whether the sidebar is collapsed (desktop) */
    isCollapsed: boolean;
    /** Whether the mobile drawer is open */
    isMobileOpen: boolean;
}
