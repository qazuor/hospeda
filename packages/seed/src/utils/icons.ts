/**
 * Centralized icon definitions for the seed package.
 * All icons used throughout the seed process should be defined here.
 */

/**
 * Entity icons for different types of data entities
 */
export const ENTITY_ICONS = {
    Users: '👨‍💻‍',
    Destinations: '🌍',
    Amenities: '✨',
    Features: '💎',
    Accommodations: '🏠',
    Tags: '🏷️',
    Posts: '📝',
    Events: '🎉',
    Attractions: '🎯',
    Reviews: '⭐',
    Bookmarks: '🔖',
    Sponsors: '💼',
    Organizers: '👨‍💼',
    Locations: '📍',
    Default: '📦'
} as const;

/**
 * Status icons for different states and outcomes
 */
export const STATUS_ICONS = {
    Success: '✅',
    Error: '❌',
    Warning: '⚠️',
    Info: '📊',
    Process: '🔄',
    Complete: '🎉',
    Highlight: '⭐',
    Debug: '🔍',
    Reset: '🧹',
    Skip: '↪️',
    Crown: '👑',
    Seed: '🌱',
    Tool: '🔧',
    User: '👤'
} as const;

/**
 * Gets the appropriate icon for an entity name
 * @param entityName - The name of the entity
 * @returns The icon for the entity or the default icon if not found
 */
export function getEntityIcon(entityName: string): string {
    return ENTITY_ICONS[entityName as keyof typeof ENTITY_ICONS] || ENTITY_ICONS.Default;
}

/**
 * Gets the appropriate status icon based on status type
 * @param status - The status type
 * @returns The corresponding status icon
 */
export function getStatusIcon(status: 'success' | 'error' | 'warning'): string {
    switch (status) {
        case 'success':
            return STATUS_ICONS.Success;
        case 'error':
            return STATUS_ICONS.Error;
        case 'warning':
            return STATUS_ICONS.Warning;
        default:
            return STATUS_ICONS.Info;
    }
}
