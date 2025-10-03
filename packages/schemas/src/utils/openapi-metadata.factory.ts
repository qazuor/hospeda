/**
 * OpenAPI Metadata Factory - Consistent metadata generation
 * Eliminates repetitive OpenAPI documentation across entities
 */

/**
 * Standard field metadata generators
 */
export const StandardFieldMetadata = {
    /**
     * Common search and pagination fields
     */
    common: {
        q: { description: 'Search query string', example: 'search term' },
        page: { description: 'Page number (1-based)', example: 1 },
        pageSize: { description: 'Number of items per page (max 100)', example: 20 },
        sortBy: { description: 'Field name to sort by', example: 'createdAt' },
        sortOrder: { description: 'Sort direction', example: 'desc' }
    },

    /**
     * Price-related fields
     */
    price: {
        minPrice: { description: 'Minimum price filter', example: 50 },
        maxPrice: { description: 'Maximum price filter', example: 200 },
        currency: { description: 'Currency code', example: 'USD' }
    },

    /**
     * Accommodation-specific fields
     */
    accommodation: {
        minGuests: { description: 'Minimum guest capacity', example: 1 },
        maxGuests: { description: 'Maximum guest capacity', example: 8 },
        minBedrooms: { description: 'Minimum bedrooms', example: 1 },
        maxBedrooms: { description: 'Maximum bedrooms', example: 3 },
        minBathrooms: { description: 'Minimum bathrooms', example: 1 },
        maxBathrooms: { description: 'Maximum bathrooms', example: 2 },
        minRating: { description: 'Minimum rating', example: 4.0 },
        maxRating: { description: 'Maximum rating', example: 5.0 }
    },

    /**
     * Location-related fields
     */
    location: {
        country: { description: 'Country code (ISO 3166-1 alpha-2)', example: 'US' },
        city: { description: 'City name', example: 'Miami' },
        latitude: { description: 'Latitude coordinate', example: 25.7617 },
        longitude: { description: 'Longitude coordinate', example: -80.1918 },
        radius: { description: 'Search radius in kilometers', example: 10 }
    },

    /**
     * Date filter fields
     */
    dates: {
        createdAfter: {
            description: 'Filter items created after this date',
            example: '2024-01-01T00:00:00.000Z'
        },
        createdBefore: {
            description: 'Filter items created before this date',
            example: '2024-12-31T23:59:59.999Z'
        },
        checkIn: {
            description: 'Check-in date for availability',
            example: '2024-03-15T15:00:00.000Z'
        },
        checkOut: {
            description: 'Check-out date for availability',
            example: '2024-03-20T11:00:00.000Z'
        }
    },

    /**
     * Boolean filter fields
     */
    boolean: {
        isActive: { description: 'Filter by active status', example: true },
        isFeatured: { description: 'Filter by featured status', example: true },
        isAvailable: { description: 'Filter by availability', example: true }
    }
};

/**
 * Options for search metadata creation
 */
export type SearchMetadataOptions = {
    entityName: string;
    entityNameLower: string;
    exampleQuery?: string;
    fields?: Record<string, { description: string; example: unknown }>;
    additionalTags?: string[];
};

/**
 * Options for entity metadata creation
 */
export type EntityMetadataOptions = {
    entityName: string;
    entityNameLower: string;
    description?: string;
};

/**
 * Search metadata result type
 */
export type SearchMetadata = {
    ref: string;
    description: string;
    title: string;
    example: Record<string, unknown>;
    fields: Record<string, { description: string; example: unknown }>;
    tags: string[];
};

/**
 * Entity metadata result type
 */
export type EntityMetadata = {
    ref: string;
    description: string;
    title: string;
    tags: string[];
};

/**
 * List metadata result type
 */
export type ListMetadata = {
    ref: string;
    description: string;
    title: string;
};

/**
 * CRUD metadata result type
 */
export type CrudMetadata = {
    entity: EntityMetadata;
    search: SearchMetadata;
    list: ListMetadata;
};

/**
 * Creates search metadata for OpenAPI documentation
 */
export function createSearchMetadata(options: SearchMetadataOptions): SearchMetadata {
    const { entityName, entityNameLower, exampleQuery, fields = {}, additionalTags = [] } = options;

    const baseFields = {
        q: {
            description: `Search query for ${entityNameLower} text search`,
            example: exampleQuery || 'search text'
        },
        page: {
            description: 'Page number for pagination (1-based)',
            example: 1
        },
        pageSize: {
            description: 'Number of items per page (max 100)',
            example: 20
        },
        sortBy: {
            description: 'Field name to sort by',
            example: 'createdAt'
        },
        sortOrder: {
            description: 'Sort direction (ascending or descending)',
            example: 'desc'
        }
    };

    const example: Record<string, unknown> = {
        page: 1,
        pageSize: 20
    };

    if (exampleQuery) {
        example.q = exampleQuery;
    }

    return {
        ref: `${entityName}Search`,
        description: `Schema for searching and filtering ${entityNameLower} entities`,
        title: `${entityName} Search Parameters`,
        example,
        fields: { ...baseFields, ...fields },
        tags: [`${entityNameLower}s`, 'search', ...additionalTags]
    };
}

/**
 * Creates entity metadata for OpenAPI documentation
 */
export function createEntityMetadata(options: EntityMetadataOptions): EntityMetadata {
    const { entityName, entityNameLower, description } = options;

    return {
        ref: entityName,
        description: description || `Complete ${entityNameLower} entity schema`,
        title: `${entityName} Entity`,
        tags: [`${entityNameLower}s`]
    };
}

/**
 * Creates list metadata for OpenAPI documentation
 */
export function createListMetadata(options: EntityMetadataOptions): ListMetadata {
    const { entityName, entityNameLower } = options;

    return {
        ref: `${entityName}List`,
        description: `Paginated list of ${entityNameLower} entities`,
        title: `${entityName} List Response`
    };
}

/**
 * Creates all CRUD metadata types at once
 */
export function createCrudMetadata(
    entityName: string,
    entityNameLower: string,
    searchOptions?: Partial<SearchMetadataOptions>
): CrudMetadata {
    const baseOptions = { entityName, entityNameLower };

    return {
        entity: createEntityMetadata(baseOptions),
        search: createSearchMetadata({
            ...baseOptions,
            exampleQuery: searchOptions?.exampleQuery,
            fields: searchOptions?.fields,
            additionalTags: searchOptions?.additionalTags
        }),
        list: createListMetadata(baseOptions)
    };
}

/**
 * Creates enhanced search metadata with predefined field sets
 */
export function createEnhancedSearchMetadata(options: {
    entityName: string;
    entityNameLower: string;
    includePrice?: boolean;
    includeAccommodation?: boolean;
    includeLocation?: boolean;
    includeDates?: boolean;
    customFields?: Record<string, { description: string; example: unknown }>;
    customExample?: Record<string, unknown>;
}): SearchMetadata {
    const { entityName, entityNameLower, customFields = {}, customExample = {} } = options;

    const fields = {
        ...StandardFieldMetadata.common,
        ...(options.includePrice && StandardFieldMetadata.price),
        ...(options.includeAccommodation && StandardFieldMetadata.accommodation),
        ...(options.includeLocation && StandardFieldMetadata.location),
        ...(options.includeDates && StandardFieldMetadata.dates),
        ...StandardFieldMetadata.boolean,
        ...customFields
    };

    const example = {
        page: 1,
        pageSize: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc' as const,
        q: `search ${entityNameLower}`,
        ...(options.includePrice && { minPrice: 50, maxPrice: 200, currency: 'USD' }),
        ...(options.includeAccommodation && { minGuests: 2, maxGuests: 4, minBedrooms: 1 }),
        ...(options.includeLocation && { city: 'Miami', country: 'US' }),
        isActive: true,
        ...customExample
    };

    return {
        ref: `${entityName}Search`,
        description: `Schema for searching and filtering ${entityNameLower} entities`,
        title: `${entityName} Search Parameters`,
        example,
        fields,
        tags: [`${entityNameLower}s`, 'search']
    };
}

// Type aliases for backward compatibility and search options
export type SearchExample = string;
export type SearchFields = Record<string, { description: string; example: unknown }>;
