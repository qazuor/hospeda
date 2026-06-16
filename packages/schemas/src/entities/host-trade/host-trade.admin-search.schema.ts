import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { queryBooleanParam } from '../../common/query-helpers.js';
import { HostTradeCategoryEnumSchema } from '../../enums/host-trade-category.schema.js';

/**
 * HostTradeAdminSearchSchema — admin list search parameters for the host-trades directory.
 *
 * Extends `AdminSearchBaseSchema` (which provides `page`, `pageSize`, `search`,
 * `sort`, `status`, `includeDeleted`, `createdAfter`, `createdBefore`) with
 * host-trade-specific filters.
 *
 * @example
 * ```ts
 * const params = HostTradeAdminSearchSchema.parse({
 *   page: 1,
 *   search: 'plomero',
 *   category: 'PLOMERIA',
 *   isActive: true
 * });
 * ```
 */
export const HostTradeAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by destination */
    destinationId: z.string().uuid().optional(),

    /** Filter by service category */
    category: HostTradeCategoryEnumSchema.optional(),

    /**
     * Filter by active status.
     * Uses `queryBooleanParam()` to safely coerce "true"/"false" query strings
     * (unlike `z.coerce.boolean()`, which incorrectly converts "false" → true).
     */
    isActive: queryBooleanParam().describe('Filter by active status'),

    /** Filter to show only 24h-available providers */
    is24h: queryBooleanParam().describe('Filter by 24h availability')
});

/**
 * Inferred TypeScript type for HostTrade admin search parameters.
 */
export type HostTradeAdminSearch = z.infer<typeof HostTradeAdminSearchSchema>;
