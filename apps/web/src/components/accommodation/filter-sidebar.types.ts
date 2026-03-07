/**
 * @file filter-sidebar.types.ts
 * @description Shared types and constants for the FilterSidebar component family.
 * These types are used across FilterSidebar and its sub-components.
 */

import { DESTINATION_NAMES } from '../../data/destinations';

/**
 * Accommodation filter configuration representing the current filter state.
 */
export interface AccommodationFilters {
    /** Selected accommodation type identifiers */
    readonly types: readonly string[];
    /** Minimum price bound (null means no lower bound) */
    readonly priceMin: number | null;
    /** Maximum price bound (null means no upper bound) */
    readonly priceMax: number | null;
    /** Selected destination slug or empty string for all destinations */
    readonly destination: string;
    /** Selected amenity identifiers */
    readonly amenities: readonly string[];
    /** Minimum star rating (null means no rating filter) */
    readonly minRating: number | null;
}

/**
 * Destination option for use in filter select dropdowns.
 */
export interface Destination {
    /** URL-friendly slug value (e.g. "concepcion-del-uruguay") */
    readonly value: string;
    /** Human-readable display label (e.g. "Concepción del Uruguay") */
    readonly label: string;
}

/**
 * Keys identifying collapsible filter section panels.
 */
export type SectionKey = 'type' | 'price' | 'destination' | 'amenities' | 'rating';

/**
 * Expanded/collapsed state for each collapsible filter section.
 */
export interface SectionState {
    readonly type: boolean;
    readonly price: boolean;
    readonly destination: boolean;
    readonly amenities: boolean;
    readonly rating: boolean;
}

/**
 * Available accommodation type filter values.
 */
export const ACCOMMODATION_TYPES = [
    'hotel',
    'cabin',
    'apartment',
    'rural',
    'hostel',
    'boutique'
] as const;

/**
 * Available amenity filter values.
 */
export const AMENITIES = [
    'wifi',
    'pool',
    'parking',
    'breakfast',
    'airConditioning',
    'gym',
    'restaurant',
    'petFriendly'
] as const;

/**
 * Converts a destination display name into a URL-friendly slug value.
 * Lowercases, removes accented characters, and replaces spaces with hyphens.
 *
 * @param name - Human-readable destination name (e.g. "Concepcion del Uruguay")
 * @returns URL slug (e.g. "concepcion-del-uruguay")
 */
function toSlug(name: string): string {
    return (
        name
            .toLowerCase()
            .normalize('NFD')
            // biome-ignore lint/suspicious/noMisleadingCharacterClass: Standard Unicode diacritics removal pattern after NFD normalization
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '-')
    );
}

/**
 * Available destination filter options, derived from the canonical
 * DESTINATION_NAMES list in `src/data/destinations.ts`.
 * Contains all 9 destinations in the Litoral region.
 */
export const DESTINATIONS: readonly Destination[] = DESTINATION_NAMES.map(
    (name): Destination => ({
        value: toSlug(name),
        label: name
    })
);
