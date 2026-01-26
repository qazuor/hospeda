/**
 * Layout Components
 *
 * Main layout components for the admin application.
 * Includes 3-level navigation system:
 * - Level 1: Header (horizontal section navigation)
 * - Level 2: Sidebar (contextual navigation)
 * - Level 3: PageTabs (entity detail tabs)
 */

// Main layouts
export { AppLayout } from './AppLayout';
export type { AppLayoutProps } from './AppLayout';

export { BasePageLayout } from './BasePageLayout';
export type { BasePageLayoutProps, EntityBreadcrumbContext } from './BasePageLayout';

export { MainPageLayout } from './MainPageLayout';
export type { MainPageLayoutProps } from './MainPageLayout';

export { SidebarPageLayout } from './SidebarPageLayout';
export type { SidebarPageLayoutProps } from './SidebarPageLayout';

// Navigation components
export { Breadcrumbs } from './Breadcrumbs';

export { Topbar } from './Topbar';
export type { TopbarProps } from './Topbar';

// Level 3: Page Tabs
export { PageTabs } from './PageTabs';
export type { PageTabsProps } from './PageTabs';

// Pre-defined tab configurations
export {
    accommodationTabs,
    destinationTabs,
    eventTabs,
    postTabs,
    userTabs
} from './PageTabs';

// Re-export header components
export * from './header';

// Re-export sidebar components
export * from './sidebar';
