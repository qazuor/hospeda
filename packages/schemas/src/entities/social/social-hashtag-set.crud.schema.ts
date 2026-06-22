import type { z } from 'zod';
import { SocialHashtagSetSchema } from './social-hashtag-set.schema.js';

/**
 * Input schema for creating a new social hashtag set.
 * Excludes auto-generated audit and id fields.
 */
export const SocialHashtagSetCreateSchema = SocialHashtagSetSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/**
 * Input schema for updating an existing social hashtag set.
 * All business fields are optional for partial updates.
 */
export const SocialHashtagSetUpdateSchema = SocialHashtagSetCreateSchema.partial();

/** TypeScript type for creating a social hashtag set. */
export type SocialHashtagSetCreate = z.infer<typeof SocialHashtagSetCreateSchema>;

/** TypeScript type for updating a social hashtag set. */
export type SocialHashtagSetUpdate = z.infer<typeof SocialHashtagSetUpdateSchema>;
