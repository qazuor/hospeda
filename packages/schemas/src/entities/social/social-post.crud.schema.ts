import { z } from 'zod';
import { SocialPostSchema } from './social-post.schema.js';

/**
 * Input schema for creating a new social post (GPT ingestion or admin create).
 * Excludes auto-generated audit and id fields.
 * `slug` is optional — services generate it from `title` when absent.
 */
export const SocialPostCreateSchema = SocialPostSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).extend({
    slug: z.string().min(1, { message: 'zodError.socialPost.slug.min' }).optional()
});

/**
 * Input schema for updating an existing social post.
 * All business fields are optional for partial updates.
 */
export const SocialPostUpdateSchema = SocialPostCreateSchema.partial();

/** TypeScript type for creating a social post. */
export type SocialPostCreate = z.infer<typeof SocialPostCreateSchema>;

/** TypeScript type for updating a social post. */
export type SocialPostUpdate = z.infer<typeof SocialPostUpdateSchema>;
