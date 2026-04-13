import { z } from 'zod';

/**
 * Zod schema for list operation options.
 * Single source of truth for validating list() parameters.
 * The `ListOptions` type is derived from this schema via `z.infer`.
 *
 * @see ListOptions in ./index.ts
 */
export const listOptionsSchema = z.object({
    /** Page number (1-based) */
    page: z.number().optional(),
    /** Number of items per page */
    pageSize: z.number().optional(),
    /** Free-text search query (max 200 characters) */
    search: z.string().max(200, 'Search query must be at most 200 characters').optional(),
    /** Relations to include in the response */
    relations: z
        .record(z.string(), z.union([z.boolean(), z.record(z.string(), z.unknown())]))
        .optional(),
    /** Where clause filters */
    where: z.record(z.string(), z.unknown()).optional(),
    /** Column to sort by */
    sortBy: z.string().optional(),
    /** Sort direction */
    sortOrder: z.enum(['asc', 'desc']).optional()
});

/**
 * Type-safe list options derived from `listOptionsSchema`.
 * Use this type for all `list()` method signatures.
 *
 * @property page - Page number (1-based).
 * @property pageSize - Number of items per page.
 * @property search - Free-text search query (max 200 characters).
 * @property relations - Relations to include (boolean for simple, object for nested).
 * @property where - Where clause filters.
 * @property sortBy - Column to sort by.
 * @property sortOrder - Sort direction ('asc' | 'desc').
 *
 * @example
 * ```ts
 * const opts: ListOptions = {
 *   page: 1,
 *   pageSize: 20,
 *   search: 'hotel',
 *   sortBy: 'name',
 *   sortOrder: 'asc',
 * };
 * ```
 */
export type ListOptions = z.infer<typeof listOptionsSchema>;
