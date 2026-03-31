import type { z } from 'zod';
import { TagSchema } from './tag.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public tag display (filters, badges, labels).
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 */
export const TagPublicSchema = TagSchema.pick({
    // Identification
    id: true,
    name: true,
    slug: true,

    // Display properties
    color: true,
    icon: true
});

export type TagPublic = z.infer<typeof TagPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users, including lifecycle and notes.
 * Used for authenticated tag management and contributor views.
 *
 * Extends public fields with lifecycle and audit data.
 */
export const TagProtectedSchema = TagSchema.pick({
    // All public fields
    id: true,
    name: true,
    slug: true,
    color: true,
    icon: true,

    // Lifecycle
    lifecycleState: true,

    // Additional metadata
    notes: true,

    // Audit (basic timestamps)
    createdAt: true,
    updatedAt: true
});

export type TagProtected = z.infer<typeof TagProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const TagAdminSchema = TagSchema;

export type TagAdmin = z.infer<typeof TagAdminSchema>;
