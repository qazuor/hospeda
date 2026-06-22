import type { z } from 'zod';
import { SocialContentBatchSchema } from './social-content-batch.schema.js';

/**
 * Input schema for creating a new social content batch.
 * Excludes auto-generated audit and id fields.
 */
export const SocialContentBatchCreateSchema = SocialContentBatchSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/**
 * Input schema for updating an existing social content batch.
 * All business fields are optional for partial updates.
 */
export const SocialContentBatchUpdateSchema = SocialContentBatchCreateSchema.partial();

/** TypeScript type for creating a social content batch. */
export type SocialContentBatchCreate = z.infer<typeof SocialContentBatchCreateSchema>;

/** TypeScript type for updating a social content batch. */
export type SocialContentBatchUpdate = z.infer<typeof SocialContentBatchUpdateSchema>;
