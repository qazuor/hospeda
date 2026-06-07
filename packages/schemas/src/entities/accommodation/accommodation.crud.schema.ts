import { z } from 'zod';
import { AccommodationIdSchema } from '../../common/id.schema.js';
import { AccommodationSchema } from './accommodation.schema.js';

/**
 * Accommodation CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for accommodations:
 * - Create (input/output)
 * - Update (input/output)
 * - Patch (input)
 * - Delete (input/output)
 * - Restore (input/output)
 */

// ============================================================================
// CREATE SCHEMAS
// ============================================================================

/**
 * Schema for creating a new accommodation.
 *
 * Omits auto-generated fields (id, audit timestamps) and makes `slug` optional
 * since it can be auto-generated from the accommodation name.
 *
 * ### Junction sync fields (write-only, SPEC-172)
 *
 * - `amenityIds` — Optional list of amenity UUIDs to associate with the new
 *   accommodation. When provided, the service inserts a row in
 *   `r_accommodation_amenity` for each ID inside the same transaction as the
 *   accommodation insert. Omitting this field (or passing `undefined`) is a
 *   no-op — no junction rows are written.
 *
 * - `featureIds` — Same contract for `r_accommodation_feature`.
 *
 * These fields are **write-only inputs** and are NOT part of `AccommodationSchema`
 * (they do not appear in read responses).
 *
 * All IDs must reference existing catalog rows; unknown IDs cause the entire
 * transaction to roll back with a `VALIDATION_ERROR`.
 */
export const AccommodationCreateInputSchema = AccommodationSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,
    // Server-managed (SPEC-143 #29): only the pause/resume flow flips this.
    ownerSuspended: true,
    // Server-managed (SPEC-167 §3): only the downgrade-restriction flow flips this.
    planRestricted: true
}).extend({
    slug: z
        .string()
        .min(3, { message: 'zodError.accommodation.slug.min' })
        .max(100, { message: 'zodError.accommodation.slug.max' })
        .optional(),
    /**
     * Optional list of amenity UUIDs to associate on create (SPEC-172 write-only).
     * Syncs `r_accommodation_amenity` transactionally alongside the accommodation row.
     * Undefined → no junction rows written.
     */
    amenityIds: z
        .array(z.string().uuid({ message: 'zodError.accommodation.amenityIds.invalidUuid' }))
        .optional(),
    /**
     * Optional list of feature UUIDs to associate on create (SPEC-172 write-only).
     * Syncs `r_accommodation_feature` transactionally alongside the accommodation row.
     * Undefined → no junction rows written.
     */
    featureIds: z
        .array(z.string().uuid({ message: 'zodError.accommodation.featureIds.invalidUuid' }))
        .optional()
});

// Type: Create Input
export type AccommodationCreateInput = z.infer<typeof AccommodationCreateInputSchema>;

/**
 * Schema for accommodation creation response
 * Returns the complete accommodation object
 */
export const AccommodationCreateOutputSchema = AccommodationSchema;

// Type: Create Output
export type AccommodationCreateOutput = z.infer<typeof AccommodationCreateOutputSchema>;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating an accommodation (PUT / PATCH — partial replacement).
 *
 * Omits auto-generated fields and makes all fields partial.
 *
 * ### Junction sync contract (write-only, SPEC-172)
 *
 * Both `amenityIds` and `featureIds` follow the same three-way contract:
 *
 * - `undefined` (field absent) → **leave existing junction rows untouched**.
 *   This is the critical idempotency case: a caller that never mentions
 *   amenities will never accidentally wipe them.
 *
 * - `[]` (empty array) → **delete all** junction rows for this accommodation.
 *
 * - `[id1, id2, …]` → **sync to exactly that set**: rows not in the list are
 *   deleted, missing rows are inserted. Idempotent — running the same update
 *   twice produces the same final state.
 *
 * All mutations run inside ONE database transaction together with the
 * accommodation update. An unknown / non-existent ID rolls back the entire
 * transaction with `VALIDATION_ERROR`; no partial writes occur.
 *
 * These fields are **write-only inputs** and do NOT appear in read responses.
 */
export const AccommodationUpdateInputSchema = AccommodationSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,
    // Server-managed (SPEC-143 #29): only the pause/resume flow flips this.
    ownerSuspended: true,
    // Server-managed (SPEC-167 §3): only the downgrade-restriction flow flips this.
    planRestricted: true
})
    .partial()
    .extend({
        /**
         * Optional amenity UUID list for junction sync on update (SPEC-172 write-only).
         * undefined → no change | [] → clear all | [ids] → sync to exact set.
         */
        amenityIds: z
            .array(z.string().uuid({ message: 'zodError.accommodation.amenityIds.invalidUuid' }))
            .optional(),
        /**
         * Optional feature UUID list for junction sync on update (SPEC-172 write-only).
         * undefined → no change | [] → clear all | [ids] → sync to exact set.
         */
        featureIds: z
            .array(z.string().uuid({ message: 'zodError.accommodation.featureIds.invalidUuid' }))
            .optional()
    });

// Type: Update Input
export type AccommodationUpdateInput = z.infer<typeof AccommodationUpdateInputSchema>;

/**
 * Schema for partial accommodation updates (PATCH)
 * Same as update but explicitly named for clarity
 */
export const AccommodationPatchInputSchema = AccommodationUpdateInputSchema;

// Type: Patch Input
export type AccommodationPatchInput = z.infer<typeof AccommodationPatchInputSchema>;

/**
 * Schema for accommodation update response
 * Returns the complete updated accommodation object
 */
export const AccommodationUpdateOutputSchema = AccommodationSchema;

// Type: Update Output
export type AccommodationUpdateOutput = z.infer<typeof AccommodationUpdateOutputSchema>;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for accommodation deletion input
 * Requires ID and optional force flag for hard delete
 */
export const AccommodationDeleteInputSchema = z.object({
    id: AccommodationIdSchema,
    force: z
        .boolean({
            message: 'zodError.accommodation.delete.force.invalidType'
        })
        .optional()
        .default(false)
});

// Type: Delete Input
export type AccommodationDeleteInput = z.infer<typeof AccommodationDeleteInputSchema>;

/**
 * Schema for accommodation deletion response
 * Returns success status and deletion timestamp
 */
export const AccommodationDeleteOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.accommodation.delete.success.required'
        })
        .default(true),
    deletedAt: z
        .date({
            message: 'zodError.accommodation.delete.deletedAt.invalidType'
        })
        .optional()
});

// Type: Delete Output
export type AccommodationDeleteOutput = z.infer<typeof AccommodationDeleteOutputSchema>;

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for accommodation restoration input
 * Requires only the accommodation ID
 */
export const AccommodationRestoreInputSchema = z.object({
    id: AccommodationIdSchema
});

// Type: Restore Input
export type AccommodationRestoreInput = z.infer<typeof AccommodationRestoreInputSchema>;

/**
 * Schema for accommodation restoration response
 * Returns the complete restored accommodation object
 */
export const AccommodationRestoreOutputSchema = AccommodationSchema;

// Type: Restore Output
export type AccommodationRestoreOutput = z.infer<typeof AccommodationRestoreOutputSchema>;
