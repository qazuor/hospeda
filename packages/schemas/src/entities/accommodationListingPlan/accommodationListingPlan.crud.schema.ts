import { z } from 'zod';
import { AccommodationListingPlanIdSchema } from '../../common/id.schema.js';
import { AccommodationListingPlanSchema } from './accommodationListingPlan.schema.js';

/**
 * AccommodationListingPlan CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for accommodation listing plans:
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
 * Schema for creating a new accommodation listing plan
 * Omits auto-generated fields like id and audit fields
 */
export const AccommodationListingPlanCreateInputSchema = AccommodationListingPlanSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

// Type: Create Input
export type AccommodationListingPlanCreateInput = z.infer<
    typeof AccommodationListingPlanCreateInputSchema
>;

/**
 * Schema for accommodation listing plan creation response
 * Returns the complete accommodation listing plan object
 */
export const AccommodationListingPlanCreateOutputSchema = AccommodationListingPlanSchema;

// Type: Create Output
export type AccommodationListingPlanCreateOutput = z.infer<
    typeof AccommodationListingPlanCreateOutputSchema
>;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating an accommodation listing plan
 * Requires ID and allows updating most fields except audit fields
 */
export const AccommodationListingPlanUpdateInputSchema = AccommodationListingPlanSchema.omit({
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

// Type: Update Input
export type AccommodationListingPlanUpdateInput = z.infer<
    typeof AccommodationListingPlanUpdateInputSchema
>;

/**
 * Schema for accommodation listing plan update response
 * Returns the complete updated accommodation listing plan object
 */
export const AccommodationListingPlanUpdateOutputSchema = AccommodationListingPlanSchema;

// Type: Update Output
export type AccommodationListingPlanUpdateOutput = z.infer<
    typeof AccommodationListingPlanUpdateOutputSchema
>;

// ============================================================================
// PATCH SCHEMAS
// ============================================================================

/**
 * Schema for partially updating an accommodation listing plan
 * All fields are optional except ID
 */
export const AccommodationListingPlanPatchInputSchema = AccommodationListingPlanSchema.omit({
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
})
    .partial()
    .extend({
        id: AccommodationListingPlanIdSchema
    });

// Type: Patch Input
export type AccommodationListingPlanPatchInput = z.infer<
    typeof AccommodationListingPlanPatchInputSchema
>;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for soft-deleting an accommodation listing plan
 * Only requires the ID
 */
export const AccommodationListingPlanDeleteInputSchema = z.object({
    id: AccommodationListingPlanIdSchema
});

// Type: Delete Input
export type AccommodationListingPlanDeleteInput = z.infer<
    typeof AccommodationListingPlanDeleteInputSchema
>;

/**
 * Schema for accommodation listing plan deletion response
 * Returns the soft-deleted accommodation listing plan object
 */
export const AccommodationListingPlanDeleteOutputSchema = AccommodationListingPlanSchema;

// Type: Delete Output
export type AccommodationListingPlanDeleteOutput = z.infer<
    typeof AccommodationListingPlanDeleteOutputSchema
>;

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for restoring a soft-deleted accommodation listing plan
 * Only requires the ID
 */
export const AccommodationListingPlanRestoreInputSchema = z.object({
    id: AccommodationListingPlanIdSchema
});

// Type: Restore Input
export type AccommodationListingPlanRestoreInput = z.infer<
    typeof AccommodationListingPlanRestoreInputSchema
>;

/**
 * Schema for accommodation listing plan restoration response
 * Returns the restored accommodation listing plan object
 */
export const AccommodationListingPlanRestoreOutputSchema = AccommodationListingPlanSchema;

// Type: Restore Output
export type AccommodationListingPlanRestoreOutput = z.infer<
    typeof AccommodationListingPlanRestoreOutputSchema
>;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Business validation rules for accommodation listing plan
 */
export const AccommodationListingPlanBusinessValidationSchema = z
    .object({
        id: AccommodationListingPlanIdSchema,
        name: z.string().min(3).max(100),
        limits: z.record(z.string(), z.unknown()).optional()
    })
    .refine((data) => data.name.trim().length >= 3, {
        message: 'zodError.accommodationListingPlan.name.invalidFormat',
        path: ['name']
    });
