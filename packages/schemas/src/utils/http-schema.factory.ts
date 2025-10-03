/**
 * HTTP Schema Factory - Generic schema creation for HTTP endpoints
 * Eliminates repetitive boilerplate across entity schemas
 */
import { z } from 'zod';
import { CommonHttpFields } from './http-field.factory.js';

/**
 * Predefined field sets for common entity types
 */
export const HttpFieldSets = {
    /**
     * Price-related fields for commerce entities
     */
    price: {
        minPrice: CommonHttpFields.minPrice(),
        maxPrice: CommonHttpFields.maxPrice()
    },

    /**
     * Accommodation-specific fields
     */
    accommodation: {
        minGuests: CommonHttpFields.minGuests(),
        maxGuests: CommonHttpFields.maxGuests(),
        minBedrooms: CommonHttpFields.minBedrooms(),
        maxBedrooms: CommonHttpFields.maxBedrooms(),
        minBathrooms: CommonHttpFields.minBathrooms(),
        maxBathrooms: CommonHttpFields.maxBathrooms(),
        minRating: CommonHttpFields.minRating(),
        maxRating: CommonHttpFields.maxRating()
    },

    /**
     * Location-related fields for geo entities
     */
    location: {
        country: z.string().length(2).optional(),
        city: z.string().optional(),
        latitude: CommonHttpFields.latitude(),
        longitude: CommonHttpFields.longitude(),
        radius: CommonHttpFields.radius()
    },

    /**
     * Date range fields for temporal filtering
     */
    dates: {
        createdAfter: CommonHttpFields.createdAfter(),
        createdBefore: CommonHttpFields.createdBefore()
    },

    /**
     * Availability-related date fields
     */
    availability: {
        checkIn: CommonHttpFields.checkIn(),
        checkOut: CommonHttpFields.checkOut()
    },

    /**
     * Common boolean filters
     */
    boolean: {
        isActive: CommonHttpFields.isActive(),
        isFeatured: CommonHttpFields.isFeatured(),
        isAvailable: CommonHttpFields.isAvailable()
    },

    /**
     * User-specific fields
     */
    user: {
        isEmailVerified: CommonHttpFields.isEmailVerified(),
        hasActiveSubscription: CommonHttpFields.hasActiveSubscription(),
        minAge: CommonHttpFields.minAge(),
        maxAge: CommonHttpFields.maxAge()
    },

    /**
     * Array fields
     */
    arrays: {
        amenities: CommonHttpFields.amenities(),
        tags: CommonHttpFields.tags()
    }
};

/**
 * Creates a comprehensive HTTP search schema by combining field sets
 */
export function createEntityHttpSearchSchema(config: {
    includePrice?: boolean;
    includeAccommodation?: boolean;
    includeLocation?: boolean;
    includeDates?: boolean;
    includeAvailability?: boolean;
    includeUser?: boolean;
    includeArrays?: boolean;
    customFields?: z.ZodRawShape;
}) {
    const fields: z.ZodRawShape = {
        q: z.string().optional(),
        ...HttpFieldSets.boolean,
        ...(config.includePrice && HttpFieldSets.price),
        ...(config.includeAccommodation && HttpFieldSets.accommodation),
        ...(config.includeLocation && HttpFieldSets.location),
        ...(config.includeDates && HttpFieldSets.dates),
        ...(config.includeAvailability && HttpFieldSets.availability),
        ...(config.includeUser && HttpFieldSets.user),
        ...(config.includeArrays && HttpFieldSets.arrays),
        ...config.customFields
    };

    return basePaginationSchema.extend(fields);
}

/**
 * Options for creating HTTP search schemas
 */
export type HttpSearchSchemaOptions = {
    /** Include text search "q" parameter */
    includeTextSearch?: boolean;
    /** Custom filter schema to merge with pagination */
    filterSchema?: z.ZodObject<z.ZodRawShape>;
};

/**
 * Options for creating HTTP filter schemas (non-paginated)
 */
export type HttpFilterSchemaOptions = {
    /** Include text search "q" parameter */
    includeTextSearch?: boolean;
    /** Custom filter schema to merge */
    filterSchema?: z.ZodObject<z.ZodRawShape>;
};

/**
 * Common pagination and sorting schema
 */
const basePaginationSchema = z.object({
    page: z
        .string()
        .optional()
        .default('1')
        .transform((val) => Math.max(1, Number.parseInt(val, 10)))
        .refine((val) => val >= 1 && val <= 1000, {
            message: 'Page must be between 1 and 1000'
        }),
    pageSize: z
        .string()
        .optional()
        .default('20')
        .transform((val) => Math.min(100, Math.max(1, Number.parseInt(val, 10))))
        .refine((val) => val >= 1 && val <= 100, {
            message: 'Page size must be between 1 and 100'
        }),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
});

/**
 * Text search schema
 */
const textSearchSchema = z.object({
    q: z.string().optional()
});

/**
 * Creates a generic HTTP search schema with pagination, sorting, and optional filters
 *
 * @param options Configuration options for the schema
 * @returns Zod schema for HTTP search endpoints
 */
export function createHttpSearchSchema(options: HttpSearchSchemaOptions = {}): z.ZodSchema {
    const { includeTextSearch = true, filterSchema } = options;

    let baseSchema = basePaginationSchema;

    // Add text search if enabled
    if (includeTextSearch) {
        baseSchema = baseSchema.merge(textSearchSchema);
    }

    // Merge custom filter schema if provided
    if (filterSchema) {
        return baseSchema.merge(filterSchema);
    }

    return baseSchema;
}

/**
 * Creates a generic HTTP filter schema without pagination (for dropdown/select data)
 *
 * @param options Configuration options for the schema
 * @returns Zod schema for HTTP filter endpoints
 */
export function createHttpFilterSchema(options: HttpFilterSchemaOptions = {}): z.ZodSchema {
    const { includeTextSearch = true, filterSchema } = options;

    let baseSchema = z.object({});

    // Add text search if enabled
    if (includeTextSearch) {
        baseSchema = baseSchema.merge(textSearchSchema);
    }

    // Merge custom filter schema if provided
    if (filterSchema) {
        return baseSchema.merge(filterSchema);
    }

    return baseSchema;
}
