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

import {
    createBooleanQueryParam,
    createBooleanQueryParamWithDefault
} from '../../common/boolean-params.js';

export { createBooleanQueryParam, createBooleanQueryParamWithDefault };

/**
 * Duck-typed OpenAPI example attacher.
 *
 * `@repo/schemas` imports from plain `zod`, which does not statically expose
 * `.openapi()`. The method IS available at runtime on every Zod schema whenever
 * `@hono/zod-openapi` has been imported anywhere in the process (it extends the
 * Zod prototype globally on import). In the API app it is always loaded, so the
 * metadata is picked up by the OpenAPI generator. In isolated schema tests the
 * method is absent and the call is a no-op.
 *
 * Falling back to `.describe()` would already surface the example in the
 * Swagger description, but this helper lets us attach a proper `example` field
 * on the OpenAPI schema for tools that consume it programmatically.
 */
const attachOpenApiExample = <T>(schema: T, example: unknown): T => {
    const candidate = schema as T & { openapi?: (meta: Record<string, unknown>) => T };
    if (typeof candidate.openapi === 'function') {
        return candidate.openapi({ example });
    }
    return schema;
};

/**
 * HTTP-compatible sorting schema
 * Handles string-based sort parameters from query strings.
 *
 * Precedence (enforced by the model layer): when both `sorts` and
 * `sortBy`/`sortOrder` are present, `sorts` wins. When `sorts` is absent or
 * empty after whitelist filtering, the model falls back to the legacy
 * `sortBy`/`sortOrder` pair.
 *
 * `featuredFirst` is an independent flag. When `true`, the model prepends
 * `featuredByEntitlement DESC` to the ORDER BY clause. Public routes may force this to
 * `true` server-side, ignoring the client value.
 */
export const HttpSortingSchema = z.object({
    sortBy: z.string().optional().describe('Field name to sort by (legacy single-sort)'),
    sortOrder: z
        .enum(['asc', 'desc'])
        .default('asc')
        .optional()
        .describe('Sort direction (ascending or descending)'),
    sorts: attachOpenApiExample(
        z
            .string()
            .transform((val) =>
                val
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((s) => {
                        const [field, order] = s.split(':');
                        return {
                            field: (field ?? '').trim(),
                            order: order === 'desc' ? ('desc' as const) : ('asc' as const)
                        };
                    })
                    .filter((sf) => sf.field.length > 0)
                    .slice(0, 5)
            )
            .optional()
            .describe(
                'Comma-separated sort fields in precedence order: `field:order,field:order`. ' +
                    'Max 5 entries. Unknown/empty fields are silently dropped. ' +
                    'Example: `averageRating:desc,name:asc`'
            ),
        'averageRating:desc,name:asc'
    ),
    featuredFirst: createBooleanQueryParam(
        'When true, featured accommodations appear before non-featured within any sort. ' +
            'Public listing routes force this to true server-side.'
    )
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
    isFeatured: () => createBooleanQueryParam('Filter by featured status'),
    isActive: () => createBooleanQueryParam('Filter by active status'),
    isEmailVerified: () => createBooleanQueryParam('Filter by email verification status'),
    isPublished: () => createBooleanQueryParam('Filter by published status'),
    isVerified: () => createBooleanQueryParam('Filter by verified status'),
    isAvailable: () => createBooleanQueryParam('Filter by availability status'),
    isFree: () => createBooleanQueryParam('Filter by free/paid status'),
    isVirtual: () => createBooleanQueryParam('Filter by virtual/physical status'),
    isPremium: () => createBooleanQueryParam('Filter by premium/standard status'),
    isPublic: () => createBooleanQueryParam('Filter by public/private status'),
    isBuiltin: () => createBooleanQueryParam('Filter by builtin/custom status'),
    hasIcon: () => createBooleanQueryParam('Filter by presence of icon'),
    hasDescription: () => createBooleanQueryParam('Filter by presence of description'),
    hasMedia: () => createBooleanQueryParam('Filter by presence of media'),
    hasExcerpt: () => createBooleanQueryParam('Filter by presence of excerpt'),
    hasLocation: () => createBooleanQueryParam('Filter by presence of location'),
    hasClimateInfo: () => createBooleanQueryParam('Filter by presence of climate information'),
    hasCoordinates: () => createBooleanQueryParam('Filter by presence of coordinates'),
    isPopular: () => createBooleanQueryParam('Filter by popular tags'),
    isUnused: () => createBooleanQueryParam('Filter by unused status'),
    searchInDescription: () =>
        createBooleanQueryParamWithDefault('Include description in search', true),
    fuzzySearch: () => createBooleanQueryParamWithDefault('Enable fuzzy search', true),
    groupByCategory: () => createBooleanQueryParamWithDefault('Group results by category', false),
    popularityThreshold: () =>
        z.coerce.number().int().min(1).optional().describe('Popularity threshold filter'),
    hasImages: () => createBooleanQueryParam('Filter by presence of images'),

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

    // Price fields (common in priced entities)
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
    hasTickets: () => createBooleanQueryParam('Filter by ticket availability'),
    allowsRegistration: () => createBooleanQueryParam('Filter by registration availability'),
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
    hasActiveSubscription: () => createBooleanQueryParam('Filter by active subscription status'),
    hasAccommodations: () => createBooleanQueryParam('Filter by accommodation ownership'),
    isOpen: () => createBooleanQueryParam('Filter by open/closed status'),
    acceptsReservations: () => createBooleanQueryParam('Filter by reservation acceptance'),

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
