import type { z } from 'zod';
import { EventOrganizerSchema } from './eventOrganizer.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public listing and detail pages.
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 */
export const EventOrganizerPublicSchema = EventOrganizerSchema.pick({
    // Identification
    id: true,
    name: true,

    // Content
    description: true,
    logo: true,

    // Social (public safe)
    website: true,
    facebook: true,
    instagram: true,
    twitter: true,

    // Lifecycle state (to show if active/archived)
    lifecycleState: true
});

export type EventOrganizerPublic = z.infer<typeof EventOrganizerPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users, including contact info.
 * Used for user dashboards and authenticated interactions.
 *
 * Extends public schema with additional fields.
 */
export const EventOrganizerProtectedSchema = EventOrganizerSchema.pick({
    // All public fields
    id: true,
    name: true,
    description: true,
    logo: true,
    website: true,
    facebook: true,
    instagram: true,
    twitter: true,
    lifecycleState: true,

    // Protected fields - contact info
    email: true,
    phone: true,

    // Basic audit (created/updated dates)
    createdAt: true,
    updatedAt: true
});

export type EventOrganizerProtected = z.infer<typeof EventOrganizerProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const EventOrganizerAdminSchema = EventOrganizerSchema;

export type EventOrganizerAdmin = z.infer<typeof EventOrganizerAdminSchema>;
