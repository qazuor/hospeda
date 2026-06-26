import type { z } from 'zod';
import { partnerSchema } from './partner.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public listing and detail pages.
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 */
export const PartnerPublicSchema = partnerSchema.pick({
    id: true,
    slug: true,
    name: true,
    description: true,
    type: true,
    tier: true,
    logoUrl: true,
    websiteUrl: true,
    lifecycleState: true,
    subscriptionStatus: true,
    startsAt: true,
    endsAt: true
});

export type PartnerPublic = z.infer<typeof PartnerPublicSchema>;
