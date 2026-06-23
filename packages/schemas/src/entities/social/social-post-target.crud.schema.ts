import type { z } from 'zod';
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
 */
export const SocialPostTargetUpdateSchema = SocialPostTargetCreateSchema.partial();

/** TypeScript type for creating a social post target. */
export type SocialPostTargetCreate = z.infer<typeof SocialPostTargetCreateSchema>;

/** TypeScript type for updating a social post target. */
export type SocialPostTargetUpdate = z.infer<typeof SocialPostTargetUpdateSchema>;
