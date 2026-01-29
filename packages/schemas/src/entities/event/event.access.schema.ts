import type { z } from 'zod';
import { EventSchema } from './event.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public listing and detail pages.
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 */
export const EventPublicSchema = EventSchema.pick({
    // Identification
    id: true,
    slug: true,
    name: true,
    category: true,

    // Content
    summary: true,
    description: true,
    isFeatured: true,

    // Media (public safe)
    media: true,

    // Event dates and pricing
    date: true,
    pricing: true,

    // Location references (public)
    locationId: true,
    organizerId: true,

    // Visibility
    visibility: true,

    // SEO (public)
    seo: true,

    // Tags (public)
    tags: true
});

export type EventPublic = z.infer<typeof EventPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users, including contact info and ownership.
 * Used for user dashboards, author views, and authenticated interactions.
 *
 * Extends public schema with additional fields.
 */
export const EventProtectedSchema = EventSchema.pick({
    // All public fields
    id: true,
    slug: true,
    name: true,
    category: true,
    summary: true,
    description: true,
    isFeatured: true,
    media: true,
    date: true,
    pricing: true,
    locationId: true,
    organizerId: true,
    visibility: true,
    seo: true,
    tags: true,

    // Protected fields - ownership
    authorId: true,

    // Contact info (authenticated users only)
    email: true,
    phone: true,
    website: true,
    socialLinks: true,

    // Lifecycle (for authors)
    lifecycleState: true,

    // Basic audit (created/updated dates)
    createdAt: true,
    updatedAt: true
});

export type EventProtected = z.infer<typeof EventProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const EventAdminSchema = EventSchema;

export type EventAdmin = z.infer<typeof EventAdminSchema>;
