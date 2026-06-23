import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';

/**
 * SocialCampaign entity schema.
 * Groups social posts under a named content campaign
 * (e.g. "Institucional Hospeda").
 * Supports soft-delete and full audit FKs.
 */
export const SocialCampaignSchema = z.object({
    id: z.string().uuid({ message: 'zodError.socialCampaign.id.uuid' }),
    name: z.string().min(1, { message: 'zodError.socialCampaign.name.required' }),
    slug: z.string().min(1, { message: 'zodError.socialCampaign.slug.required' }),
    description: z.string().optional(),
    active: z.boolean().default(true),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    ...BaseAuditFields
});

/** TypeScript type inferred from {@link SocialCampaignSchema}. */
export type SocialCampaign = z.infer<typeof SocialCampaignSchema>;
