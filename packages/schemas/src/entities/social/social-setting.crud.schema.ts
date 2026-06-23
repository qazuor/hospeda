import type { z } from 'zod';
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
 */
export const SocialSettingUpdateSchema = SocialSettingCreateSchema.partial();

/** TypeScript type for creating a social setting. */
export type SocialSettingCreate = z.infer<typeof SocialSettingCreateSchema>;

/** TypeScript type for updating a social setting. */
export type SocialSettingUpdate = z.infer<typeof SocialSettingUpdateSchema>;
