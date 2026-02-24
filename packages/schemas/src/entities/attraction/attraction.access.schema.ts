import type { z } from 'zod';
import { AttractionSchema } from './attraction.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public listing and detail pages.
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 */
export const AttractionPublicSchema = AttractionSchema.pick({
    // Identification
    id: true,
    slug: true,
    name: true,

    // Content
    description: true,
    icon: true,
    isFeatured: true,
    isBuiltin: true,
    displayWeight: true,

    // Destination reference
    destinationId: true
});

export type AttractionPublic = z.infer<typeof AttractionPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users.
 * Used for user dashboards and authenticated interactions.
 *
 * Extends public schema with additional fields.
 */
export const AttractionProtectedSchema = AttractionSchema.pick({
    // All public fields
    id: true,
    slug: true,
    name: true,
    description: true,
    icon: true,
    isFeatured: true,
    isBuiltin: true,
    displayWeight: true,
    destinationId: true,

    // Lifecycle (for authenticated users)
    lifecycleState: true,

    // Basic audit (created/updated dates)
    createdAt: true,
    updatedAt: true
});

export type AttractionProtected = z.infer<typeof AttractionProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const AttractionAdminSchema = AttractionSchema;

export type AttractionAdmin = z.infer<typeof AttractionAdminSchema>;
