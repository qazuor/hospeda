import { z } from 'zod';
import { stripShapeDefaults } from '../../utils/utils.js';
import { SocialSettingSchema } from './social-setting.schema.js';

/**
 * Input schema for creating a new social setting.
 * Excludes auto-generated id and timestamp fields.
 */
export const SocialSettingCreateSchema = SocialSettingSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Input schema for updating an existing social setting.
 * All business fields are optional for partial updates.
 *
 * `stripShapeDefaults` is load-bearing: in Zod 4 `.partial()` does NOT suppress
 * a `.default()`, so without it a PATCH omitting a defaulted field parses that
 * field back in and the literal SQL `SET` overwrites it. See the guard in
 * `test/no-defaults-in-patch-schemas.guard.test.ts`.
 */
export const SocialSettingUpdateSchema = z
    .object(stripShapeDefaults(SocialSettingCreateSchema.shape))
    .partial();

/** TypeScript type for creating a social setting. */
export type SocialSettingCreate = z.infer<typeof SocialSettingCreateSchema>;

/** TypeScript type for updating a social setting. */
export type SocialSettingUpdate = z.infer<typeof SocialSettingUpdateSchema>;
