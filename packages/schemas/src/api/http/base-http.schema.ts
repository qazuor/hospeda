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
