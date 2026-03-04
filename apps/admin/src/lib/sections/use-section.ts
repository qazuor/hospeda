/**
 * Section Hooks
 *
 * React hooks for working with the section-based navigation system.
 */

import { useSidebarContext } from '@/contexts/sidebar-context';
import { useLocation, useParams } from '@tanstack/react-router';
import { useEffect, useMemo } from 'react';
import { getSectionForPath, getSidebarConfigForPath } from './section-registry';
import type { SectionConfig } from './types';

/**
 * Get the current section based on the current route
 *
 * @returns The current section configuration or undefined
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const section = useCurrentSection();
 *   return <div>Current section: {section?.id ?? 'none'}</div>;
 * }
 * ```
 */
export function useCurrentSection(): SectionConfig | undefined {
    const location = useLocation();

    return useMemo(() => {
        return getSectionForPath(location.pathname);
    }, [location.pathname]);
}

/**
 * Sync the sidebar configuration with the current route
 *
 * @deprecated Use `useCurrentSidebarConfig()` instead. Sidebar now reads config
 * synchronously via useMemo, eliminating the flash caused by async useEffect.
 *
 * @example
 * ```tsx
 * function AccommodationsPage() {
 *   useSectionSidebarSync();
 *
 *   return (
 *     <div>
 *       <h1>Accommodations</h1>
 *       <AccommodationsList />
 *     </div>
 *   );
 * }
 * ```
 */
export function useSectionSidebarSync(): void {
    const location = useLocation();
    const params = useParams({ strict: false });
    const { setConfig } = useSidebarContext();

    useEffect(() => {
        const sidebarConfig = getSidebarConfigForPath(
            location.pathname,
            params as Record<string, string>
        );

        if (sidebarConfig) {
            setConfig(sidebarConfig);
        }
    }, [location.pathname, params, setConfig]);
}

/**
 * Check if the current route is in a specific section
 *
 * @param sectionId - The section ID to check
 * @returns Whether the current route is in the specified section
 *
 * @example
 * ```tsx
 * function Navigation() {
 *   const isInContent = useIsInSection('content');
 *   return (
 *     <nav>
 *       <Link className={isInContent ? 'active' : ''}>Content</Link>
 *     </nav>
 *   );
 * }
 * ```
 */
export function useIsInSection(sectionId: string): boolean {
    const section = useCurrentSection();
    return section?.id === sectionId;
}

/**
 * Get the current section ID
 *
 * @returns The current section ID or undefined
 */
export function useCurrentSectionId(): string | undefined {
    const section = useCurrentSection();
    return section?.id;
}

/**
 * Get sidebar configuration for the current route
 *
 * @returns The sidebar configuration or undefined
 */
export function useCurrentSidebarConfig() {
    const location = useLocation();
    const params = useParams({ strict: false });

    return useMemo(() => {
        return getSidebarConfigForPath(location.pathname, params as Record<string, string>);
    }, [location.pathname, params]);
}
