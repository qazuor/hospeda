import { PostSponsorSchema } from '@repo/schemas';
import type { z } from 'zod';

/**
 * Admin Sponsor Schemas
 *
 * Creates a list item schema from the base PostSponsorSchema
 *
 * Contact info access:
 * - Email: sponsor.contactInfo?.personalEmail or sponsor.contactInfo?.workEmail
 * - Phone: sponsor.contactInfo?.mobilePhone, sponsor.contactInfo?.homePhone, sponsor.contactInfo?.workPhone
 * - Website: sponsor.contactInfo?.website
 */
export const SponsorListItemSchema = PostSponsorSchema.pick({
    id: true,
    name: true,
    type: true,
    description: true,
    contactInfo: true,
    lifecycleState: true,
    createdAt: true,
    updatedAt: true
});

export const SponsorListItemClientSchema = SponsorListItemSchema;

/**
 * Type for sponsor list items
 */
export type Sponsor = z.infer<typeof SponsorListItemSchema>;
