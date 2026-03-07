/**
 * @file category-colors.ts
 * @description Maps event categories to Tailwind CSS color classes for badge rendering.
 * Supports both Spanish legacy category names (from seed data) and English API values.
 */

/**
 * Union type of known event category values.
 * Includes Spanish legacy names (Cultura, Deporte, etc.) from seed data
 * and English API names (cultural, sports, etc.) from the events endpoint.
 * Falls back to `string` for forward compatibility with new categories.
 */
export type EventCategory =
    | 'Cultura'
    | 'Deporte'
    | 'Gastronomia'
    | 'Bienestar'
    | 'cultural'
    | 'sports'
    | 'gastronomy'
    | 'wellness'
    | string;

/**
 * Returns Tailwind background and text color classes for an event category badge.
 * Maps both Spanish legacy and English API category names to consistent colors.
 *
 * @param cat - Event category string (case-sensitive)
 * @returns Tailwind CSS classes string for bg and text color
 *
 * @example
 * ```ts
 * categoryBg('cultural')    // "bg-accent text-accent-foreground"
 * categoryBg('Gastronomia') // "bg-hospeda-forest text-card"
 * ```
 */
export function categoryBg(cat: EventCategory): string {
    switch (cat) {
        case 'cultural':
        case 'Cultura':
            return 'bg-accent text-accent-foreground';
        case 'sports':
        case 'Deporte':
            return 'bg-primary text-primary-foreground';
        case 'gastronomy':
        case 'Gastronomia':
            return 'bg-hospeda-forest text-card';
        case 'wellness':
        case 'Bienestar':
            return 'bg-hospeda-river text-card';
        default:
            return 'bg-accent text-accent-foreground';
    }
}
