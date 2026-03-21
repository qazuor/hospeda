import type { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { queryBooleanParam } from '../../common/query-helpers.js';

/**
 * Admin search schema for features.
 * Extends base admin search with feature-specific filters.
 *
 * Note: The features table has no `category` column.
 *
 * @example
 * ```ts
 * const params = FeatureAdminSearchSchema.parse({
 *   page: 1,
 *   isBuiltin: false,
 *   search: 'pool'
 * });
 * ```
 */
export const FeatureAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by built-in status */
    isBuiltin: queryBooleanParam().describe('Filter built-in features')
});

/** Inferred TypeScript type for feature admin search parameters */
export type FeatureAdminSearch = z.infer<typeof FeatureAdminSearchSchema>;
