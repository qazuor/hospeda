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
 * Legacy pagination params schema (for backward compatibility with tests)
 * Uses limit/offset pattern instead of page/pageSize
 */

/**
 * Cursor pagination params schema
 */
export const CursorPaginationParamsSchema = z.object({
    limit: z.number().int().positive().max(100).default(10),
    cursor: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
    orderBy: z.string().optional()
});
export type CursorPaginationParamsType = z.infer<typeof CursorPaginationParamsSchema>;

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

export const CursorPaginationResultSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
    z.object({
        data: z.array(itemSchema),
        pagination: z.object({
            nextCursor: z.string().optional(),
            hasMore: z.boolean(),
            limit: z.number().int().min(0) // Allow 0 or positive integers as per test expectation
        })
    });
