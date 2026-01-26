/**
 * Section Registry
 *
 * Central registry for all navigation sections.
 * Maps URL patterns to section configurations.
 */

import type { DynamicSidebarConfig, SectionConfig, SidebarConfig } from './types';

/**
 * Pattern matcher for glob-like patterns
 * Supports * (any segment) and ** (any path)
 */
function matchPattern(pattern: string, path: string): boolean {
    // Normalize paths
    const normalizedPattern = pattern.replace(/\/$/, '');
    const normalizedPath = path.replace(/\/$/, '');

    // Handle exact match
    if (normalizedPattern === normalizedPath) {
        return true;
    }

    // Convert glob pattern to regex
    const regexPattern = normalizedPattern
        // Escape special regex characters except * and **
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        // Replace ** with a placeholder
        .replace(/\*\*/g, '<<<DOUBLE_STAR>>>')
        // Replace * with single segment match
        .replace(/\*/g, '[^/]+')
        // Replace ** placeholder with any path match
        .replace(/<<<DOUBLE_STAR>>>/g, '.*');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(normalizedPath);
}

/**
 * Registry storage
 */
const sections: Map<string, SectionConfig> = new Map();

/**
 * Register a section
 */
export function registerSection(section: SectionConfig): void {
    if (sections.has(section.id)) {
        console.warn(`Section "${section.id}" is already registered. Overwriting.`);
    }
    sections.set(section.id, section);
}

/**
 * Get a section by ID
 */
export function getSection(id: string): SectionConfig | undefined {
    return sections.get(id);
}

/**
 * Get section that matches a path
 */
export function getSectionForPath(path: string): SectionConfig | undefined {
    for (const section of sections.values()) {
        for (const pattern of section.routes) {
            if (matchPattern(pattern, path)) {
                return section;
            }
        }
    }
    return undefined;
}

/**
 * Get all registered sections
 */
export function getAllSections(): SectionConfig[] {
    return Array.from(sections.values());
}

/**
 * Clear all sections (useful for testing)
 */
export function clearSections(): void {
    sections.clear();
}

/**
 * Check if a path belongs to a section
 */
export function isPathInSection(path: string, sectionId: string): boolean {
    const section = sections.get(sectionId);
    if (!section) {
        return false;
    }

    return section.routes.some((pattern) => matchPattern(pattern, path));
}

/**
 * Get sidebar config for a path
 * Handles both static and dynamic sidebar configurations
 */
export function getSidebarConfigForPath(
    path: string,
    params: Record<string, string> = {}
): SidebarConfig | undefined {
    const section = getSectionForPath(path);

    if (!section) {
        return undefined;
    }

    if (typeof section.sidebar === 'function') {
        return (section.sidebar as DynamicSidebarConfig)(params);
    }

    return section.sidebar as SidebarConfig;
}

/**
 * Create a section configuration
 * Factory function for type-safe section creation
 */
export function createSection(config: SectionConfig): SectionConfig {
    return config;
}

/**
 * Register multiple sections at once
 */
export function registerSections(sectionList: SectionConfig[]): void {
    for (const section of sectionList) {
        registerSection(section);
    }
}
