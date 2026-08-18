import { z } from 'zod';
import { stripShapeDefaults } from '../../utils/utils.js';
import { SocialHashtagSchema } from './social-hashtag.schema.js';

/**
 * Input schema for creating a new social hashtag.
 * Excludes auto-generated audit and id fields.
 *
 * `normalizedHashtag` is optional here — the service derives it from `hashtag`
 * in `_beforeCreate` (lowercase + `#` prefix normalization). Callers MUST supply
 * `hashtag`; the normalized form is computed server-side and any client-supplied
 * value is overwritten.
 */
export const SocialHashtagCreateSchema = SocialHashtagSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).partial({ normalizedHashtag: true });

/**
 * Input schema for updating an existing social hashtag.
 * All business fields are optional for partial updates.
 *
 * `stripShapeDefaults` is load-bearing: in Zod 4 `.partial()` does NOT suppress
 * a `.default()`, so without it a PATCH omitting a defaulted field parses that
 * field back in and the literal SQL `SET` overwrites it. See the guard in
 * `test/no-defaults-in-patch-schemas.guard.test.ts`.
 */
export const SocialHashtagUpdateSchema = z
    .object(stripShapeDefaults(SocialHashtagCreateSchema.shape))
    .partial();

/** TypeScript type for creating a social hashtag. */
export type SocialHashtagCreate = z.infer<typeof SocialHashtagCreateSchema>;

/** TypeScript type for updating a social hashtag. */
export type SocialHashtagUpdate = z.infer<typeof SocialHashtagUpdateSchema>;
