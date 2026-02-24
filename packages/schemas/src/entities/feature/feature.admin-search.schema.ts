import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';

/**
 * Admin search schema for features.
 * Extends base admin search with feature-specific filters.
 *
 * @example
 * ```ts
 * const params = FeatureAdminSearchSchema.parse({
 *   page: 1,
 *   category: 'outdoor',
 *   isBuiltin: false
 * });
 * ```
 */
export const FeatureAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by feature category */
    category: z.string().optional().describe('Filter by feature category'),
    /** Filter by built-in status */
    isBuiltin: z.coerce.boolean().optional().describe('Filter built-in features')
});

/** Inferred TypeScript type for feature admin search parameters */
export type FeatureAdminSearch = z.infer<typeof FeatureAdminSearchSchema>;
