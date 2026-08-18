import { z } from 'zod';
import { stripShapeDefaults } from '../../utils/utils.js';
import { SocialPostTargetSchema } from './social-post-target.schema.js';

/**
 * Input schema for creating a new social post target.
 * Excludes auto-generated id and timestamp fields.
 */
export const SocialPostTargetCreateSchema = SocialPostTargetSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Input schema for updating an existing social post target.
 * All business fields are optional for partial updates.
 *
 * `stripShapeDefaults` is load-bearing: in Zod 4 `.partial()` does NOT suppress
 * a `.default()`, so without it a PATCH omitting a defaulted field parses that
 * field back in and the literal SQL `SET` overwrites it. See the guard in
 * `test/no-defaults-in-patch-schemas.guard.test.ts`.
 */
export const SocialPostTargetUpdateSchema = z
    .object(stripShapeDefaults(SocialPostTargetCreateSchema.shape))
    .partial();

/** TypeScript type for creating a social post target. */
export type SocialPostTargetCreate = z.infer<typeof SocialPostTargetCreateSchema>;

/** TypeScript type for updating a social post target. */
export type SocialPostTargetUpdate = z.infer<typeof SocialPostTargetUpdateSchema>;
