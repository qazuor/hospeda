import { z } from 'zod';
import { stripShapeDefaults } from '../../utils/utils.js';
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
 *
 * `stripShapeDefaults` is load-bearing: in Zod 4 `.partial()` does NOT suppress
 * a `.default()`, so without it a PATCH omitting a defaulted field parses that
 * field back in and the literal SQL `SET` overwrites it. See the guard in
 * `test/no-defaults-in-patch-schemas.guard.test.ts`.
 */
export const SocialPostUpdateSchema = z
    .object(stripShapeDefaults(SocialPostCreateSchema.shape))
    .partial();

/** TypeScript type for creating a social post. */
export type SocialPostCreate = z.infer<typeof SocialPostCreateSchema>;

/** TypeScript type for updating a social post. */
export type SocialPostUpdate = z.infer<typeof SocialPostUpdateSchema>;
