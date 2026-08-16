import { z } from 'zod';
import { stripShapeDefaults } from '../../utils/utils.js';
import { SocialAudienceSchema } from './social-audience.schema.js';

/**
 * Input schema for creating a new social audience.
 * Excludes auto-generated audit and id fields.
 *
 * `slug` is optional — the service auto-generates it from `name` in `_beforeCreate`
 * when not supplied. Any client-supplied slug is preserved.
 */
export const SocialAudienceCreateSchema = SocialAudienceSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).partial({ slug: true });

/**
 * Input schema for updating an existing social audience.
 * All business fields are optional for partial updates.
 *
 * `stripShapeDefaults` is load-bearing: in Zod 4 `.partial()` does NOT suppress
 * a `.default()`, so without it a PATCH omitting a defaulted field parses that
 * field back in and the literal SQL `SET` overwrites it. See the guard in
 * `test/no-defaults-in-patch-schemas.guard.test.ts`.
 */
export const SocialAudienceUpdateSchema = z
    .object(stripShapeDefaults(SocialAudienceCreateSchema.shape))
    .partial();

/** TypeScript type for creating a social audience. */
export type SocialAudienceCreate = z.infer<typeof SocialAudienceCreateSchema>;

/** TypeScript type for updating a social audience. */
export type SocialAudienceUpdate = z.infer<typeof SocialAudienceUpdateSchema>;
