import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';

/**
 * Admin search/query schema for content moderation thresholds (SPEC-195).
 * Extends the base admin search with a context filter.
 */
export const contentModerationThresholdAdminSearchSchema = AdminSearchBaseSchema.extend({
    context: z.string().optional()
});

export type ContentModerationThresholdAdminSearch = z.infer<
    typeof contentModerationThresholdAdminSearchSchema
>;
