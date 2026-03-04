/**
 * Section-based navigation system
 *
 * This module provides the infrastructure for the 3-level navigation:
 * - Level 1: Header sections
 * - Level 2: Contextual sidebar
 * - Level 3: Page tabs
 *
 * @example
 * ```tsx
 * import { sidebar, createSection, useCurrentSection } from '@/lib/sections';
 *
 * // Create a section
 * const dashboardSection = createSection({
 *   id: 'dashboard',
 *   label: 'Dashboard',
 *   routes: ['/dashboard', '/dashboard/*'],
 *   defaultRoute: '/dashboard',
 *   sidebar: {
 *     title: 'Dashboard',
 *     items: [
 *       sidebar.link('overview', 'Overview', '/dashboard'),
 *     ]
 *   }
 * });
 *
 * // Use in component
 * function MyPage() {
 *   const section = useCurrentSection();
 *   return <div>Current section: {section?.id}</div>;
 * }
 * ```
 */

// Types
export type {
    DynamicSidebarConfig,
    HeaderNavItem,
    PageTabsConfig,
    SectionConfig,
    SidebarConfig,
    SidebarContextState,
    SidebarItem,
    SidebarItemType,
    TabConfig
} from './types';

// Sidebar helpers
export {
    filterByPermissions,
    filterSectionsByPermissions,
    findActiveItem,
    getAllHrefs,
    isGroupActive,
    sidebar
} from './sidebar-helpers';

// Section registry
export {
    clearSections,
    createSection,
    getAllSections,
    getSection,
    getSectionForPath,
    getSidebarConfigForPath,
    isPathInSection,
    registerSection,
    registerSections
} from './section-registry';

// Section hooks
export {
    useCurrentSection,
    useCurrentSectionId,
    useCurrentSidebarConfig,
    useIsInSection,
    useSectionSidebarSync
} from './use-section';
