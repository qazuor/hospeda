import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';

/**
 * Admin search schema for tags.
 * Extends base admin search with tag-specific filters.
 *
 * @example
 * ```ts
 * const params = TagAdminSearchSchema.parse({
 *   page: 1,
 *   color: '#FF5733',
 *   nameContains: 'beach'
 * });
 * ```
 */
export const TagAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by tag color (hex format, e.g. #FF5733) */
    color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional()
        .describe('Filter by tag color'),
    /** Filter tags whose name contains this text */
    nameContains: z.string().min(1).max(50).optional().describe('Filter tags by name substring')
});

/** Inferred TypeScript type for tag admin search parameters */
export type TagAdminSearch = z.infer<typeof TagAdminSearchSchema>;
