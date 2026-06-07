import { z } from 'zod';
import { ModerationCategorySchema } from '../../enums/moderation-category.schema.js';

const ModerationTermValueSchema = z.string().trim().min(1).max(255);

/**
 * Schema for creating a new content moderation term (SPEC-195).
 * Omits id, timestamps, and deletedAt — those are server-managed.
 */
export const createContentModerationTermSchema = z.object({
    term: ModerationTermValueSchema,
    kind: z.enum(['word', 'domain']),
    category: ModerationCategorySchema,
    severity: z.number().min(0).max(1).default(1.0),
    enabled: z.boolean().default(true)
});

export type CreateContentModerationTerm = z.infer<typeof createContentModerationTermSchema>;

/**
 * Schema for updating an existing content moderation term.
 * All fields are optional (partial update).
 */
export const updateContentModerationTermSchema = z.object({
    term: ModerationTermValueSchema.optional(),
    kind: z.enum(['word', 'domain']).optional(),
    category: ModerationCategorySchema.optional(),
    severity: z.number().min(0).max(1).optional(),
    enabled: z.boolean().optional()
});

export type UpdateContentModerationTerm = z.infer<typeof updateContentModerationTermSchema>;
