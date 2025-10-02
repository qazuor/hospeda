/**
 * HTTP Schema Factory - Generic schema creation for HTTP endpoints
 * Eliminates repetitive boilerplate across entity schemas
 */
import { z } from 'zod';

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
