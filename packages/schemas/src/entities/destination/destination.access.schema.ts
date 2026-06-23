import { z } from 'zod';
import { DestinationSummarySchema } from './destination.query.schema.js';
import { DestinationSchema } from './destination.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public listing and detail pages.
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 */
export const DestinationPublicSchema = DestinationSchema.pick({
    // Identification
    id: true,
    slug: true,
    name: true,

    // Content
    summary: true,
    description: true,
    isFeatured: true,

    // SPEC-212: I18nText translations (public-safe content fields).
    // Web public pages render these to switch the visible locale to en/pt.
    // translationMeta is internal and deliberately NOT picked here.
    nameI18n: true,
    summaryI18n: true,
    descriptionI18n: true,

    // Hierarchy (public safe)
    destinationType: true,
    level: true,
    path: true,

    // Media (public safe)
    media: true,

    // Location (public safe)
    location: true,

    // Review aggregates (public)
    averageRating: true,
    reviewsCount: true,

    // Statistics
    accommodationsCount: true,

    // Visibility
    visibility: true,

    // SEO (public)
    seo: true,

    // Tags (public)
    tags: true,

    // Nested public data
    attractions: true,
    rating: true,
    faqs: true,

    // SPEC-215: seasonal climate (public-safe editorial content). The live
    // weather badge uses the dedicated /weather endpoint, so weatherCurrent is
    // intentionally NOT exposed here.
    climate: true
});

export type DestinationPublic = z.infer<typeof DestinationPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users, including hierarchy details.
 * Used for user dashboards, contributor views, and authenticated interactions.
 *
 * Extends public schema with additional fields.
 */
export const DestinationProtectedSchema = DestinationSchema.pick({
    // All public fields
    id: true,
    slug: true,
    name: true,
    summary: true,
    description: true,
    isFeatured: true,
    media: true,
    location: true,
    averageRating: true,
    reviewsCount: true,
    accommodationsCount: true,
    visibility: true,
    seo: true,
    tags: true,
    attractions: true,
    rating: true,
    faqs: true,

    // SPEC-215: seasonal climate (also surfaced to authenticated users)
    climate: true,

    // Full hierarchy (authenticated users)
    parentDestinationId: true,
    destinationType: true,
    level: true,
    path: true,
    pathIds: true,

    // Lifecycle (for owners)
    lifecycleState: true,
    moderationState: true,

    // Admin info
    adminInfo: true,

    // Reviews
    reviews: true,

    // Basic audit (created/updated dates)
    createdAt: true,
    updatedAt: true
});

export type DestinationProtected = z.infer<typeof DestinationProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const DestinationAdminSchema = DestinationSchema;

export type DestinationAdmin = z.infer<typeof DestinationAdminSchema>;

/**
 * ADMIN LIST ITEM SCHEMA
 *
 * Admin schema variant for list endpoints: the `attractions` relation is
 * projected as a compact `{ name, icon }[]` array for list display (icon is
 * the Material Symbols slug), instead of the full AttractionSummary objects.
 */
export const DestinationAdminListItemSchema = DestinationAdminSchema.omit({
    attractions: true
}).extend({
    attractions: z
        .array(
            z.object({
                name: z.string(),
                icon: z.string().nullable().optional()
            })
        )
        .optional()
});

export type DestinationAdminListItem = z.infer<typeof DestinationAdminListItemSchema>;

// ============================================================================
// SUMMARY PUBLIC SCHEMA (SPEC-210)
// ============================================================================

/**
 * Destination Summary Public Schema — explicit public-safe projection for the
 * GET /api/v1/public/destinations/:id/summary endpoint (SPEC-210).
 *
 * DestinationSummarySchema is already a clean display projection (built with
 * .pick() from DestinationSchema) and contains NO audit or internal fields.
 * This named alias makes the public contract explicit and ensures the route's
 * responseSchema is unambiguously tied to a public-tier schema.
 *
 * Included fields (all are display / navigation safe):
 *   id, slug, name, summary, media, location, isFeatured,
 *   accommodationsCount, destinationType, level, path,
 *   reviewsCount, averageRating.
 *
 * Excluded fields (NOT present in the base projection, so not a risk):
 *   All audit fields (createdAt, updatedAt, createdById, updatedById,
 *   deletedAt, deletedById), lifecycleState, moderationState, adminInfo,
 *   translationMeta, pathIds, parentDestinationId, description, tags,
 *   attractions, reviews, climate, weatherCurrent, faqs, seo, visibility.
 */
export const DestinationSummaryPublicSchema = DestinationSummarySchema;

export type DestinationSummaryPublic = z.infer<typeof DestinationSummaryPublicSchema>;
