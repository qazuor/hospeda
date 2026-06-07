import { z } from 'zod';
import { ModerationCategorySchema } from '../../enums/moderation-category.schema.js';

const ModerationTermValueSchema = z.string().trim().min(1).max(255);

/**
 * Base schema for a content moderation term entity (SPEC-195).
 * Matches the Drizzle `contentModerationTerms` table shape.
 */
export const contentModerationTermSchema = z.object({
    id: z.string().uuid(),
    term: ModerationTermValueSchema,
    kind: z.enum(['word', 'domain']),
    category: ModerationCategorySchema,
    severity: z.number().min(0).max(1).default(1.0),
    enabled: z.boolean().default(true),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    deletedAt: z.coerce.date().nullable(),
    createdById: z.string().uuid().nullable(),
    updatedById: z.string().uuid().nullable()
});

export type ContentModerationTerm = z.infer<typeof contentModerationTermSchema>;
