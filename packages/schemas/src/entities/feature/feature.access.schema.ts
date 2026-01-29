import type { z } from 'zod';
import { FeatureSchema } from './feature.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public listing and detail pages.
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 */
export const FeaturePublicSchema = FeatureSchema.pick({
    // Identification
    id: true,
    slug: true,
    name: true,

    // Content
    description: true,
    icon: true,

    // Visibility
    isFeatured: true,
    isBuiltin: true
});

export type FeaturePublic = z.infer<typeof FeaturePublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users, including lifecycle state.
 * Used for user dashboards, owner views, and authenticated interactions.
 *
 * Extends public schema with additional fields.
 */
export const FeatureProtectedSchema = FeatureSchema.pick({
    // All public fields
    id: true,
    slug: true,
    name: true,
    description: true,
    icon: true,
    isFeatured: true,
    isBuiltin: true,

    // Protected fields - lifecycle
    lifecycleState: true,

    // Basic audit (created/updated dates)
    createdAt: true,
    updatedAt: true
});

export type FeatureProtected = z.infer<typeof FeatureProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const FeatureAdminSchema = FeatureSchema;

export type FeatureAdmin = z.infer<typeof FeatureAdminSchema>;
