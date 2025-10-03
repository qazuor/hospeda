/**
 * HTTP-specific schema utilities for handling query string coercion
 * Provides consistent patterns for converting HTTP query params to typed objects
 */
import { z } from 'zod';

/**
 * HTTP-compatible pagination schema with automatic coercion
 * Converts string query parameters to numbers with validation
 */
export const HttpPaginationSchema = z.object({
    page: z.coerce
        .number()
        .int()
        .positive()
        .default(1)
        .describe('Page number for pagination (1-based)'),
    pageSize: z.coerce
        .number()
        .int()
        .positive()
        .max(100)
        .default(20)
        .describe('Number of items per page (max 100)')
});

export type HttpPagination = z.infer<typeof HttpPaginationSchema>;

/**
 * HTTP-compatible sorting schema
 * Handles string-based sort parameters from query strings
 */
export const HttpSortingSchema = z.object({
    sortBy: z.string().optional().describe('Field name to sort by'),
    sortOrder: z
        .enum(['asc', 'desc'])
        .default('asc')
        .optional()
        .describe('Sort direction (ascending or descending)')
});

export type HttpSorting = z.infer<typeof HttpSortingSchema>;

/**
 * Base HTTP search schema with query string coercion
 * Foundation for all HTTP search endpoints
 */
export const BaseHttpSearchSchema = z.object({
    ...HttpPaginationSchema.shape,
    ...HttpSortingSchema.shape,
    q: z.string().optional().describe('General search query string')
});

export type BaseHttpSearch = z.infer<typeof BaseHttpSearchSchema>;

/**
 * Utility for creating boolean query parameters
 * Converts 'true'/'false' strings to boolean values
 */
export const createBooleanQueryParam = (description: string) =>
    z
        .enum(['true', 'false'])
        .transform((v) => v === 'true')
        .optional()
        .describe(description);

/**
 * Utility for creating date query parameters
 * Converts ISO datetime strings to Date objects
 */
export const createDateQueryParam = (description: string) =>
    z
        .string()
        .datetime({ message: 'zodError.common.date.invalidFormat' })
        .transform((v) => new Date(v))
        .optional()
        .describe(description);

/**
 * Utility for creating array query parameters
 * Converts comma-separated strings to arrays
 */
export const createArrayQueryParam = (description: string) =>
    z
        .string()
        .transform((v) =>
            v
                ? v
                      .split(',')
                      .map((s) => s.trim())
                      .filter((s) => s.length > 0)
                : undefined
        )
        .optional()
        .describe(description);

/**
 * Utility for creating number query parameters with coercion
 * Converts string numbers to actual numbers with validation
 */
export const createNumberQueryParam = (description: string, min?: number, max?: number) => {
    let schema = z.coerce.number();

    if (min !== undefined) {
        schema = schema.min(min);
    }

    if (max !== undefined) {
        schema = schema.max(max);
    }

    return schema.optional().describe(description);
};

/**
 * Common HTTP query field factories to eliminate boilerplate
 * These cover the most common patterns found across entities
 */
export const HttpQueryFields = {
    // Boolean fields (most common)
    isFeatured: () => z.coerce.boolean().optional().describe('Filter by featured status'),
    isActive: () => z.coerce.boolean().optional().describe('Filter by active status'),
    isEmailVerified: () =>
        z.coerce.boolean().optional().describe('Filter by email verification status'),
    isPublished: () => z.coerce.boolean().optional().describe('Filter by published status'),
    isVerified: () => z.coerce.boolean().optional().describe('Filter by verified status'),
    isAvailable: () => z.coerce.boolean().optional().describe('Filter by availability status'),
    isFree: () => z.coerce.boolean().optional().describe('Filter by free/paid status'),
    isVirtual: () => z.coerce.boolean().optional().describe('Filter by virtual/physical status'),
    isPremium: () => z.coerce.boolean().optional().describe('Filter by premium/standard status'),
    isPublic: () => z.coerce.boolean().optional().describe('Filter by public/private status'),
    isBuiltin: () => z.coerce.boolean().optional().describe('Filter by builtin/custom status'),
    hasIcon: () => z.coerce.boolean().optional().describe('Filter by presence of icon'),
    hasDescription: () =>
        z.coerce.boolean().optional().describe('Filter by presence of description'),
    hasMedia: () => z.coerce.boolean().optional().describe('Filter by presence of media'),
    hasExcerpt: () => z.coerce.boolean().optional().describe('Filter by presence of excerpt'),
    hasLocation: () => z.coerce.boolean().optional().describe('Filter by presence of location'),
    hasClimateInfo: () =>
        z.coerce.boolean().optional().describe('Filter by presence of climate information'),
    hasCoordinates: () =>
        z.coerce.boolean().optional().describe('Filter by presence of coordinates'),
    isPopular: () => z.coerce.boolean().optional().describe('Filter by popular tags'),
    isUnused: () => z.coerce.boolean().optional().describe('Filter by unused status'),
    searchInDescription: () =>
        z.coerce.boolean().default(true).optional().describe('Include description in search'),
    fuzzySearch: () => z.coerce.boolean().default(true).optional().describe('Enable fuzzy search'),
    groupByCategory: () =>
        z.coerce.boolean().default(false).optional().describe('Group results by category'),
    popularityThreshold: () =>
        z.coerce.number().int().min(1).optional().describe('Popularity threshold filter'),
    hasImages: () => z.coerce.boolean().optional().describe('Filter by presence of images'),

    // Date fields (very common)
    createdAfter: () => z.coerce.date().optional().describe('Filter items created after this date'),
    createdBefore: () =>
        z.coerce.date().optional().describe('Filter items created before this date'),
    publishedAfter: () =>
        z.coerce.date().optional().describe('Filter items published after this date'),
    publishedBefore: () =>
        z.coerce.date().optional().describe('Filter items published before this date'),
    lastLoginAfter: () =>
        z.coerce.date().optional().describe('Filter users who logged in after this date'),
    lastLoginBefore: () =>
        z.coerce.date().optional().describe('Filter users who logged in before this date'),
    checkIn: () => z.coerce.date().optional().describe('Check-in date filter'),
    checkOut: () => z.coerce.date().optional().describe('Check-out date filter'),
    startDateAfter: () =>
        z.coerce.date().optional().describe('Filter events starting after this date'),
    startDateBefore: () =>
        z.coerce.date().optional().describe('Filter events starting before this date'),
    endDateAfter: () => z.coerce.date().optional().describe('Filter events ending after this date'),
    endDateBefore: () =>
        z.coerce.date().optional().describe('Filter events ending before this date'),

    // Price fields (common in commerce entities)
    minPrice: () => z.coerce.number().min(0).optional().describe('Minimum price filter'),
    maxPrice: () => z.coerce.number().min(0).optional().describe('Maximum price filter'),
    price: () => z.coerce.number().min(0).optional().describe('Exact price filter'),

    // Rating fields (common for reviews and ratings)

    // Rating fields (common in review systems)
    minRating: () => z.coerce.number().min(0).max(5).optional().describe('Minimum rating filter'),
    maxRating: () => z.coerce.number().min(0).max(5).optional().describe('Maximum rating filter'),

    // Capacity fields (accommodations, venues)
    minGuests: () => z.coerce.number().int().min(1).optional().describe('Minimum guest capacity'),
    maxGuests: () => z.coerce.number().int().min(1).optional().describe('Maximum guest capacity'),
    minCapacity: () =>
        z.coerce.number().int().min(1).optional().describe('Minimum capacity filter'),
    maxCapacity: () =>
        z.coerce.number().int().min(1).optional().describe('Maximum capacity filter'),
    capacity: () => z.coerce.number().int().min(1).optional().describe('Exact capacity filter'),
    hasTickets: () => z.coerce.boolean().optional().describe('Filter by ticket availability'),
    allowsRegistration: () =>
        z.coerce.boolean().optional().describe('Filter by registration availability'),
    minDuration: () =>
        z.coerce.number().int().min(1).optional().describe('Minimum duration filter (minutes)'),
    maxDuration: () =>
        z.coerce.number().int().min(1).optional().describe('Maximum duration filter (minutes)'),

    // User-specific fields
    minBedrooms: () => z.coerce.number().int().min(0).optional().describe('Minimum bedroom count'),
    maxBedrooms: () => z.coerce.number().int().min(0).optional().describe('Maximum bedroom count'),
    minBathrooms: () =>
        z.coerce.number().int().min(0).optional().describe('Minimum bathroom count'),
    maxBathrooms: () =>
        z.coerce.number().int().min(0).optional().describe('Maximum bathroom count'),

    // Usage/count fields (common in analytics)
    minUsageCount: () =>
        z.coerce.number().int().min(0).optional().describe('Minimum usage count filter'),
    maxUsageCount: () =>
        z.coerce.number().int().min(0).optional().describe('Maximum usage count filter'),
    minViews: () => z.coerce.number().int().min(0).optional().describe('Minimum view count filter'),
    maxViews: () => z.coerce.number().int().min(0).optional().describe('Maximum view count filter'),
    minLikes: () => z.coerce.number().int().min(0).optional().describe('Minimum like count filter'),
    maxLikes: () => z.coerce.number().int().min(0).optional().describe('Maximum like count filter'),
    minComments: () =>
        z.coerce.number().int().min(0).optional().describe('Minimum comment count filter'),
    maxComments: () =>
        z.coerce.number().int().min(0).optional().describe('Maximum comment count filter'),
    minFollowers: () =>
        z.coerce.number().int().min(0).optional().describe('Minimum follower count filter'),
    maxFollowers: () =>
        z.coerce.number().int().min(0).optional().describe('Maximum follower count filter'),
    minEventsCount: () =>
        z.coerce.number().int().min(0).optional().describe('Minimum events count filter'),
    minAccommodations: () =>
        z.coerce.number().int().min(0).optional().describe('Minimum accommodation count filter'),
    maxAccommodations: () =>
        z.coerce.number().int().min(0).optional().describe('Maximum accommodation count filter'),
    minAttractions: () =>
        z.coerce.number().int().min(0).optional().describe('Minimum attraction count filter'),
    maxAttractions: () =>
        z.coerce.number().int().min(0).optional().describe('Maximum attraction count filter'),
    minVisitorsPerYear: () =>
        z.coerce.number().int().min(0).optional().describe('Minimum visitors per year filter'),
    maxVisitorsPerYear: () =>
        z.coerce.number().int().min(0).optional().describe('Maximum visitors per year filter'),
    minAge: () =>
        z.coerce.number().int().min(13).max(120).optional().describe('Minimum age filter'),
    maxAge: () =>
        z.coerce.number().int().min(13).max(120).optional().describe('Maximum age filter'),
    hasActiveSubscription: () =>
        z.coerce.boolean().optional().describe('Filter by active subscription status'),
    hasAccommodations: () =>
        z.coerce.boolean().optional().describe('Filter by accommodation ownership'),
    isOpen: () => z.coerce.boolean().optional().describe('Filter by open/closed status'),
    acceptsReservations: () =>
        z.coerce.boolean().optional().describe('Filter by reservation acceptance'),

    // Payment-specific fields
    minAmount: () => z.coerce.number().min(0).optional().describe('Minimum amount filter'),
    maxAmount: () => z.coerce.number().min(0).optional().describe('Maximum amount filter'),
    amount: () => z.coerce.number().min(0).optional().describe('Exact amount filter'),
    processedAfter: () =>
        z.coerce.date().optional().describe('Filter payments processed after date'),
    processedBefore: () =>
        z.coerce.date().optional().describe('Filter payments processed before date'),

    // Geolocation fields (common in location-based entities)
    latitude: () => z.coerce.number().min(-90).max(90).optional().describe('Latitude coordinate'),
    longitude: () =>
        z.coerce.number().min(-180).max(180).optional().describe('Longitude coordinate'),
    radius: () => z.coerce.number().positive().optional().describe('Search radius in kilometers')
};
