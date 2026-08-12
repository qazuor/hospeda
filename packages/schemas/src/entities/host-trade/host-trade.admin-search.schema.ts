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
    is24h: queryBooleanParam().describe('Filter by 24h availability'),

    /**
     * Filter by whether the provider's ability to declare usages is suspended
     * (HOS-376 T-056).
     *
     * NOT a column: a suspension is `declarationSuspendedAt IS NOT NULL`, which
     * the base admin search cannot express, so `HostTradeService` lifts this key
     * out of the filters and turns it into a SQL condition.
     *
     * It exists because nothing else can answer "who is suspended right now"
     * (AC-11). A suspension is written by two different paths — the rejection
     * threshold, which stamps no admin id, and an admin's own decision — and
     * both leave the provider unable to record work until someone looks. Without
     * this filter that someone would have to page through the whole directory.
     */
    declarationSuspended: queryBooleanParam().describe(
        'Filter by declaration-suspension state (true = suspended, false = able to declare)'
    )
});

/**
 * Inferred TypeScript type for HostTrade admin search parameters.
 */
export type HostTradeAdminSearch = z.infer<typeof HostTradeAdminSearchSchema>;
