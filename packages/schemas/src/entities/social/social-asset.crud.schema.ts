import type { z } from 'zod';
import { SocialAssetSchema } from './social-asset.schema.js';

/**
 * Input schema for creating a new social asset.
 * Excludes auto-generated audit and id fields.
 */
export const SocialAssetCreateSchema = SocialAssetSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/**
 * Input schema for updating an existing social asset.
 * All business fields are optional for partial updates.
 */
export const SocialAssetUpdateSchema = SocialAssetCreateSchema.partial();

/** TypeScript type for creating a social asset. */
export type SocialAssetCreate = z.infer<typeof SocialAssetCreateSchema>;

/** TypeScript type for updating a social asset. */
export type SocialAssetUpdate = z.infer<typeof SocialAssetUpdateSchema>;
