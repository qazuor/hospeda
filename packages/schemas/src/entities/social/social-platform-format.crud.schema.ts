import { z } from 'zod';
import { stripShapeDefaults } from '../../utils/utils.js';
import { SocialPlatformFormatSchema } from './social-platform-format.schema.js';

/**
 * Input schema for creating a new social platform format config row.
 * Excludes auto-generated audit and id fields.
 */
export const SocialPlatformFormatCreateSchema = SocialPlatformFormatSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/**
 * Input schema for updating an existing social platform format.
 * All business fields are optional for partial updates.
 *
 * `stripShapeDefaults` is load-bearing: in Zod 4 `.partial()` does NOT suppress
 * a `.default()`, so without it a PATCH omitting a defaulted field parses that
 * field back in and the literal SQL `SET` overwrites it. See the guard in
 * `test/no-defaults-in-patch-schemas.guard.test.ts`.
 */
export const SocialPlatformFormatUpdateSchema = z
    .object(stripShapeDefaults(SocialPlatformFormatCreateSchema.shape))
    .partial();

/** TypeScript type for creating a social platform format. */
export type SocialPlatformFormatCreate = z.infer<typeof SocialPlatformFormatCreateSchema>;

/** TypeScript type for updating a social platform format. */
export type SocialPlatformFormatUpdate = z.infer<typeof SocialPlatformFormatUpdateSchema>;
