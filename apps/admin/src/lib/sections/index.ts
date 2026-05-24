/**
 * Surviving exports from the OLD section-based navigation system.
 *
 * After SPEC-154 T-029 surgical deletion, only the types consumed by
 * out-of-scope components remain here:
 *
 * - `TabConfig`, `PageTabsConfig`   — PageTabs.tsx (L3 migration out of scope)
 * - `SidebarContextState`, `SidebarConfig` — sidebar-context.tsx
 *
 * All other OLD exports (createSection, filterByPermissions, isGroupActive,
 * getHeaderNavItems, useCurrentSidebarConfig, useCurrentSectionId,
 * getSectionForPath, initializeSections, SidebarItem, SidebarItemType, etc.)
 * have been deleted.
 *
 * DO NOT import from this barrel for NEW code — use the IA config system
 * at `@/config/ia/` and the new hooks at `@/hooks/use-current-section`,
 * `@/hooks/use-current-sidebar`, `@/hooks/use-visible-sidebar-items`, etc.
 */

export type {
    PageTabsConfig,
    SidebarConfig,
    SidebarContextState,
    TabConfig
} from './types';
