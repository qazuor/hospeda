import { z } from 'zod';

/**
 * Defines the direction for sorting results.
 */
export const SortDirectionSchema = z.enum(['ASC', 'DESC']);

/**
 * Schema for defining sorting parameters.
 * @property {string} field - The field to sort by.
 * @property {SortDirectionEnum} direction - The sorting direction.
 */
export const SortSchema = z.object({
    field: z.string().min(1),
    direction: SortDirectionSchema
});

/**
 * Schema for defining pagination parameters.
 * @property {number} [page=1] - The page number to retrieve.
 * @property {number} [pageSize=10] - The number of items per page.
 */
export const PaginationSchema = z.object({
    page: z.number().int().positive().optional().default(1),
    pageSize: z.number().int().positive().optional().default(10)
});

/**
 * Base schema for search operations, including pagination and sorting.
 * Filters are expected to be added by extending this schema in concrete service implementations.
 *
 * @property {PaginationSchema} pagination - Pagination parameters.
 * @property {SortSchema[]} [sort] - An array of sorting criteria.
 */
export const BaseSearchSchema = z.object({
    pagination: PaginationSchema.optional(),
    sort: z.array(SortSchema).optional()
});
