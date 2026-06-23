import type { z } from 'zod';
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
 * Input schema for updating an existing social platform config row.
 * All business fields are optional for partial updates.
 */
export const SocialPlatformUpdateSchema = SocialPlatformCreateSchema.partial();

/** TypeScript type for creating a social platform. */
export type SocialPlatformCreate = z.infer<typeof SocialPlatformCreateSchema>;

/** TypeScript type for updating a social platform. */
export type SocialPlatformUpdate = z.infer<typeof SocialPlatformUpdateSchema>;
