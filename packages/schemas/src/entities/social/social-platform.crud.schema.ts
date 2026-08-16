import { z } from 'zod';
import { stripShapeDefaults } from '../../utils/utils.js';
import { SocialPlatformSchema } from './social-platform.schema.js';

/**
 * Input schema for creating a new social platform config row.
 * Excludes auto-generated audit and id fields.
 */
export const SocialPlatformCreateSchema = SocialPlatformSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/**
 * Input schema for updating an existing social platform.
 * All business fields are optional for partial updates.
 *
 * `stripShapeDefaults` is load-bearing: in Zod 4 `.partial()` does NOT suppress
 * a `.default()`, so without it a PATCH omitting a defaulted field parses that
 * field back in and the literal SQL `SET` overwrites it. See the guard in
 * `test/no-defaults-in-patch-schemas.guard.test.ts`.
 */
export const SocialPlatformUpdateSchema = z
    .object(stripShapeDefaults(SocialPlatformCreateSchema.shape))
    .partial();

/** TypeScript type for creating a social platform. */
export type SocialPlatformCreate = z.infer<typeof SocialPlatformCreateSchema>;

/** TypeScript type for updating a social platform. */
export type SocialPlatformUpdate = z.infer<typeof SocialPlatformUpdateSchema>;
