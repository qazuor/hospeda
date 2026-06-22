import type { z } from 'zod';
import { SocialCampaignSchema } from './social-campaign.schema.js';

/**
 * Input schema for creating a new social campaign.
 * Excludes auto-generated audit and id fields.
 *
 * `slug` is optional — the service auto-generates it from `name` in `_beforeCreate`
 * when not supplied. Any client-supplied slug is preserved.
 */
export const SocialCampaignCreateSchema = SocialCampaignSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).partial({ slug: true });

/**
 * Input schema for updating an existing social campaign.
 * All business fields are optional for partial updates.
 */
export const SocialCampaignUpdateSchema = SocialCampaignCreateSchema.partial();

/** TypeScript type for creating a social campaign. */
export type SocialCampaignCreate = z.infer<typeof SocialCampaignCreateSchema>;

/** TypeScript type for updating a social campaign. */
export type SocialCampaignUpdate = z.infer<typeof SocialCampaignUpdateSchema>;
