import { partnerSchema } from '@repo/schemas';
import type { z } from 'zod';

/**
 * Admin Partner Schemas
 *
 * Creates a list item schema from the base partnerSchema
 */
export const PartnerListItemSchema = partnerSchema.pick({
    id: true,
    slug: true,
    name: true,
    type: true,
    tier: true,
    logoUrl: true,
    websiteUrl: true,
    description: true,
    subscriptionStatus: true,
    lifecycleState: true,
    analytics: true,
    startsAt: true,
    endsAt: true,
    createdAt: true,
    updatedAt: true
});

export const PartnerListItemClientSchema = PartnerListItemSchema;

/**
 * Type for partner list items
 */
export type Partner = z.infer<typeof PartnerListItemSchema>;
