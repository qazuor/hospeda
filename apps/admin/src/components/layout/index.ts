/**
 * Layout Components
 *
 * Main layout components for the admin application.
 * Includes 3-level navigation system:
 * - Level 1: Header (horizontal section navigation)
 * - Level 2: Sidebar (contextual navigation)
 * - Level 3: PageTabs (entity detail tabs)
 */

export type { AppLayoutProps } from './AppLayout';
// Main layouts
export { AppLayout } from './AppLayout';
export type { BasePageLayoutProps, EntityBreadcrumbContext } from './BasePageLayout';
export { BasePageLayout } from './BasePageLayout';
// Navigation components
export { Breadcrumbs } from './Breadcrumbs';
// Re-export header components
export * from './header';
export type { MainPageLayoutProps } from './MainPageLayout';
export { MainPageLayout } from './MainPageLayout';
export type { PageTabsProps } from './PageTabs';
// Level 3: Page Tabs
// Pre-defined tab configurations
export {
    accommodationTabs,
    destinationTabs,
    eventTabs,
    PageTabs,
    postTabs,
    userTabs
} from './PageTabs';
export type { SidebarPageLayoutProps } from './SidebarPageLayout';
export { SidebarPageLayout } from './SidebarPageLayout';

// Re-export sidebar components
export * from './sidebar';
