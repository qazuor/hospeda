import type { z } from 'zod';
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
 */
export const SocialPlatformFormatUpdateSchema = SocialPlatformFormatCreateSchema.partial();

/** TypeScript type for creating a social platform format. */
export type SocialPlatformFormatCreate = z.infer<typeof SocialPlatformFormatCreateSchema>;

/** TypeScript type for updating a social platform format. */
export type SocialPlatformFormatUpdate = z.infer<typeof SocialPlatformFormatUpdateSchema>;
