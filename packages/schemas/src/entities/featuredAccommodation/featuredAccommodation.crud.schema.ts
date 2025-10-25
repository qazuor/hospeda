import { z } from 'zod';
import { FeaturedAccommodationIdSchema } from '../../common/id.schema.js';
import { FeaturedAccommodationSchema } from './featuredAccommodation.schema.js';

/**
 * FeaturedAccommodation CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for featured accommodations:
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
 * Schema for creating a new featured accommodation
 * Omits auto-generated fields like id and audit fields
 */
export const FeaturedAccommodationCreateInputSchema = FeaturedAccommodationSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

// Type: Create Input
export type FeaturedAccommodationCreateInput = z.infer<
    typeof FeaturedAccommodationCreateInputSchema
>;

/**
 * Schema for featured accommodation creation response
 * Returns the complete featured accommodation object
 */
export const FeaturedAccommodationCreateOutputSchema = FeaturedAccommodationSchema;

// Type: Create Output
export type FeaturedAccommodationCreateOutput = z.infer<
    typeof FeaturedAccommodationCreateOutputSchema
>;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating a featured accommodation
 * Requires ID and allows updating most fields except audit fields
 */
export const FeaturedAccommodationUpdateInputSchema = FeaturedAccommodationSchema.omit({
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

// Type: Update Input
export type FeaturedAccommodationUpdateInput = z.infer<
    typeof FeaturedAccommodationUpdateInputSchema
>;

/**
 * Schema for featured accommodation update response
 * Returns the complete updated featured accommodation object
 */
export const FeaturedAccommodationUpdateOutputSchema = FeaturedAccommodationSchema;

// Type: Update Output
export type FeaturedAccommodationUpdateOutput = z.infer<
    typeof FeaturedAccommodationUpdateOutputSchema
>;

// ============================================================================
// PATCH SCHEMAS
// ============================================================================

/**
 * Schema for partially updating a featured accommodation
 * All fields are optional except ID
 */
export const FeaturedAccommodationPatchInputSchema = FeaturedAccommodationSchema.omit({
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
})
    .partial()
    .extend({
        id: FeaturedAccommodationIdSchema
    });

// Type: Patch Input
export type FeaturedAccommodationPatchInput = z.infer<typeof FeaturedAccommodationPatchInputSchema>;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for soft-deleting a featured accommodation
 * Only requires the ID
 */
export const FeaturedAccommodationDeleteInputSchema = z.object({
    id: FeaturedAccommodationIdSchema
});

// Type: Delete Input
export type FeaturedAccommodationDeleteInput = z.infer<
    typeof FeaturedAccommodationDeleteInputSchema
>;

/**
 * Schema for featured accommodation deletion response
 * Returns the soft-deleted featured accommodation object
 */
export const FeaturedAccommodationDeleteOutputSchema = FeaturedAccommodationSchema;

// Type: Delete Output
export type FeaturedAccommodationDeleteOutput = z.infer<
    typeof FeaturedAccommodationDeleteOutputSchema
>;

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for restoring a soft-deleted featured accommodation
 * Only requires the ID
 */
export const FeaturedAccommodationRestoreInputSchema = z.object({
    id: FeaturedAccommodationIdSchema
});

// Type: Restore Input
export type FeaturedAccommodationRestoreInput = z.infer<
    typeof FeaturedAccommodationRestoreInputSchema
>;

/**
 * Schema for featured accommodation restoration response
 * Returns the restored featured accommodation object
 */
export const FeaturedAccommodationRestoreOutputSchema = FeaturedAccommodationSchema;

// Type: Restore Output
export type FeaturedAccommodationRestoreOutput = z.infer<
    typeof FeaturedAccommodationRestoreOutputSchema
>;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Business validation rules for featured accommodation
 */
export const FeaturedAccommodationBusinessValidationSchema = z
    .object({
        id: FeaturedAccommodationIdSchema,
        // Validate that toDate is after fromDate
        fromDate: z.string().datetime(),
        toDate: z.string().datetime(),
        // Featured type validation
        featuredType: z.string(),
        status: z.string()
    })
    .refine((data) => new Date(data.toDate) > new Date(data.fromDate), {
        message: 'zodError.featuredAccommodation.toDate.mustBeAfterFromDate',
        path: ['toDate']
    });
