import type { z } from 'zod';
import { SocialAudienceSchema } from './social-audience.schema.js';

/**
 * Input schema for creating a new social audience.
 * Excludes auto-generated audit and id fields.
 */
export const SocialAudienceCreateSchema = SocialAudienceSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/**
 * Input schema for updating an existing social audience.
 * All business fields are optional for partial updates.
 */
export const SocialAudienceUpdateSchema = SocialAudienceCreateSchema.partial();

/** TypeScript type for creating a social audience. */
export type SocialAudienceCreate = z.infer<typeof SocialAudienceCreateSchema>;

/** TypeScript type for updating a social audience. */
export type SocialAudienceUpdate = z.infer<typeof SocialAudienceUpdateSchema>;
