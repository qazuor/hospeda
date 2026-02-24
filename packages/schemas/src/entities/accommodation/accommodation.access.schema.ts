import type { z } from 'zod';
import { AccommodationSchema } from './accommodation.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public listing and detail pages.
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 */
export const AccommodationPublicSchema = AccommodationSchema.pick({
    // Identification
    id: true,
    slug: true,
    name: true,
    type: true,

    // Content
    summary: true,
    description: true,
    isFeatured: true,

    // Destination reference
    destinationId: true,

    // Media (public safe)
    media: true,

    // Location (nested object with state, country, coordinates)
    location: true,

    // Review aggregates (public)
    averageRating: true,
    reviewsCount: true,

    // Visibility
    visibility: true,

    // SEO (public)
    seo: true,

    // Price (public)
    price: true,

    // Tags (public)
    tags: true,

    // Extra Info (public)
    extraInfo: true
});

export type AccommodationPublic = z.infer<typeof AccommodationPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users, including contact info and ownership.
 * Used for user dashboards, owner views, and authenticated interactions.
 *
 * Extends public schema with additional fields.
 */
export const AccommodationProtectedSchema = AccommodationSchema.pick({
    // All public fields
    id: true,
    slug: true,
    name: true,
    type: true,
    summary: true,
    description: true,
    isFeatured: true,
    destinationId: true,
    media: true,
    location: true,
    averageRating: true,
    reviewsCount: true,
    visibility: true,
    seo: true,
    price: true,
    tags: true,
    extraInfo: true,

    // Protected fields - ownership
    ownerId: true,

    // Contact info (nested object with email, phone, website)
    contactInfo: true,

    // Lifecycle (for owners)
    lifecycleState: true,

    // FAQs
    faqs: true,

    // Basic audit (created/updated dates)
    createdAt: true,
    updatedAt: true
});

export type AccommodationProtected = z.infer<typeof AccommodationProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const AccommodationAdminSchema = AccommodationSchema;

export type AccommodationAdmin = z.infer<typeof AccommodationAdminSchema>;
