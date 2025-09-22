import { z } from 'zod';

/**
 * Standard pagination schema using page/pageSize pattern
 */
export const PaginationSchema = z.object({
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().max(100).default(10)
});
export type PaginationType = z.infer<typeof PaginationSchema>;

/**
 * Standard sorting schema with sortBy/sortOrder pattern
 */
export const SortingSchema = z.object({
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc').optional()
});
export type SortingType = z.infer<typeof SortingSchema>;

/**
 * Base search schema combining pagination, sorting and search query
 */
export const BaseSearchSchema = z.object({
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().max(100).default(10),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc').optional(),
    q: z.string().optional()
});
export type BaseSearchType = z.infer<typeof BaseSearchSchema>;

/**
 * Standard pagination result schema
 */
export const PaginationResultSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
    z.object({
        data: z.array(itemSchema),
        pagination: z.object({
            page: z.number().int().positive(),
            pageSize: z.number().int().positive(),
            total: z.number().int().min(0),
            totalPages: z.number().int().min(0),
            hasNextPage: z.boolean(),
            hasPreviousPage: z.boolean()
        })
    });

// Legacy schemas - kept for backward compatibility
/**
 * @deprecated Use PaginationSchema instead
 */
export const PaginationParamsSchema = z.object({
    limit: z.number().int().min(1).max(100).default(10),
    offset: z.number().int().min(0).default(0),
    order: z.enum(['asc', 'desc']).default('desc').optional(),
    orderBy: z.string().optional()
});
export type PaginationParams = z.infer<typeof PaginationParamsSchema>;

/**
 * @deprecated Use BaseSearchSchema instead
 */
export const SearchParamsSchema = PaginationParamsSchema.extend({
    q: z.string().optional(),
    name: z.string().optional()
});
export type SearchParams = z.infer<typeof SearchParamsSchema>;

/**
 * Cursor-based pagination schema
 */
export const CursorPaginationParamsSchema = z.object({
    limit: z.number().int().min(1).max(100).default(10),
    cursor: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc').optional(),
    orderBy: z.string().optional()
});
export type CursorPaginationParams = z.infer<typeof CursorPaginationParamsSchema>;

export const CursorPaginationResultSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
    z.object({
        data: z.array(itemSchema),
        pagination: z.object({
            nextCursor: z.string().optional(),
            hasMore: z.boolean(),
            limit: z.number().int()
        })
    });
