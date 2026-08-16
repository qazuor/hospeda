import { z } from 'zod';
import { stripShapeDefaults } from '../../utils/utils.js';
import { SocialPostFooterSchema } from './social-post-footer.schema.js';

/**
 * Input schema for creating a new social post footer.
 * Excludes auto-generated audit and id fields.
 *
 * `slug` is optional — the service auto-generates it from `name` in `_beforeCreate`
 * when not supplied. Any client-supplied slug is preserved.
 */
export const SocialPostFooterCreateSchema = SocialPostFooterSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).partial({ slug: true });

/**
 * Input schema for updating an existing social post footer.
 * All business fields are optional for partial updates.
 *
 * `stripShapeDefaults` is load-bearing: in Zod 4 `.partial()` does NOT suppress
 * a `.default()`, so without it a PATCH omitting a defaulted field parses that
 * field back in and the literal SQL `SET` overwrites it. See the guard in
 * `test/no-defaults-in-patch-schemas.guard.test.ts`.
 */
export const SocialPostFooterUpdateSchema = z
    .object(stripShapeDefaults(SocialPostFooterCreateSchema.shape))
    .partial();

/** TypeScript type for creating a social post footer. */
export type SocialPostFooterCreate = z.infer<typeof SocialPostFooterCreateSchema>;

/** TypeScript type for updating a social post footer. */
export type SocialPostFooterUpdate = z.infer<typeof SocialPostFooterUpdateSchema>;
