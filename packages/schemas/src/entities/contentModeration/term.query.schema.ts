import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { ModerationCategorySchema } from '../../enums/moderation-category.schema.js';

/**
 * Admin search/query schema for content moderation terms (SPEC-195).
 * Extends the base admin search with term-specific filters.
 */
export const contentModerationTermAdminSearchSchema = AdminSearchBaseSchema.extend({
    kind: z.enum(['word', 'domain']).optional(),
    category: ModerationCategorySchema.optional(),
    enabled: z.coerce.boolean().optional()
});

export type ContentModerationTermAdminSearch = z.infer<
    typeof contentModerationTermAdminSearchSchema
>;
