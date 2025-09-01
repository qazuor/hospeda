/**
 * TanStack Query keys for accommodation-related queries
 *
 * This file defines all query keys used for accommodation data fetching,
 * following TanStack Query best practices for key organization and caching.
 *
 * Key Structure:
 * - accommodations: Base key for all accommodation queries
 * - accommodations.list(): List queries with optional filters
 * - accommodations.detail(): Individual accommodation queries
 * - accommodations.section(): Section-specific queries for performance
 */

/**
 * Base accommodation query keys factory
 */
export const accommodationQueryKeys = {
    /**
     * Base key for all accommodation queries
     */
    all: ['accommodations'] as const,

    /**
     * List queries - for accommodation listings with filters
     */
    lists: () => [...accommodationQueryKeys.all, 'list'] as const,
    list: (filters?: AccommodationListFilters) =>
        [...accommodationQueryKeys.lists(), filters] as const,

    /**
     * Detail queries - for individual accommodations
     */
    details: () => [...accommodationQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...accommodationQueryKeys.details(), id] as const,

    /**
     * Section queries - for loading specific sections of an accommodation
     * Useful for performance optimization and lazy loading
     */
    sections: (id: string) => [...accommodationQueryKeys.detail(id), 'sections'] as const,
    section: (id: string, sectionId: string) =>
        [...accommodationQueryKeys.sections(id), sectionId] as const,

    /**
     * Search queries - for accommodation search functionality
     */
    searches: () => [...accommodationQueryKeys.all, 'search'] as const,
    search: (query: string, filters?: AccommodationSearchFilters) =>
        [...accommodationQueryKeys.searches(), query, filters] as const,

    /**
     * Validation queries - for async field validation
     */
    validations: () => [...accommodationQueryKeys.all, 'validation'] as const,
    uniqueCheck: (field: string, value: string, excludeId?: string) =>
        [...accommodationQueryKeys.validations(), 'unique', field, value, excludeId] as const,
    existsCheck: (entityType: string, id: string) =>
        [...accommodationQueryKeys.validations(), 'exists', entityType, id] as const,

    /**
     * Related data queries - for accommodation relationships
     */
    relations: (id: string) => [...accommodationQueryKeys.detail(id), 'relations'] as const,
    destination: (id: string) => [...accommodationQueryKeys.relations(id), 'destination'] as const,
    owner: (id: string) => [...accommodationQueryKeys.relations(id), 'owner'] as const,
    reviews: (id: string, filters?: ReviewFilters) =>
        [...accommodationQueryKeys.relations(id), 'reviews', filters] as const,

    /**
     * Statistics queries - for accommodation metrics
     */
    stats: () => [...accommodationQueryKeys.all, 'stats'] as const,
    overallStats: () => [...accommodationQueryKeys.stats(), 'overall'] as const,
    userStats: (userId: string) => [...accommodationQueryKeys.stats(), 'user', userId] as const,
    destinationStats: (destinationId: string) =>
        [...accommodationQueryKeys.stats(), 'destination', destinationId] as const,

    /**
     * Export queries - for data export functionality
     */
    exports: () => [...accommodationQueryKeys.all, 'export'] as const,
    exportData: (format: 'csv' | 'xlsx' | 'json', filters?: AccommodationListFilters) =>
        [...accommodationQueryKeys.exports(), format, filters] as const
} as const;

/**
 * Type definitions for query filters and parameters
 */

/**
 * Filters for accommodation list queries
 */
export interface AccommodationListFilters {
    /** Filter by accommodation type */
    type?: string[];
    /** Filter by destination */
    destinationId?: string[];
    /** Filter by owner */
    ownerId?: string[];
    /** Filter by lifecycle status */
    lifecycleState?: string[];
    /** Filter by moderation status */
    moderationState?: string[];
    /** Filter by visibility */
    visibility?: string[];
    /** Filter by featured status */
    featured?: boolean;
    /** Filter by date range */
    createdAt?: {
        from?: Date;
        to?: Date;
    };
    /** Filter by rating range */
    averageRating?: {
        min?: number;
        max?: number;
    };
    /** Pagination */
    page?: number;
    limit?: number;
    /** Sorting */
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

/**
 * Filters for accommodation search queries
 */
export interface AccommodationSearchFilters {
    /** Search in specific fields */
    fields?: ('name' | 'description' | 'shortDescription')[];
    /** Filter by type during search */
    type?: string[];
    /** Filter by destination during search */
    destinationId?: string[];
    /** Include inactive accommodations */
    includeInactive?: boolean;
    /** Limit search results */
    limit?: number;
}

/**
 * Filters for review queries
 */
export interface ReviewFilters {
    /** Filter by rating */
    rating?: number[];
    /** Filter by verification status */
    isVerified?: boolean;
    /** Date range */
    createdAt?: {
        from?: Date;
        to?: Date;
    };
    /** Pagination */
    page?: number;
    limit?: number;
}

/**
 * Utility functions for working with query keys
 */

/**
 * Invalidate all accommodation queries
 */
export const invalidateAllAccommodations = () => accommodationQueryKeys.all;

/**
 * Invalidate accommodation lists
 */
export const invalidateAccommodationLists = () => accommodationQueryKeys.lists();

/**
 * Invalidate specific accommodation detail
 */
export const invalidateAccommodationDetail = (id: string) => accommodationQueryKeys.detail(id);

/**
 * Invalidate accommodation section
 */
export const invalidateAccommodationSection = (id: string, sectionId: string) =>
    accommodationQueryKeys.section(id, sectionId);

/**
 * Get query key for accommodation form data
 * Useful for form state synchronization
 */
export const getAccommodationFormKey = (id: string, mode: 'view' | 'edit') =>
    [...accommodationQueryKeys.detail(id), 'form', mode] as const;

/**
 * Get query key for accommodation permissions
 * Useful for permission-based UI updates
 */
export const getAccommodationPermissionsKey = (id: string, userId: string) =>
    [...accommodationQueryKeys.detail(id), 'permissions', userId] as const;
