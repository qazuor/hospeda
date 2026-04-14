import type { z } from 'zod';
import {
    EventLocationAdminSchema,
    EventLocationProtectedSchema,
    EventLocationPublicSchema
} from '../eventLocation/eventLocation.access.schema.js';
import {
    EventOrganizerAdminSchema,
    EventOrganizerProtectedSchema,
    EventOrganizerPublicSchema
} from '../eventOrganizer/eventOrganizer.access.schema.js';
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
}).extend({
    // Relation fields — optional so safeParse never strips hydrated data
    organizer: EventOrganizerPublicSchema.optional(),
    location: EventLocationPublicSchema.optional()
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

    // Contact info (nested object with email, phone, website)
    contactInfo: true,

    // Lifecycle (for authors)
    lifecycleState: true,

    // Basic audit (created/updated dates)
    createdAt: true,
    updatedAt: true
}).extend({
    // Relation fields — optional so safeParse never strips hydrated data
    organizer: EventOrganizerProtectedSchema.optional(),
    location: EventLocationProtectedSchema.optional()
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
export const EventAdminSchema = EventSchema.extend({
    // Relation fields — optional so safeParse never strips hydrated data
    organizer: EventOrganizerAdminSchema.optional(),
    location: EventLocationAdminSchema.optional()
});

export type EventAdmin = z.infer<typeof EventAdminSchema>;
