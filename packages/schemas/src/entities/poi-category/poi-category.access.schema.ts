import type { z } from 'zod';
import { PoiCategorySchema } from './poi-category.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public listing and detail pages. `nameI18n`/`icon`/`displayWeight`
 * are not sensitive data.
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 */
export const PoiCategoryPublicSchema = PoiCategorySchema.pick({
    // Identification
    id: true,
    slug: true,

    // Content
    nameI18n: true,
    icon: true,
    displayWeight: true
});

export type PoiCategoryPublic = z.infer<typeof PoiCategoryPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users.
 * Used for user dashboards and authenticated interactions.
 *
 * Extends public schema with additional fields.
 */
export const PoiCategoryProtectedSchema = PoiCategorySchema.pick({
    // All public fields
    id: true,
    slug: true,
    nameI18n: true,
    icon: true,
    displayWeight: true,

    // Lifecycle (for authenticated users)
    lifecycleState: true,

    // Basic audit (created/updated dates)
    createdAt: true,
    updatedAt: true
});

export type PoiCategoryProtected = z.infer<typeof PoiCategoryProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data (e.g.
 * `translationMeta`).
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const PoiCategoryAdminSchema = PoiCategorySchema;

export type PoiCategoryAdmin = z.infer<typeof PoiCategoryAdminSchema>;
