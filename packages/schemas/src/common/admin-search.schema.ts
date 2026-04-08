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
import { queryBooleanParam } from './query-helpers.js';

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
     * Uses queryBooleanParam() to correctly handle string query parameters.
     * Only the string "true", boolean true, or "1" evaluates to true.
     * The string "false" correctly evaluates to false (unlike z.coerce.boolean()).
     */
    includeDeleted: queryBooleanParam()
        .default(false)
        .describe('Include soft-deleted items in results'),

    /**
     * Filter items created after this ISO datetime.
     *
     * Note: If createdAfter > createdBefore (inverted range), the query returns
     * an empty result set by design. No validation error is raised because this
     * is a valid (albeit nonsensical) filter combination.
     */
    createdAfter: z.coerce
        .date()
        .optional()
        .describe('Filter items created after this date (ISO 8601)'),

    /**
     * Filter items created before this ISO datetime.
     *
     * Note: If createdAfter > createdBefore (inverted range), the query returns
     * an empty result set by design. No validation error is raised because this
     * is a valid (albeit nonsensical) filter combination.
     */
    createdBefore: z.coerce
        .date()
        .optional()
        .describe('Filter items created before this date (ISO 8601)')
});

export type AdminSearchBase = z.infer<typeof AdminSearchBaseSchema>;

/**
 * Union type of all base admin search field names.
 * Auto-derived from AdminSearchBaseSchema to stay in sync automatically.
 */
export type AdminSearchBaseKeys = keyof z.infer<typeof AdminSearchBaseSchema>;

/**
 * Runtime array of base admin search keys.
 * Derived from AdminSearchBaseSchema.shape to stay in sync with the type.
 */
export const ADMIN_SEARCH_BASE_KEYS: readonly AdminSearchBaseKeys[] = Object.keys(
    AdminSearchBaseSchema.shape
) as AdminSearchBaseKeys[];

/**
 * Extracts entity-specific filter fields from a full AdminSearchSchema.
 * Strips out base fields (page, pageSize, search, sort, status, includeDeleted, createdAfter, createdBefore)
 * leaving only the entity-specific filter fields with their inferred types.
 *
 * @example
 * ```ts
 * type AccommodationFilters = EntityFilters<typeof AccommodationAdminSearchSchema>;
 * // => { type?: AccommodationType; destinationId?: string; ownerId?: string; isFeatured?: boolean; minPrice?: number; maxPrice?: number }
 * ```
 */
export type EntityFilters<TSchema extends z.ZodObject<z.ZodRawShape>> = Omit<
    z.infer<TSchema>,
    AdminSearchBaseKeys
>;

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
 * Although AdminSearchBaseSchema already validates the sort format via regex,
 * this function adds runtime validation as a defense-in-depth measure
 * for cases where it may be called with unvalidated input.
 *
 * @param sort - Sort string in format "field:asc" or "field:desc"
 * @returns Parsed sort object with field and direction
 * @throws Error if the sort string is not in the expected format
 */
export function parseAdminSort(sort: string): ParsedSort {
    const [field, direction] = sort.split(':');
    if (!field || (direction !== 'asc' && direction !== 'desc')) {
        throw new Error(`Invalid sort format: "${sort}". Expected "field:asc" or "field:desc"`);
    }
    return { field, direction };
}
