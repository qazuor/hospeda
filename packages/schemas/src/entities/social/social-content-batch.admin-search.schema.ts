import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { queryBooleanParam } from '../../common/query-helpers.js';

/**
 * Admin search schema for social content batches.
 * Extends base admin search with batch-specific filters.
 *
 * @example
 * ```ts
 * const params = SocialContentBatchAdminSearchSchema.parse({
 *   page: 1,
 *   active: true
 * });
 * ```
 */
export const SocialContentBatchAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by active status */
    active: queryBooleanParam().describe('Filter by active status'),

    /** Filter batches starting after this date */
    startsAfter: z.coerce.date().optional().describe('Filter batches starting after this date'),

    /** Filter batches ending before this date */
    endsBefore: z.coerce.date().optional().describe('Filter batches ending before this date')
});

/**
 * Type inferred from {@link SocialContentBatchAdminSearchSchema}.
 */
export type SocialContentBatchAdminSearch = z.infer<typeof SocialContentBatchAdminSearchSchema>;
