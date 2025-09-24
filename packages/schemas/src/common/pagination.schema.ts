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

export const CursorPaginationResultSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
    z.object({
        data: z.array(itemSchema),
        pagination: z.object({
            nextCursor: z.string().optional(),
            hasMore: z.boolean(),
            pageSize: z.number().int().positive() // Changed from 'limit' to 'pageSize'
        })
    });
