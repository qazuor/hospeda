import type { z } from 'zod';
import { SocialPostFooterSchema } from './social-post-footer.schema.js';

/**
 * Input schema for creating a new social post footer.
 * Excludes auto-generated audit and id fields.
 *
 * `slug` is optional — the service auto-generates it from `name` in `_beforeCreate`
 * when not supplied. Any client-supplied slug is preserved.
 */
export const SocialPostFooterCreateSchema = SocialPostFooterSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).partial({ slug: true });

/**
 * Input schema for updating an existing social post footer.
 * All business fields are optional for partial updates.
 */
export const SocialPostFooterUpdateSchema = SocialPostFooterCreateSchema.partial();

/** TypeScript type for creating a social post footer. */
export type SocialPostFooterCreate = z.infer<typeof SocialPostFooterCreateSchema>;

/** TypeScript type for updating a social post footer. */
export type SocialPostFooterUpdate = z.infer<typeof SocialPostFooterUpdateSchema>;
