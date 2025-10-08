import { PostSponsorSchema } from '@repo/schemas';
import type { ClientTypeEnum, ContactInfo, LifecycleStatusEnum } from '@repo/schemas';
import { z } from 'zod';

/**
 * Schema for sponsor (PostSponsor) list items in admin
 * Creates a list item schema from the base PostSponsorSchema
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
}).extend({
    // Admin-specific field mapping
    contact: z
        .object({
            email: z.string().email().nullable().optional(),
            phone: z.string().nullable().optional(),
            website: z.string().url().nullable().optional()
        })
        .nullable()
        .optional()
});

export const SponsorListItemClientSchema = SponsorListItemSchema;

// Define explicit type for Zod compatibility with proper types
export type Sponsor = {
    id: string;
    name: string;
    type: ClientTypeEnum;
    description: string;
    contactInfo?: ContactInfo;
    lifecycleState: LifecycleStatusEnum;
    createdAt: Date;
    updatedAt: Date;
    contact?: {
        email?: string | null;
        phone?: string | null;
        website?: string | null;
    } | null;
};
