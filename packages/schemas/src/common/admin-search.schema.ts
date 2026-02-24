/**
 * Admin Search Base Schema
 *
 * Provides standardized query parameters for admin list endpoints.
 * All entity-specific admin search schemas should extend this base.
 *
 * Includes pagination, sorting, text search, lifecycle status filtering,
 * soft-delete inclusion, and date range filtering.
 */
import { z } from 'zod';
import { LifecycleStatusEnum } from '../enums/lifecycle-state.enum.js';

/**
 * Admin status filter values.
 * Includes 'all' as a special value to show all statuses,
 * plus the actual LifecycleStatusEnum values (DRAFT, ACTIVE, ARCHIVED).
 */
export const AdminStatusFilterSchema = z
    .enum(['all', ...Object.values(LifecycleStatusEnum)] as [string, ...string[]])
    .default('all')
    .describe('Filter by lifecycle status. Use "all" to show all statuses');

export type AdminStatusFilter = z.infer<typeof AdminStatusFilterSchema>;

/**
 * Admin Search Base Schema
 *
 * Standard query parameters for all admin list endpoints:
 * - page/pageSize: Pagination (default 1/20, max 100)
 * - search: Text search across name/title/description fields
 * - sort: Sort field and direction (format: "field:asc" or "field:desc")
 * - status: Lifecycle status filter (all, DRAFT, ACTIVE, ARCHIVED)
 * - includeDeleted: Include soft-deleted items (default false)
 * - createdAfter/createdBefore: Date range filters
 */
export const AdminSearchBaseSchema = z.object({
    /** Page number for pagination (1-based) */
    page: z.coerce
        .number()
        .int()
        .positive({ message: 'zodError.admin.search.page.positive' })
        .default(1)
        .describe('Page number for pagination (1-based)'),

    /** Number of items per page (1-100, default 20) */
    pageSize: z.coerce
        .number()
        .int()
        .positive({ message: 'zodError.admin.search.pageSize.positive' })
        .max(100, { message: 'zodError.admin.search.pageSize.max' })
        .default(20)
        .describe('Number of items per page (max 100)'),

    /** Text search query across name/title/description fields */
    search: z
        .string()
        .max(200, { message: 'zodError.admin.search.search.max' })
        .optional()
        .describe('Text search query across name/title/description fields'),

    /** Sort field and direction (format: "field:asc" or "field:desc") */
    sort: z
        .string()
        .regex(/^[a-zA-Z_]+:(asc|desc)$/, {
            message: 'zodError.admin.search.sort.format'
        })
        .default('createdAt:desc')
        .describe('Sort field and direction (format: "field:asc" or "field:desc")'),

    /** Filter by lifecycle status */
    status: AdminStatusFilterSchema,

    /**
     * Include soft-deleted items in results.
     *
     * Uses z.preprocess to correctly handle string query parameters.
     * Only the string "true" or boolean true evaluates to true.
     * The string "false" correctly evaluates to false (unlike z.coerce.boolean()).
     *
     * To disable, omit the parameter or send "false". Do NOT use z.coerce.boolean()
     * here as it would convert the string "false" to boolean true.
     */
    includeDeleted: z
        .preprocess((val) => val === 'true' || val === true, z.boolean())
        .default(false)
        .describe('Include soft-deleted items in results'),

    /** Filter items created after this ISO datetime */
    createdAfter: z.coerce
        .date()
        .optional()
        .describe('Filter items created after this date (ISO 8601)'),

    /** Filter items created before this ISO datetime */
    createdBefore: z.coerce
        .date()
        .optional()
        .describe('Filter items created before this date (ISO 8601)')
});

export type AdminSearchBase = z.infer<typeof AdminSearchBaseSchema>;

/**
 * Parsed sort result from the sort string
 */
export interface ParsedSort {
    readonly field: string;
    readonly direction: 'asc' | 'desc';
}

/**
 * Utility to parse the sort string into field and direction.
 *
 * @param sort - Sort string in format "field:direction"
 * @returns Parsed sort object with field and direction
 */
export function parseAdminSort(sort: string): ParsedSort {
    const [field, direction] = sort.split(':') as [string, 'asc' | 'desc'];
    return { field, direction };
}
