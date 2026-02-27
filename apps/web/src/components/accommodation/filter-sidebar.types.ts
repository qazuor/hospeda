/**
 * Shared types for the FilterSidebar component family.
 * These types are used across FilterSidebar and its sub-components.
 */

/**
 * Accommodation filter configuration
 */
export interface AccommodationFilters {
    readonly types: string[];
    readonly priceMin: number | null;
    readonly priceMax: number | null;
    readonly destination: string;
    readonly amenities: string[];
    readonly minRating: number | null;
}

/**
 * Destination option
 */
export interface Destination {
    readonly value: string;
    readonly label: string;
}

/**
 * Collapsible section state keys
 */
export type SectionKey = 'type' | 'price' | 'destination' | 'amenities' | 'rating';

/**
 * Collapsible section state
 */
export interface SectionState {
    readonly type: boolean;
    readonly price: boolean;
    readonly destination: boolean;
    readonly amenities: boolean;
    readonly rating: boolean;
}

/**
 * Available accommodation types
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
 * Available amenities
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
 * Available destinations (mock data)
 */
export const DESTINATIONS: Destination[] = [
    { value: 'concepcion-del-uruguay', label: 'Concepción del Uruguay' },
    { value: 'colon', label: 'Colón' },
    { value: 'gualeguaychu', label: 'Gualeguaychú' },
    { value: 'parana', label: 'Paraná' },
    { value: 'federacion', label: 'Federación' }
];
