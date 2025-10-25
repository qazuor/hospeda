import { z } from 'zod';
import { AccommodationListingIdSchema } from '../../common/id.schema.js';
import { AccommodationListingSchema } from './accommodationListing.schema.js';

/**
 * AccommodationListing CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for accommodation listings:
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
 * Schema for creating a new accommodation listing
 * Omits auto-generated fields like id and audit fields
 */
export const AccommodationListingCreateInputSchema = AccommodationListingSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

// Type: Create Input
export type AccommodationListingCreateInput = z.infer<typeof AccommodationListingCreateInputSchema>;

/**
 * Schema for accommodation listing creation response
 * Returns the complete accommodation listing object
 */
export const AccommodationListingCreateOutputSchema = AccommodationListingSchema;

// Type: Create Output
export type AccommodationListingCreateOutput = z.infer<
    typeof AccommodationListingCreateOutputSchema
>;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating an accommodation listing
 * Requires ID and allows updating most fields except audit fields
 */
export const AccommodationListingUpdateInputSchema = AccommodationListingSchema.omit({
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

// Type: Update Input
export type AccommodationListingUpdateInput = z.infer<typeof AccommodationListingUpdateInputSchema>;

/**
 * Schema for accommodation listing update response
 * Returns the complete updated accommodation listing object
 */
export const AccommodationListingUpdateOutputSchema = AccommodationListingSchema;

// Type: Update Output
export type AccommodationListingUpdateOutput = z.infer<
    typeof AccommodationListingUpdateOutputSchema
>;

// ============================================================================
// PATCH SCHEMAS
// ============================================================================

/**
 * Schema for partially updating an accommodation listing
 * All fields are optional except ID
 */
export const AccommodationListingPatchInputSchema = AccommodationListingSchema.omit({
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
})
    .partial()
    .extend({
        id: AccommodationListingIdSchema
    });

// Type: Patch Input
export type AccommodationListingPatchInput = z.infer<typeof AccommodationListingPatchInputSchema>;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for soft-deleting an accommodation listing
 * Only requires the ID
 */
export const AccommodationListingDeleteInputSchema = z.object({
    id: AccommodationListingIdSchema
});

// Type: Delete Input
export type AccommodationListingDeleteInput = z.infer<typeof AccommodationListingDeleteInputSchema>;

/**
 * Schema for accommodation listing deletion response
 * Returns the soft-deleted accommodation listing object
 */
export const AccommodationListingDeleteOutputSchema = AccommodationListingSchema;

// Type: Delete Output
export type AccommodationListingDeleteOutput = z.infer<
    typeof AccommodationListingDeleteOutputSchema
>;

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for restoring a soft-deleted accommodation listing
 * Only requires the ID
 */
export const AccommodationListingRestoreInputSchema = z.object({
    id: AccommodationListingIdSchema
});

// Type: Restore Input
export type AccommodationListingRestoreInput = z.infer<
    typeof AccommodationListingRestoreInputSchema
>;

/**
 * Schema for accommodation listing restoration response
 * Returns the restored accommodation listing object
 */
export const AccommodationListingRestoreOutputSchema = AccommodationListingSchema;

// Type: Restore Output
export type AccommodationListingRestoreOutput = z.infer<
    typeof AccommodationListingRestoreOutputSchema
>;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Business validation rules for accommodation listing
 */
export const AccommodationListingBusinessValidationSchema = z
    .object({
        id: AccommodationListingIdSchema,
        // Validate that toDate is after fromDate
        fromDate: z.string().datetime(),
        toDate: z.string().datetime(),
        // Trial validation
        isTrial: z.boolean(),
        trialEndsAt: z.string().datetime().optional()
    })
    .refine((data) => new Date(data.toDate) > new Date(data.fromDate), {
        message: 'zodError.accommodationListing.toDate.mustBeAfterFromDate',
        path: ['toDate']
    })
    .refine((data) => !data.isTrial || data.trialEndsAt, {
        message: 'zodError.accommodationListing.trialEndsAt.requiredForTrial',
        path: ['trialEndsAt']
    });
