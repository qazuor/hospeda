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
 * Cursor pagination params schema (for cursor-based pagination)
 * Uses limit/cursor pattern for infinite scroll scenarios
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
 * Multi-column sort primitive. Used by `BaseSearchSchema.sorts[]` to express
 * compound ORDER BY clauses like `averageRating DESC, name ASC`.
 *
 * The `field` is a plain string — whitelisting against a model-specific allow-list
 * is the responsibility of the consuming route (e.g. `sanitizeSorts()` on the
 * public accommodation list route). Unknown fields passed to the DB layer are
 * silently ignored.
 */
export const SortFieldSchema = z.object({
    field: z.string().min(1),
    order: z.enum(['asc', 'desc'])
});
export type SortField = z.infer<typeof SortFieldSchema>;

/**
 * Base search schema combining pagination, sorting and search query.
 *
 * Sorting precedence (when both are present):
 *   1. `sorts[]` — multi-column sort, up to 5 entries in declared order.
 *   2. `sortBy` / `sortOrder` — legacy single-column fallback.
 *
 * `featuredFirst` is an independent flag that, when true, forces the consuming
 * model to prepend `isFeatured DESC` to the ORDER BY clause — regardless of what
 * the client requested in `sorts`/`sortBy`. Enforcement is the model's job.
 */
export const BaseSearchSchema = z.object({
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().max(100).default(10),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc').optional(),
    sorts: z
        .array(SortFieldSchema)
        .max(5, { message: 'zodError.common.sort.maxFields' })
        .optional(),
    featuredFirst: z.boolean().optional(),
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
