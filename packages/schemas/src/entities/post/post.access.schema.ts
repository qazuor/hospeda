import type { z } from 'zod';
import { PostSchema } from './post.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public listing and detail pages.
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 */
export const PostPublicSchema = PostSchema.pick({
    // Identification
    id: true,
    slug: true,
    title: true,
    summary: true,
    content: true,
    category: true,

    // Author (only ID, not full details)
    authorId: true,

    // Media (public safe)
    media: true,

    // Flags
    isFeatured: true,
    isFeaturedInWebsite: true,
    isNews: true,

    // Social engagement (public)
    likes: true,
    comments: true,
    shares: true,

    // Display fields
    publishedAt: true,
    readingTimeMinutes: true,

    // Related entities (only IDs)
    relatedDestinationId: true,
    relatedAccommodationId: true,
    relatedEventId: true,

    // Visibility
    visibility: true,

    // SEO (public)
    seo: true,

    // Tags (public)
    tags: true,

    // Basic timestamps
    createdAt: true,
    updatedAt: true
});

export type PostPublic = z.infer<typeof PostPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users.
 * Used for user dashboards and authenticated interactions.
 *
 * Extends public schema with additional fields.
 */
export const PostProtectedSchema = PostSchema.pick({
    // All public fields
    id: true,
    slug: true,
    title: true,
    summary: true,
    content: true,
    category: true,
    authorId: true,
    media: true,
    isFeatured: true,
    isFeaturedInWebsite: true,
    isNews: true,
    likes: true,
    comments: true,
    shares: true,
    publishedAt: true,
    readingTimeMinutes: true,
    relatedDestinationId: true,
    relatedAccommodationId: true,
    relatedEventId: true,
    visibility: true,
    seo: true,
    tags: true,
    createdAt: true,
    updatedAt: true,

    // Protected fields - ownership and lifecycle
    lifecycleState: true,
    expiresAt: true,
    sponsorshipId: true
});

export type PostProtected = z.infer<typeof PostProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const PostAdminSchema = PostSchema;

export type PostAdmin = z.infer<typeof PostAdminSchema>;
