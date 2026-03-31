import type { z } from 'zod';
import { PostSponsorSchema } from './postSponsor.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public display of sponsor information alongside posts.
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 * Excludes contact details, social networks, lifecycle, and admin info.
 */
export const PostSponsorPublicSchema = PostSponsorSchema.pick({
    // Identification
    id: true,

    // Sponsor branding
    name: true,
    type: true,
    description: true,
    logo: true
});

export type PostSponsorPublic = z.infer<typeof PostSponsorPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users, including contact and social info.
 * Used for authenticated interactions with sponsor entities.
 *
 * Extends public fields with contact, social, and lifecycle data.
 */
export const PostSponsorProtectedSchema = PostSponsorSchema.pick({
    // All public fields
    id: true,
    name: true,
    type: true,
    description: true,
    logo: true,

    // Contact and social (for authenticated users)
    contactInfo: true,
    socialNetworks: true,

    // Lifecycle
    lifecycleState: true,

    // Audit (basic timestamps)
    createdAt: true,
    updatedAt: true
});

export type PostSponsorProtected = z.infer<typeof PostSponsorProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const PostSponsorAdminSchema = PostSponsorSchema;

export type PostSponsorAdmin = z.infer<typeof PostSponsorAdminSchema>;
