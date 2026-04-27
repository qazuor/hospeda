import type { z } from 'zod';
import { EventLocationSchema } from './eventLocation.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public listing and detail pages.
 *
 * Available fields in EventLocationSchema (post SPEC-095):
 * - Identifiers: id, slug
 * - Postal address: street, number, floor, apartment, placeName, coordinates
 * - Destination FK: destinationId (geographic context derived via cityDestination relation)
 * - Audit: createdAt, updatedAt, createdById, updatedById, deletedAt, deletedById
 * - Lifecycle: lifecycleState
 * - Admin: adminInfo
 */
export const EventLocationPublicSchema = EventLocationSchema.pick({
    // Identification
    id: true,
    slug: true,

    // Destination FK — geographic context comes from the cityDestination projection.
    destinationId: true,

    // Postal address (public-safe)
    placeName: true,
    coordinates: true
});

export type EventLocationPublic = z.infer<typeof EventLocationPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users, including full address details.
 * Used for user dashboards, owner views, and authenticated interactions.
 *
 * Extends public schema with additional fields.
 */
export const EventLocationProtectedSchema = EventLocationSchema.pick({
    // All public fields
    id: true,
    slug: true,
    destinationId: true,
    placeName: true,
    coordinates: true,

    // Full postal address (authenticated users)
    street: true,
    number: true,
    floor: true,
    apartment: true,

    // Lifecycle (for owners)
    lifecycleState: true,

    // Basic audit (created/updated dates)
    createdAt: true,
    updatedAt: true
});

export type EventLocationProtected = z.infer<typeof EventLocationProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const EventLocationAdminSchema = EventLocationSchema;

export type EventLocationAdmin = z.infer<typeof EventLocationAdminSchema>;
