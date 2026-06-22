import { z } from 'zod';
import { DestinationIdSchema, UserIdSchema } from '../../common/id.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';
import { ExperienceSchema } from './experience.schema.js';

/**
 * Experience CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for experience listings:
 * - Admin create (full identity control)
 * - Owner update (operational fields only — no identity manipulation)
 * - Patch / partial update (alias of admin update for clarity)
 * - Delete (soft by default, optional hard delete)
 * - Restore
 */

// ============================================================================
// ADMIN CREATE SCHEMAS
// ============================================================================

/**
 * Schema for creating a new experience listing (admin path).
 *
 * Admins control identity fields (name, slug, type, priceFrom, priceUnit,
 * destinationId) and can optionally assign an owner on creation.
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
export const ExperienceAdminCreateInputSchema = ExperienceSchema.omit({
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
     * Syncs the junction table transactionally alongside the experience row.
     * Undefined → no junction rows written.
     */
    amenityIds: z
        .array(z.string().uuid({ message: 'zodError.experience.amenityIds.invalidUuid' }))
        .optional(),
    /**
     * Optional list of feature UUIDs to associate on create (write-only).
     * Syncs the junction table transactionally alongside the experience row.
     * Undefined → no junction rows written.
     */
    featureIds: z
        .array(z.string().uuid({ message: 'zodError.experience.featureIds.invalidUuid' }))
        .optional()
});

/** TypeScript type for {@link ExperienceAdminCreateInputSchema}. */
export type ExperienceAdminCreateInput = z.infer<typeof ExperienceAdminCreateInputSchema>;

/**
 * Schema for the admin create response.
 * Returns the complete experience object.
 */
export const ExperienceAdminCreateOutputSchema = ExperienceSchema;

/** TypeScript type for {@link ExperienceAdminCreateOutputSchema}. */
export type ExperienceAdminCreateOutput = z.infer<typeof ExperienceAdminCreateOutputSchema>;

// ============================================================================
// OWNER UPDATE SCHEMAS (operational only)
// ============================================================================

/**
 * Schema for owner-managed operational updates to an experience listing.
 *
 * Deliberately restricted to the sections a COMMERCE_OWNER may edit via
 * their own scoped permissions. Identity fields (name, slug, type, priceFrom,
 * priceUnit, destinationId) are **intentionally absent** — unknown keys are
 * stripped (Zod's default behaviour) so forged identity fields in the payload
 * are silently dropped before reaching the service layer.
 *
 * Permitted operational sections (AC-4.1 from SPEC-240):
 * - `openingHours`    — schedule (gated by `COMMERCE_EDIT_OWN`, SPEC-253 D2=b)
 * - `contactInfo`     — contact details (gated by `COMMERCE_EDIT_OWN`)
 * - `socialNetworks`  — social links (gated by `COMMERCE_EDIT_OWN`)
 * - `media`           — featured image, gallery, videos (gated by `COMMERCE_EDIT_OWN`)
 * - `isPriceOnRequest`— price-on-request toggle (gated by `COMMERCE_EDIT_OWN`)
 * - `richDescription` — rich-text description (gated by `COMMERCE_EDIT_OWN`)
 * - `amenityIds`      — junction sync (gated by `COMMERCE_EDIT_OWN`)
 * - `featureIds`      — junction sync (gated by `COMMERCE_EDIT_OWN`)
 *
 * NOT permitted for owner (admin-only):
 * - `name`, `slug` (legal identity)
 * - `type`, `priceFrom`, `priceUnit`, `destinationId` (core classification)
 * - `hasActiveSubscription` (subscription lifecycle, admin-only toggle)
 */
export const ExperienceOwnerUpdateInputSchema = ExperienceSchema.pick({
    openingHours: true,
    contactInfo: true,
    socialNetworks: true,
    media: true,
    isPriceOnRequest: true,
    richDescription: true
})
    .partial()
    .extend({
        /**
         * Optional amenity UUID list for junction sync on update (write-only).
         * undefined → no change | [] → clear all | [ids] → sync to exact set.
         */
        amenityIds: z
            .array(z.string().uuid({ message: 'zodError.experience.amenityIds.invalidUuid' }))
            .optional(),
        /**
         * Optional feature UUID list for junction sync on update (write-only).
         * undefined → no change | [] → clear all | [ids] → sync to exact set.
         */
        featureIds: z
            .array(z.string().uuid({ message: 'zodError.experience.featureIds.invalidUuid' }))
            .optional()
    });

/** TypeScript type for {@link ExperienceOwnerUpdateInputSchema}. */
export type ExperienceOwnerUpdateInput = z.infer<typeof ExperienceOwnerUpdateInputSchema>;

// ============================================================================
// GENERAL UPDATE SCHEMAS (admin path)
// ============================================================================

/**
 * Schema for admin full / partial updates to an experience listing (PATCH).
 *
 * All entity fields are partial so the admin may update any subset.
 * Uses `stripShapeDefaults` (same as gastronomy) to prevent Zod 4's
 * `.partial()` from injecting defaults for absent keys.
 *
 * ### Why server-managed fields are explicitly omitted
 *
 * Even though `stripShapeDefaults` removes `.default()` wrappers, fields like
 * `ownerId`, `reviewsCount`, `averageRating`, and `hasActiveSubscription` must
 * never arrive at the service from a generic PATCH body:
 *
 * - `ownerId` — immutable after creation; ownership change requires a dedicated
 *   admin action, not a generic update payload.
 * - `reviewsCount` / `averageRating` — server-computed aggregates updated by
 *   the review subsystem, not by the admin CRUD path.
 * - `hasActiveSubscription` — driven by the subscription lifecycle hook; toggled
 *   via the dedicated `toggleSubscription` admin action, not a generic PATCH.
 */
export const ExperienceUpdateInputSchema = z
    .object(
        // Zod 4's `.partial()` does NOT strip `.default()` (unlike Zod 3): without
        // this, a PATCH like `{ lifecycleState: 'ACTIVE' }` would arrive at the
        // service carrying injected defaults, silently overwriting server state.
        // Stripping the top-level defaults restores correct "absent key = no change"
        // PATCH semantics. See `stripShapeDefaults`.
        stripShapeDefaults(
            ExperienceSchema.omit({
                id: true,
                createdAt: true,
                updatedAt: true,
                createdById: true,
                updatedById: true,
                deletedAt: true,
                deletedById: true,
                // Server-managed: ownership change requires a dedicated admin action.
                ownerId: true,
                // Server-computed aggregates — updated by the review subsystem only.
                reviewsCount: true,
                averageRating: true,
                // Subscription lifecycle hook — use toggleSubscription route instead.
                hasActiveSubscription: true
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
            .array(z.string().uuid({ message: 'zodError.experience.amenityIds.invalidUuid' }))
            .optional(),
        /**
         * Optional feature UUID list for junction sync on update (write-only).
         * undefined → no change | [] → clear all | [ids] → sync to exact set.
         */
        featureIds: z
            .array(z.string().uuid({ message: 'zodError.experience.featureIds.invalidUuid' }))
            .optional()
    });

/** TypeScript type for {@link ExperienceUpdateInputSchema}. */
export type ExperienceUpdateInput = z.infer<typeof ExperienceUpdateInputSchema>;

/**
 * Alias of {@link ExperienceUpdateInputSchema} for explicit PATCH semantics.
 */
export const ExperiencePatchInputSchema = ExperienceUpdateInputSchema;

/** TypeScript type for {@link ExperiencePatchInputSchema}. */
export type ExperiencePatchInput = z.infer<typeof ExperiencePatchInputSchema>;

/**
 * Schema for experience update response.
 * Returns the complete updated experience object.
 */
export const ExperienceUpdateOutputSchema = ExperienceSchema;

/** TypeScript type for {@link ExperienceUpdateOutputSchema}. */
export type ExperienceUpdateOutput = z.infer<typeof ExperienceUpdateOutputSchema>;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for experience deletion input.
 * Requires ID and optional force flag for hard delete.
 */
export const ExperienceDeleteInputSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    // Use `.default(false)` only — `.optional().default(false)` is a dead chain:
    // `.default()` already supplies the value when the key is absent.
    force: z.boolean({ message: 'zodError.experience.delete.force.invalidType' }).default(false)
});

/** TypeScript type for {@link ExperienceDeleteInputSchema}. */
export type ExperienceDeleteInput = z.infer<typeof ExperienceDeleteInputSchema>;

/**
 * Schema for experience deletion response.
 * Returns success status and deletion timestamp.
 */
export const ExperienceDeleteOutputSchema = z.object({
    success: z.boolean({ message: 'zodError.experience.delete.success.required' }).default(true),
    deletedAt: z.date({ message: 'zodError.experience.delete.deletedAt.invalidType' }).optional()
});

/** TypeScript type for {@link ExperienceDeleteOutputSchema}. */
export type ExperienceDeleteOutput = z.infer<typeof ExperienceDeleteOutputSchema>;

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for experience restoration input.
 * Requires only the experience ID.
 */
export const ExperienceRestoreInputSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});

/** TypeScript type for {@link ExperienceRestoreInputSchema}. */
export type ExperienceRestoreInput = z.infer<typeof ExperienceRestoreInputSchema>;

/**
 * Schema for experience restoration response.
 * Returns the complete restored experience object.
 */
export const ExperienceRestoreOutputSchema = ExperienceSchema;

/** TypeScript type for {@link ExperienceRestoreOutputSchema}. */
export type ExperienceRestoreOutput = z.infer<typeof ExperienceRestoreOutputSchema>;
