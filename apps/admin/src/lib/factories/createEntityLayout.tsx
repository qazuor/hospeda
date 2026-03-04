/**
 * @file Entity Layout Factory
 *
 * Factory function for creating entity-level layouts with optional tab navigation.
 * Used to provide consistent layout patterns across different entity management sections.
 *
 * @example
 * ```tsx
 * // In routes/_authed/accommodations.tsx
 * import { createEntityLayout } from '@/lib/factories';
 *
 * const { Layout, tabs } = createEntityLayout({
 *     entityName: 'accommodations',
 *     basePath: '/accommodations',
 *     tabs: [
 *         { id: 'list', label: 'List', path: '' },
 *         { id: 'analytics', label: 'Analytics', path: '/analytics' },
 *     ]
 * });
 *
 * export const Route = createFileRoute('/_authed/accommodations')({
 *     component: Layout
 * });
 * ```
 */

import { Link, Outlet, useLocation } from '@tanstack/react-router';
import type { ReactNode } from 'react';

/**
 * Tab configuration for entity layout
 */
export type EntityTabConfig = {
    /** Unique identifier for the tab */
    readonly id: string;
    /** Display label for the tab */
    readonly label: string;
    /** Path relative to entity basePath (empty string for index) */
    readonly path: string;
    /** Icon name (optional) */
    readonly icon?: string;
    /** Whether tab requires specific permission */
    readonly permission?: string;
    /** Badge count or indicator */
    readonly badge?: number | string;
};

/**
 * Entity layout configuration
 */
export type EntityLayoutConfig = {
    /** Entity name (used for breadcrumbs and accessibility) */
    readonly entityName: string;
    /** Display name for the entity (singular) */
    readonly displayName: string;
    /** Base path for the entity routes */
    readonly basePath: string;
    /** Optional tab configuration */
    readonly tabs?: readonly EntityTabConfig[];
    /** Whether to show breadcrumbs */
    readonly showBreadcrumbs?: boolean;
    /** Custom header component */
    readonly headerComponent?: () => ReactNode;
    /** Custom wrapper class name */
    readonly className?: string;
};

/**
 * Entity layout result
 */
export type EntityLayoutResult = {
    /** Layout component to use in route definition */
    readonly Layout: () => ReactNode;
    /** Tab configurations (for reference) */
    readonly tabs: readonly EntityTabConfig[];
    /** Helper to check if a path is active */
    readonly isTabActive: (tabPath: string, currentPath: string) => boolean;
};

/**
 * Default tab styles using Tailwind
 */
const TAB_STYLES = {
    container: 'border-b border-border mb-6',
    tabList: 'flex -mb-px space-x-8',
    tab: {
        base: 'whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors',
        active: 'border-primary text-primary',
        inactive:
            'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
    },
    badge: 'ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground'
} as const;

/**
 * Check if a tab path is active based on current location
 */
const isTabActive = (tabPath: string, currentPath: string, basePath: string): boolean => {
    const fullTabPath = tabPath === '' ? basePath : `${basePath}${tabPath}`;

    // Exact match for index tab
    if (tabPath === '') {
        return currentPath === basePath || currentPath === `${basePath}/`;
    }

    // Starts with for other tabs
    return currentPath.startsWith(fullTabPath);
};

/**
 * Tab navigation component
 */
function EntityTabs({
    tabs,
    basePath,
    entityName
}: {
    tabs: readonly EntityTabConfig[];
    basePath: string;
    entityName: string;
}) {
    const location = useLocation();
    const currentPath = location.pathname;

    if (tabs.length === 0) {
        return null;
    }

    return (
        <div className={TAB_STYLES.container}>
            <nav
                className={TAB_STYLES.tabList}
                aria-label={`${entityName} navigation`}
            >
                {tabs.map((tab) => {
                    const active = isTabActive(tab.path, currentPath, basePath);
                    const tabPath = tab.path === '' ? basePath : `${basePath}${tab.path}`;

                    return (
                        <Link
                            key={tab.id}
                            to={tabPath}
                            className={`${TAB_STYLES.tab.base} ${active ? TAB_STYLES.tab.active : TAB_STYLES.tab.inactive}`}
                            aria-current={active ? 'page' : undefined}
                        >
                            {tab.label}
                            {tab.badge !== undefined && (
                                <span className={TAB_STYLES.badge}>{tab.badge}</span>
                            )}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}

/**
 * Creates an entity layout with optional tab navigation
 *
 * @param config - Entity layout configuration
 * @returns Object containing Layout component and utilities
 *
 * @example
 * ```tsx
 * // Simple layout without tabs
 * const { Layout } = createEntityLayout({
 *     entityName: 'users',
 *     displayName: 'User',
 *     basePath: '/users'
 * });
 *
 * // Layout with tabs
 * const { Layout } = createEntityLayout({
 *     entityName: 'accommodations',
 *     displayName: 'Accommodation',
 *     basePath: '/accommodations',
 *     tabs: [
 *         { id: 'list', label: 'All', path: '' },
 *         { id: 'pending', label: 'Pending Review', path: '/pending' },
 *         { id: 'archived', label: 'Archived', path: '/archived' },
 *     ]
 * });
 * ```
 */
export function createEntityLayout(config: EntityLayoutConfig): EntityLayoutResult {
    const {
        entityName,
        basePath,
        tabs = [],
        // showBreadcrumbs - reserved for future breadcrumb implementation
        headerComponent: HeaderComponent,
        className = ''
    } = config;

    /**
     * Entity layout component
     */
    function EntityLayout(): ReactNode {
        return (
            <div className={`entity-layout entity-layout--${entityName} ${className}`.trim()}>
                {/* Optional custom header */}
                {HeaderComponent && <HeaderComponent />}

                {/* Tab navigation */}
                {tabs.length > 0 && (
                    <EntityTabs
                        tabs={tabs}
                        basePath={basePath}
                        entityName={entityName}
                    />
                )}

                {/* Child routes */}
                <Outlet />
            </div>
        );
    }

    return {
        Layout: EntityLayout,
        tabs,
        isTabActive: (tabPath: string, currentPath: string) =>
            isTabActive(tabPath, currentPath, basePath)
    };
}

/**
 * Pre-configured tab sets for common patterns
 */
export const COMMON_TAB_PRESETS = {
    /** Lifecycle-based tabs */
    lifecycle: [
        { id: 'all', label: 'All', path: '' },
        { id: 'active', label: 'Active', path: '/active' },
        { id: 'draft', label: 'Drafts', path: '/drafts' },
        { id: 'archived', label: 'Archived', path: '/archived' }
    ] as const,

    /** Moderation-based tabs */
    moderation: [
        { id: 'all', label: 'All', path: '' },
        { id: 'pending', label: 'Pending Review', path: '/pending' },
        { id: 'approved', label: 'Approved', path: '/approved' },
        { id: 'rejected', label: 'Rejected', path: '/rejected' }
    ] as const,

    /** Content management tabs */
    content: [
        { id: 'published', label: 'Published', path: '' },
        { id: 'drafts', label: 'Drafts', path: '/drafts' },
        { id: 'scheduled', label: 'Scheduled', path: '/scheduled' }
    ] as const,

    /** User management tabs */
    users: [
        { id: 'all', label: 'All Users', path: '' },
        { id: 'admins', label: 'Admins', path: '/admins' },
        { id: 'moderators', label: 'Moderators', path: '/moderators' },
        { id: 'banned', label: 'Banned', path: '/banned' }
    ] as const
} as const;

/**
 * Type helper for tab preset keys
 */
export type TabPresetKey = keyof typeof COMMON_TAB_PRESETS;

/**
 * Creates entity layout with a preset tab configuration
 */
export function createEntityLayoutWithPreset(
    config: Omit<EntityLayoutConfig, 'tabs'> & { tabPreset: TabPresetKey }
): EntityLayoutResult {
    const { tabPreset, ...restConfig } = config;
    return createEntityLayout({
        ...restConfig,
        tabs: COMMON_TAB_PRESETS[tabPreset]
    });
}
