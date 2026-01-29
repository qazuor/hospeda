import type { z } from 'zod';
import { AmenitySchema } from './amenity.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public listing and detail pages.
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 */
export const AmenityPublicSchema = AmenitySchema.pick({
    // Identification
    id: true,
    slug: true,
    name: true,

    // Content
    description: true,
    icon: true,

    // Type
    type: true,

    // Display
    isFeatured: true
});

export type AmenityPublic = z.infer<typeof AmenityPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users.
 * Used for user dashboards and authenticated interactions.
 *
 * Extends public schema with additional fields.
 */
export const AmenityProtectedSchema = AmenitySchema.pick({
    // All public fields
    id: true,
    slug: true,
    name: true,
    description: true,
    icon: true,
    type: true,
    isFeatured: true,

    // Protected fields
    isBuiltin: true,

    // Lifecycle
    lifecycleState: true,

    // Basic audit (created/updated dates)
    createdAt: true,
    updatedAt: true
});

export type AmenityProtected = z.infer<typeof AmenityProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const AmenityAdminSchema = AmenitySchema;

export type AmenityAdmin = z.infer<typeof AmenityAdminSchema>;
