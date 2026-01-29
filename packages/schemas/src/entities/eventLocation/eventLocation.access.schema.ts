import type { z } from 'zod';
import { EventLocationSchema } from './eventLocation.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public listing and detail pages.
 *
 * Available fields in EventLocationSchema:
 * - From BaseLocationSchema: state, zipCode, country, coordinates
 * - Direct: id, slug, street, number, floor, apartment, neighborhood, city, department, placeName
 * - From BaseAuditFields: createdAt, updatedAt, createdById, updatedById, deletedAt, deletedById
 * - From BaseLifecycleFields: lifecycleState
 * - From BaseAdminFields: adminInfo
 */
export const EventLocationPublicSchema = EventLocationSchema.pick({
    // Identification
    id: true,
    slug: true,

    // Location (public safe)
    city: true,
    state: true,
    country: true,
    neighborhood: true,
    placeName: true,

    // Coordinates (public safe for maps)
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
    city: true,
    state: true,
    country: true,
    neighborhood: true,
    placeName: true,
    coordinates: true,

    // Full address (authenticated users)
    street: true,
    number: true,
    floor: true,
    apartment: true,
    department: true,
    zipCode: true,

    // Lifecycle (for owners)
    lifecycleState: true,

    // Basic audit (created/updated dates)
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true
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
