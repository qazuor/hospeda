import { z } from 'zod';
import { BaseMediaObjectSchema } from '../../common/media.schema.js';
import { ExperienceSchema } from './experience.schema.js';

/**
 * Experience Access Schemas — Three-Tier Response Projection
 *
 * Mirrors the same pick/omit discipline as `gastronomy.access.schema.ts`:
 * - **Public** — only fields safe for unauthenticated visitors.
 * - **Protected** — extends public with fields for authenticated users / owners.
 * - **Admin** — the full schema, with all fields including admin-internal data.
 */

// ============================================================================
// PUBLIC ACCESS SCHEMA
// ============================================================================

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public listing and detail pages (`/experiencias` and `/experiencias/:slug`).
 *
 * - Omits: adminInfo, ownerId, contactInfo (direct), audit internals.
 * - Includes: `hasActiveSubscription` — clients need this to guard 404 display.
 * - The `richDescription` field is re-added via `.extend()` because it follows
 *   the same entitlement-by-omission gate as in the gastronomy schema:
 *   the service strips it server-side for non-entitled owners before
 *   calling `stripWithSchema`, so schema presence is safe.
 */
export const ExperiencePublicSchema = ExperienceSchema.pick({
    // Identification
    id: true,
    slug: true,
    name: true,
    type: true,

    // Content
    summary: true,
    description: true,
    isFeatured: true,

    // I18n translations
    nameI18n: true,
    summaryI18n: true,
    descriptionI18n: true,

    // Experience-specific public fields
    priceFrom: true,
    priceUnit: true,
    isPriceOnRequest: true,

    // Subscription visibility gate
    hasActiveSubscription: true,

    // Destination reference
    destinationId: true,

    // Media (public safe)
    media: true,

    // Review aggregates (public)
    averageRating: true,
    reviewsCount: true,
    rating: true,

    // Visibility
    visibility: true,

    // SEO (public)
    seo: true,

    // Tags (public)
    tags: true,

    // Social networks (public — contact info at owner discretion)
    socialNetworks: true,

    // Opening hours (public)
    openingHours: true
}).extend({
    /**
     * Rich-text (markdown) variant of the description for entitled owners.
     * Must survive serialization so the web client can switch between rich
     * and plain rendering. The entitlement-by-omission gate runs BEFORE
     * stripWithSchema, so schema presence is safe; omission is the protection.
     */
    richDescription: z
        .string()
        .max(5000, { message: 'zodError.commerce.richDescription.max' })
        .nullish(),
    /**
     * Override picked `media` to use `BaseMediaObjectSchema` (without any
     * server-managed internal fields). Mirrors the gastronomy pattern.
     */
    media: BaseMediaObjectSchema.nullish(),
    /** ISO 8601 creation date (for "Nuevo" badge). */
    createdAt: z.union([z.string(), z.date()]).nullish(),
    /** Public owner data from users table JOIN. No sensitive fields. */
    owner: z
        .object({
            id: z.string().uuid(),
            name: z.string().nullish(),
            displayName: z.string().nullish(),
            firstName: z.string().nullish(),
            lastName: z.string().nullish(),
            image: z.string().nullish(),
            createdAt: z.union([z.string(), z.date()]).nullish()
        })
        .nullish(),
    /** Active FAQs only (lifecycleState = 'ACTIVE', deletedAt IS NULL). */
    faqs: z
        .array(
            z.object({
                id: z.string().uuid(),
                question: z.string(),
                answer: z.string(),
                category: z.string().nullable()
            })
        )
        .optional()
});

/** TypeScript type for {@link ExperiencePublicSchema}. */
export type ExperiencePublic = z.infer<typeof ExperiencePublicSchema>;

// ============================================================================
// PROTECTED ACCESS SCHEMA
// ============================================================================

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users, including ownership and contact info.
 * Used for owner dashboards and COMMERCE_OWNER views.
 */
export const ExperienceProtectedSchema = ExperienceSchema.pick({
    // All public fields
    id: true,
    slug: true,
    name: true,
    type: true,
    summary: true,
    description: true,
    isFeatured: true,
    destinationId: true,
    media: true,
    averageRating: true,
    reviewsCount: true,
    rating: true,
    visibility: true,
    seo: true,
    tags: true,
    priceFrom: true,
    priceUnit: true,
    isPriceOnRequest: true,
    hasActiveSubscription: true,
    openingHours: true,

    // Protected: ownership
    ownerId: true,

    // Contact info (nested object with email, phone, website)
    contactInfo: true,

    // Social networks
    socialNetworks: true,

    // Lifecycle (for owners — they need to know if subscription is off)
    lifecycleState: true,

    // FAQs
    faqs: true,

    // Basic audit (created/updated dates)
    createdAt: true,
    updatedAt: true
}).extend({
    /**
     * Description relaxed on the read side so DRAFT listings with short
     * descriptions can still be fetched without tripping `min(20)`.
     */
    description: z.string().max(2000, { message: 'zodError.commerce.description.max' }),
    /** Override picked `media` to exclude server-managed internal fields. */
    media: BaseMediaObjectSchema.nullish(),
    /** Rich-text description (protected visibility follows the same entitlement gate). */
    richDescription: z
        .string()
        .max(5000, { message: 'zodError.commerce.richDescription.max' })
        .nullish(),
    /**
     * Currently-associated amenity catalog IDs (junction read-back, SPEC-249).
     * Populated by the protected getById route so the owner editor can seed
     * its amenity multi-select; omitted on tiers that do not load junctions.
     */
    amenityIds: z.array(z.string().uuid()).optional(),
    /** Currently-associated feature catalog IDs (junction read-back, SPEC-249). */
    featureIds: z.array(z.string().uuid()).optional()
});

/** TypeScript type for {@link ExperienceProtectedSchema}. */
export type ExperienceProtected = z.infer<typeof ExperienceProtectedSchema>;

// ============================================================================
// ADMIN ACCESS SCHEMA
// ============================================================================

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and full management.
 * Essentially the full schema with a relaxed `description` read constraint.
 */
export const ExperienceAdminSchema = ExperienceSchema.extend({
    /**
     * Description relaxed on the read side so DRAFT listings can still be
     * fetched by the admin panel. See SPEC-143 Finding #9 (gastronomy pattern).
     */
    description: z.string().max(2000, { message: 'zodError.commerce.description.max' })
});

/** TypeScript type for {@link ExperienceAdminSchema}. */
export type ExperienceAdmin = z.infer<typeof ExperienceAdminSchema>;

/**
 * Admin LIST-row schema: the full admin entity plus the eager-loaded `owner`
 * and `destination` relation summaries (the admin list query loads them via
 * `findAllWithRelations`). The base {@link ExperienceAdminSchema} only carries
 * the scalar FKs (`ownerId` / `destinationId`); without these relation fields
 * the response strips them and the admin grid can only show raw UUIDs. Both are
 * `nullish` because a freshly admin-created listing may not have an owner yet.
 *
 * Mirrors `GastronomyAdminListItemSchema`.
 */
export const ExperienceAdminListItemSchema = ExperienceAdminSchema.extend({
    destination: z
        .object({
            id: z.string().uuid(),
            name: z.string(),
            slug: z.string()
        })
        .nullish(),
    owner: z
        .object({
            id: z.string().uuid(),
            displayName: z.string().nullish(),
            firstName: z.string().nullish(),
            lastName: z.string().nullish(),
            email: z.string().nullish()
        })
        .nullish()
});

/** TypeScript type for {@link ExperienceAdminListItemSchema}. */
export type ExperienceAdminListItem = z.infer<typeof ExperienceAdminListItemSchema>;
