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

    // Content
    summary: true,
    description: true,
    isFeatured: true,

    // Hierarchy (public safe)
    destinationType: true,
    level: true,
    path: true,

    // Media (public safe)
    media: true,

    // Location (public safe)
    location: true,

    // Review aggregates (public)
    averageRating: true,
    reviewsCount: true,

    // Statistics
    accommodationsCount: true,

    // Visibility
    visibility: true,

    // SEO (public)
    seo: true,

    // Tags (public)
    tags: true,

    // Nested public data
    attractions: true,
    rating: true
});

export type DestinationPublic = z.infer<typeof DestinationPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users, including hierarchy details.
 * Used for user dashboards, contributor views, and authenticated interactions.
 *
 * Extends public schema with additional fields.
 */
export const DestinationProtectedSchema = DestinationSchema.pick({
    // All public fields
    id: true,
    slug: true,
    name: true,
    summary: true,
    description: true,
    isFeatured: true,
    media: true,
    location: true,
    averageRating: true,
    reviewsCount: true,
    accommodationsCount: true,
    visibility: true,
    seo: true,
    tags: true,
    attractions: true,
    rating: true,

    // Full hierarchy (authenticated users)
    parentDestinationId: true,
    destinationType: true,
    level: true,
    path: true,
    pathIds: true,

    // Lifecycle (for owners)
    lifecycleState: true,
    moderationState: true,

    // Admin info
    adminInfo: true,

    // Reviews
    reviews: true,

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
