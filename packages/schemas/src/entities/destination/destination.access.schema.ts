import type { z } from 'zod';
import { DestinationSchema } from './destination.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public listing and detail pages.
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 */
export const DestinationPublicSchema = DestinationSchema.pick({
    // Identification
    id: true,
    slug: true,
    name: true,
    type: true,

    // Content
    summary: true,
    description: true,
    isFeatured: true,

    // Parent reference
    parentId: true,

    // Media (public safe)
    media: true,

    // Location (public safe)
    city: true,
    state: true,
    country: true,

    // Review aggregates (public)
    averageRating: true,
    ratingCount: true,

    // Visibility
    visibility: true,

    // SEO (public)
    seo: true,

    // Tags (public)
    tags: true,

    // Extra Info (public)
    extraInfo: true
});

export type DestinationPublic = z.infer<typeof DestinationPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users, including ownership.
 * Used for user dashboards, contributor views, and authenticated interactions.
 *
 * Extends public schema with additional fields.
 */
export const DestinationProtectedSchema = DestinationSchema.pick({
    // All public fields
    id: true,
    slug: true,
    name: true,
    type: true,
    summary: true,
    description: true,
    isFeatured: true,
    parentId: true,
    media: true,
    city: true,
    state: true,
    country: true,
    averageRating: true,
    ratingCount: true,
    visibility: true,
    seo: true,
    tags: true,
    extraInfo: true,

    // Protected fields - ownership
    ownerId: true,

    // Contact info (authenticated users only)
    email: true,
    phone: true,
    website: true,
    socialLinks: true,

    // Full location (authenticated users)
    zipCode: true,
    latitude: true,
    longitude: true,

    // Lifecycle (for owners)
    lifecycleState: true,

    // FAQs
    faqs: true,

    // Basic audit (created/updated dates)
    createdAt: true,
    updatedAt: true
});

export type DestinationProtected = z.infer<typeof DestinationProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const DestinationAdminSchema = DestinationSchema;

export type DestinationAdmin = z.infer<typeof DestinationAdminSchema>;
