/**
 * Section Configuration Index
 *
 * Registers all navigation sections with the section registry.
 * This file should be imported early in the application bootstrap.
 */

import { type SectionConfig, filterSectionsByPermissions, registerSections } from '@/lib/sections';
import type { HeaderNavItem } from '@/lib/sections';
import { administrationSection } from './administration.section';
import { analyticsSection } from './analytics.section';
import { billingSection } from './billing.section';
import { contentSection } from './content.section';
import { dashboardSection } from './dashboard.section';

/**
 * All application sections
 */
export const sections: SectionConfig[] = [
    dashboardSection,
    contentSection,
    billingSection,
    administrationSection,
    analyticsSection
];

/**
 * Initialize sections
 * Call this function at application startup to register all sections
 */
export function initializeSections(): void {
    registerSections(sections);
}

/**
 * Static header navigation items (all sections, no permission filtering).
 * Prefer `getHeaderNavItems()` for permission-aware rendering.
 */
export const headerNavItems = sections.map((section) => ({
    id: section.id,
    label: section.label,
    labelKey: section.labelKey,
    href: section.defaultRoute,
    icon: section.icon
}));

/**
 * Get header navigation items filtered by user permissions.
 * Sections with empty permissions are always visible.
 * For sections with permissions, the user needs at least one (OR logic).
 */
export function getHeaderNavItems({
    userPermissions
}: {
    readonly userPermissions: string[] | undefined;
}): HeaderNavItem[] {
    const filtered = filterSectionsByPermissions({ sectionConfigs: sections, userPermissions });
    return filtered.map((section) => ({
        id: section.id,
        label: section.label,
        labelKey: section.labelKey,
        href: section.defaultRoute,
        icon: section.icon
    }));
}

// Re-export individual sections for direct access
export { administrationSection } from './administration.section';
export { analyticsSection } from './analytics.section';
export { billingSection } from './billing.section';
export { contentSection } from './content.section';
export { dashboardSection } from './dashboard.section';
