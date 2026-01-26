/**
 * Section Configuration Index
 *
 * Registers all navigation sections with the section registry.
 * This file should be imported early in the application bootstrap.
 */

import { type SectionConfig, registerSections } from '@/lib/sections';
import { administrationSection } from './administration.section';
import { analyticsSection } from './analytics.section';
import { contentSection } from './content.section';
import { dashboardSection } from './dashboard.section';

/**
 * All application sections
 */
export const sections: SectionConfig[] = [
    dashboardSection,
    contentSection,
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
 * Header navigation items
 * Used by the Header component to render the main navigation
 */
export const headerNavItems = sections.map((section) => ({
    id: section.id,
    label: section.label,
    labelKey: section.labelKey,
    href: section.defaultRoute,
    icon: section.icon
}));

// Re-export individual sections for direct access
export { administrationSection } from './administration.section';
export { analyticsSection } from './analytics.section';
export { contentSection } from './content.section';
export { dashboardSection } from './dashboard.section';
