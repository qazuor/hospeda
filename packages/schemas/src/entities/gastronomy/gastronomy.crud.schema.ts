import { z } from 'zod';
import { DestinationIdSchema, UserIdSchema } from '../../common/id.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';
import { GastronomySchema } from './gastronomy.schema.js';

/**
 * Gastronomy CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for gastronomy listings:
 * - Admin create (full identity control)
 * - Owner update (operational fields only — no identity manipulation)
 * - Patch / partial update (alias of owner update for clarity)
 * - Delete (soft by default, optional hard delete)
 * - Restore
 */

// ============================================================================
// ADMIN CREATE SCHEMAS
// ============================================================================

/**
 * Schema for creating a new gastronomy listing (admin path).
 *
 * Admins control identity fields (name, slug, type, destinationId) and can
 * optionally assign an owner on creation.
 *
 * ### Junction sync fields (write-only)
 *
 * - `amenityIds` — Optional list of amenity UUIDs to associate with the new
 *   listing. When provided, the service inserts rows in the junction table
 *   transactionally. Omitting is a no-op.
 * - `featureIds` — Same contract for the feature junction table.
 *
 * These are **write-only inputs** and do not appear in read responses.
 */
export const GastronomyAdminCreateInputSchema = GastronomySchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).extend({
    /** Optional slug override; auto-generated from name when absent. */
    slug: z
        .string()
        .min(2, { message: 'zodError.commerce.slug.min' })
        .max(100, { message: 'zodError.commerce.slug.max' })
        .optional(),
    /** Optional owner UUID; admin may assign another user as owner on creation. */
    ownerId: UserIdSchema.optional(),
    /** Optional destination UUID for the listing. */
    destinationId: DestinationIdSchema.optional(),
    /**
     * Optional list of amenity UUIDs to associate on create (write-only).
     * Syncs the junction table transactionally alongside the gastronomy row.
     * Undefined → no junction rows written.
     */
    amenityIds: z
        .array(z.string().uuid({ message: 'zodError.gastronomy.amenityIds.invalidUuid' }))
        .optional(),
    /**
     * Optional list of feature UUIDs to associate on create (write-only).
     * Syncs the junction table transactionally alongside the gastronomy row.
     * Undefined → no junction rows written.
     */
    featureIds: z
        .array(z.string().uuid({ message: 'zodError.gastronomy.featureIds.invalidUuid' }))
        .optional()
});

/** TypeScript type for {@link GastronomyAdminCreateInputSchema}. */
export type GastronomyAdminCreateInput = z.infer<typeof GastronomyAdminCreateInputSchema>;

/**
 * Schema for the admin create response.
 * Returns the complete gastronomy object.
 */
export const GastronomyAdminCreateOutputSchema = GastronomySchema;

/** TypeScript type for {@link GastronomyAdminCreateOutputSchema}. */
export type GastronomyAdminCreateOutput = z.infer<typeof GastronomyAdminCreateOutputSchema>;

// ============================================================================
// OWNER UPDATE SCHEMAS (operational only)
// ============================================================================

/**
 * Schema for owner-managed operational updates to a gastronomy listing.
 *
 * Deliberately restricted to the fields a COMMERCE_OWNER may edit via the
 * single `COMMERCE_EDIT_OWN` permission (SPEC-253 D2=b). Identity fields that
 * remain admin-only (`name`, `slug`, `description`, `destinationId`) are
 * **intentionally absent** — unknown keys are stripped (Zod's default behaviour)
 * so forged identity fields in the payload are silently dropped before reaching
 * the service layer.
 *
 * Per SPEC-253 §3, the following fields are now owner-editable:
 * - `type`             — listing sub-category (SPEC-253 D1: YES; removed from
 *                        identity-strip guard, AC-5)
 * - `summary`          — short marketing summary
 * - `nameI18n`         — localized name translations (SPEC-212 pattern)
 * - `summaryI18n`      — localized summary translations
 * - `descriptionI18n`  — localized description translations
 * - `richDescriptionI18n` — localized rich-text translations
 *
 * Previously-permitted operational sections (unchanged):
 * - `openingHours`   — schedule (gated by `COMMERCE_EDIT_OWN`)
 * - `contactInfo`    — contact details (gated by `COMMERCE_EDIT_OWN`)
 * - `socialNetworks` — social links (gated by `COMMERCE_EDIT_OWN`)
 * - `media`          — featured image, gallery, videos (gated by `COMMERCE_EDIT_OWN`)
 * - `menuUrl`        — online menu URL (gated by `COMMERCE_EDIT_OWN`)
 * - `priceRange`     — price-range tier (gated by `COMMERCE_EDIT_OWN`)
 * - `richDescription`— rich-text description (gated by `COMMERCE_EDIT_OWN`)
 * - `amenityIds`     — junction sync (gated by `COMMERCE_EDIT_OWN`)
 * - `featureIds`     — junction sync (gated by `COMMERCE_EDIT_OWN`)
 *
 * NOT permitted for owner (admin-only):
 * - `name`, `slug` (legal identity)
 * - `description` (base description — owner edits the i18n variants)
 * - `destinationId`, lifecycle/visibility/moderation/`isFeatured`/`ownerId`
 * - `priceFrom`, `priceUnit` (gastronomy uses `priceRange` + `menuUrl` instead)
 */
export const GastronomyOwnerUpdateInputSchema = GastronomySchema.pick({
    type: true,
    summary: true,
    openingHours: true,
    contactInfo: true,
    socialNetworks: true,
    media: true,
    menuUrl: true,
    priceRange: true,
    richDescription: true,
    nameI18n: true,
    summaryI18n: true,
    descriptionI18n: true,
    richDescriptionI18n: true
})
    .partial()
    .extend({
        /**
         * Optional amenity UUID list for junction sync on update (write-only).
         * undefined → no change | [] → clear all | [ids] → sync to exact set.
         */
        amenityIds: z
            .array(z.string().uuid({ message: 'zodError.gastronomy.amenityIds.invalidUuid' }))
            .optional(),
        /**
         * Optional feature UUID list for junction sync on update (write-only).
         * undefined → no change | [] → clear all | [ids] → sync to exact set.
         */
        featureIds: z
            .array(z.string().uuid({ message: 'zodError.gastronomy.featureIds.invalidUuid' }))
            .optional()
    });

/** TypeScript type for {@link GastronomyOwnerUpdateInputSchema}. */
export type GastronomyOwnerUpdateInput = z.infer<typeof GastronomyOwnerUpdateInputSchema>;

// ============================================================================
// GENERAL UPDATE SCHEMAS (admin path)
// ============================================================================

/**
 * Schema for admin full / partial updates to a gastronomy listing (PATCH).
 *
 * All entity fields are partial so the admin may update any subset.
 * Uses `stripShapeDefaults` (same as accommodation) to prevent Zod 4's
 * `.partial()` from injecting defaults for absent keys.
 *
 * ### Why server-managed fields are explicitly omitted
 *
 * Even though `stripShapeDefaults` removes `.default()` wrappers, fields like
 * `ownerId`, `reviewsCount`, and `averageRating` must never arrive at the service
 * from a generic PATCH body:
 *
 * - `ownerId` — immutable after creation; ownership change requires a dedicated
 *   admin action, not a generic update payload.
 * - `reviewsCount` / `averageRating` — server-computed aggregates updated by
 *   the review subsystem, not by the admin CRUD path.
 *
 * Explicitly omitting them here enforces that constraint at the schema boundary,
 * matching the spirit of accommodation's omit of `ownerSuspended`/`planRestricted`.
 */
export const GastronomyUpdateInputSchema = z
    .object(
        // Zod 4's `.partial()` does NOT strip `.default()` (unlike Zod 3): without
        // this, a PATCH like `{ lifecycleState: 'ACTIVE' }` would arrive at the
        // service carrying injected defaults (`visibility:'PUBLIC'`,
        // `moderationState:'PENDING'`, `isFeatured:false`, review stats, etc.),
        // silently overwriting server state. Stripping the top-level defaults
        // restores correct "absent key = no change" PATCH semantics. See `stripShapeDefaults`.
        stripShapeDefaults(
            GastronomySchema.omit({
                id: true,
                createdAt: true,
                updatedAt: true,
                createdById: true,
                updatedById: true,
                deletedAt: true,
                deletedById: true,
                // Server-managed: ownership change requires a dedicated admin action,
                // not a generic PATCH body (mirrors accommodation's ownerSuspended omit).
                ownerId: true,
                // Server-computed aggregates — updated by the review subsystem only.
                reviewsCount: true,
                averageRating: true
            }).shape
        )
    )
    .partial()
    .extend({
        /**
         * Optional amenity UUID list for junction sync on update (write-only).
         * undefined → no change | [] → clear all | [ids] → sync to exact set.
         */
        amenityIds: z
            .array(z.string().uuid({ message: 'zodError.gastronomy.amenityIds.invalidUuid' }))
            .optional(),
        /**
         * Optional feature UUID list for junction sync on update (write-only).
         * undefined → no change | [] → clear all | [ids] → sync to exact set.
         */
        featureIds: z
            .array(z.string().uuid({ message: 'zodError.gastronomy.featureIds.invalidUuid' }))
            .optional()
    });

/** TypeScript type for {@link GastronomyUpdateInputSchema}. */
export type GastronomyUpdateInput = z.infer<typeof GastronomyUpdateInputSchema>;

/**
 * Alias of {@link GastronomyUpdateInputSchema} for explicit PATCH semantics.
 */
export const GastronomyPatchInputSchema = GastronomyUpdateInputSchema;

/** TypeScript type for {@link GastronomyPatchInputSchema}. */
export type GastronomyPatchInput = z.infer<typeof GastronomyPatchInputSchema>;

/**
 * Schema for gastronomy update response.
 * Returns the complete updated gastronomy object.
 */
export const GastronomyUpdateOutputSchema = GastronomySchema;

/** TypeScript type for {@link GastronomyUpdateOutputSchema}. */
export type GastronomyUpdateOutput = z.infer<typeof GastronomyUpdateOutputSchema>;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for gastronomy deletion input.
 * Requires ID and optional force flag for hard delete.
 */
export const GastronomyDeleteInputSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    // Use `.default(false)` only — `.optional().default(false)` is a dead chain:
    // `.default()` already supplies the value when the key is absent; the outer
    // `.optional()` is redundant and confusing. Matches accommodation's pattern.
    force: z.boolean({ message: 'zodError.gastronomy.delete.force.invalidType' }).default(false)
});

/** TypeScript type for {@link GastronomyDeleteInputSchema}. */
export type GastronomyDeleteInput = z.infer<typeof GastronomyDeleteInputSchema>;

/**
 * Schema for gastronomy deletion response.
 * Returns success status and deletion timestamp.
 */
export const GastronomyDeleteOutputSchema = z.object({
    success: z.boolean({ message: 'zodError.gastronomy.delete.success.required' }).default(true),
    deletedAt: z.date({ message: 'zodError.gastronomy.delete.deletedAt.invalidType' }).optional()
});

/** TypeScript type for {@link GastronomyDeleteOutputSchema}. */
export type GastronomyDeleteOutput = z.infer<typeof GastronomyDeleteOutputSchema>;

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for gastronomy restoration input.
 * Requires only the gastronomy ID.
 */
export const GastronomyRestoreInputSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});

/** TypeScript type for {@link GastronomyRestoreInputSchema}. */
export type GastronomyRestoreInput = z.infer<typeof GastronomyRestoreInputSchema>;

/**
 * Schema for gastronomy restoration response.
 * Returns the complete restored gastronomy object.
 */
export const GastronomyRestoreOutputSchema = GastronomySchema;

/** TypeScript type for {@link GastronomyRestoreOutputSchema}. */
export type GastronomyRestoreOutput = z.infer<typeof GastronomyRestoreOutputSchema>;
