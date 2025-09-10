import { z } from 'zod';
import { AmenityIdSchema } from '../../common/id.schema.js';
import { AccommodationAmenityRelationSchema, AmenitySchema } from './amenity.schema.js';

/**
 * Amenity CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for amenities:
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
 * Schema for creating a new amenity
 * Omits auto-generated fields like id and audit fields
 */
export const AmenityCreateInputSchema = AmenitySchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/**
 * Schema for amenity creation response
 * Returns the complete amenity object
 */
export const AmenityCreateOutputSchema = AmenitySchema;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating an amenity (PUT - complete replacement)
 * Omits auto-generated fields and makes all fields partial
 */
export const AmenityUpdateInputSchema = AmenitySchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).partial();

/**
 * Schema for partial amenity updates (PATCH)
 * Same as update but explicitly named for clarity
 */
export const AmenityPatchInputSchema = AmenityUpdateInputSchema;

/**
 * Schema for amenity update response
 * Returns the complete updated amenity object
 */
export const AmenityUpdateOutputSchema = AmenitySchema;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for amenity deletion input
 * Requires ID and optional force flag for hard delete
 */
export const AmenityDeleteInputSchema = z.object({
    id: AmenityIdSchema,
    force: z
        .boolean({
            message: 'zodError.amenity.delete.force.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for amenity deletion response
 * Returns success status and deletion timestamp
 */
export const AmenityDeleteOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.amenity.delete.success.required'
        })
        .default(true),
    deletedAt: z
        .date({
            message: 'zodError.amenity.delete.deletedAt.invalidType'
        })
        .optional()
});

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for amenity restoration input
 * Requires only the amenity ID
 */
export const AmenityRestoreInputSchema = z.object({
    id: AmenityIdSchema
});

/**
 * Schema for amenity restoration response
 * Returns the complete restored amenity object
 */
export const AmenityRestoreOutputSchema = AmenitySchema;

// ============================================================================
// MERGE SCHEMAS
// ============================================================================

/**
 * Schema for amenity merge input
 * Requires source amenity ID and target amenity ID
 */
export const AmenityMergeInputSchema = z.object({
    sourceAmenityId: AmenityIdSchema,
    targetAmenityId: AmenityIdSchema,
    deleteSourceAmenity: z
        .boolean({
            message: 'zodError.amenity.merge.deleteSourceAmenity.invalidType'
        })
        .optional()
        .default(true)
});

/**
 * Schema for amenity merge response
 * Returns the target amenity and merge statistics
 */
export const AmenityMergeOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.amenity.merge.success.required'
        })
        .default(true),
    targetAmenity: AmenitySchema,
    mergeStats: z.object({
        accommodationsMoved: z.number().int().min(0),
        relationshipsMoved: z.number().int().min(0)
    })
});

// ============================================================================
// BULK OPERATIONS SCHEMAS
// ============================================================================

/**
 * Schema for bulk amenity operations input
 * Requires array of amenity IDs and operation type
 */
export const AmenityBulkOperationInputSchema = z.object({
    ids: z
        .array(AmenityIdSchema, {
            message: 'zodError.amenity.bulkOperation.ids.required'
        })
        .min(1, { message: 'zodError.amenity.bulkOperation.ids.min' })
        .max(100, { message: 'zodError.amenity.bulkOperation.ids.max' }),
    operation: z.enum(['delete', 'restore'], {
        message: 'zodError.amenity.bulkOperation.operation.enum'
    }),
    force: z
        .boolean({
            message: 'zodError.amenity.bulkOperation.force.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for bulk amenity operations response
 * Returns operation results for each amenity
 */
export const AmenityBulkOperationOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.amenity.bulkOperation.success.required'
        })
        .default(true),
    results: z.array(
        z.object({
            id: AmenityIdSchema,
            success: z.boolean(),
            error: z.string().optional()
        })
    ),
    summary: z.object({
        total: z.number().int().min(0),
        successful: z.number().int().min(0),
        failed: z.number().int().min(0)
    })
});

// ============================================================================
// CATEGORY MANAGEMENT SCHEMAS
// ============================================================================

/**
 * Schema for amenity category update input
 * Allows updating category for multiple amenities
 */
export const AmenityCategoryUpdateInputSchema = z.object({
    amenityIds: z
        .array(AmenityIdSchema, {
            message: 'zodError.amenity.categoryUpdate.amenityIds.required'
        })
        .min(1, { message: 'zodError.amenity.categoryUpdate.amenityIds.min' })
        .max(50, { message: 'zodError.amenity.categoryUpdate.amenityIds.max' }),
    newCategory: z
        .string({
            message: 'zodError.amenity.categoryUpdate.newCategory.required'
        })
        .min(1, { message: 'zodError.amenity.categoryUpdate.newCategory.min' })
        .max(100, { message: 'zodError.amenity.categoryUpdate.newCategory.max' })
});

/**
 * Schema for amenity category update response
 * Returns update statistics
 */
export const AmenityCategoryUpdateOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.amenity.categoryUpdate.success.required'
        })
        .default(true),
    updatedCount: z.number().int().min(0),
    failedCount: z.number().int().min(0),
    newCategory: z.string(),
    updatedAmenities: z.array(AmenitySchema).optional()
});

// ============================================================================
// ICON MANAGEMENT SCHEMAS
// ============================================================================

/**
 * Schema for amenity icon update input
 * Allows updating icons for multiple amenities
 */
export const AmenityIconUpdateInputSchema = z.object({
    amenityIds: z
        .array(AmenityIdSchema, {
            message: 'zodError.amenity.iconUpdate.amenityIds.required'
        })
        .min(1, { message: 'zodError.amenity.iconUpdate.amenityIds.min' })
        .max(50, { message: 'zodError.amenity.iconUpdate.amenityIds.max' }),
    newIcon: z
        .string({
            message: 'zodError.amenity.iconUpdate.newIcon.required'
        })
        .min(1, { message: 'zodError.amenity.iconUpdate.newIcon.min' })
        .max(100, { message: 'zodError.amenity.iconUpdate.newIcon.max' })
});

/**
 * Schema for amenity icon update response
 * Returns update statistics
 */
export const AmenityIconUpdateOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.amenity.iconUpdate.success.required'
        })
        .default(true),
    updatedCount: z.number().int().min(0),
    failedCount: z.number().int().min(0),
    newIcon: z.string(),
    updatedAmenities: z.array(AmenitySchema).optional()
});

// ============================================================================
// ACCOMMODATION-AMENITY RELATION SCHEMAS
// ============================================================================

/**
 * Schema for adding an amenity to an accommodation
 * Input for creating accommodation-amenity relationships
 * Reuses AccommodationAmenityRelationSchema for consistency
 */
export const AmenityAddToAccommodationInputSchema = AccommodationAmenityRelationSchema;

/**
 * Schema for removing an amenity from an accommodation
 * Input for deleting accommodation-amenity relationships
 * Picks only the required IDs from AccommodationAmenityRelationSchema
 */
export const AmenityRemoveFromAccommodationInputSchema = AccommodationAmenityRelationSchema.pick({
    accommodationId: true,
    amenityId: true
});

/**
 * Schema for accommodation-amenity relation output
 * Returns the relationship data after add/remove operations
 * Extends AccommodationAmenityRelationSchema with audit fields
 */
export const AmenityAccommodationRelationOutputSchema = z.object({
    relation: AccommodationAmenityRelationSchema.extend({
        createdAt: z.date().optional(),
        updatedAt: z.date().optional(),
        deletedAt: z.date().optional()
    })
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type AmenityCreateInput = z.infer<typeof AmenityCreateInputSchema>;
export type AmenityCreateOutput = z.infer<typeof AmenityCreateOutputSchema>;
export type AmenityUpdateInput = z.infer<typeof AmenityUpdateInputSchema>;
export type AmenityPatchInput = z.infer<typeof AmenityPatchInputSchema>;
export type AmenityUpdateOutput = z.infer<typeof AmenityUpdateOutputSchema>;
export type AmenityDeleteInput = z.infer<typeof AmenityDeleteInputSchema>;
export type AmenityDeleteOutput = z.infer<typeof AmenityDeleteOutputSchema>;
export type AmenityRestoreInput = z.infer<typeof AmenityRestoreInputSchema>;
export type AmenityRestoreOutput = z.infer<typeof AmenityRestoreOutputSchema>;
export type AmenityMergeInput = z.infer<typeof AmenityMergeInputSchema>;
export type AmenityMergeOutput = z.infer<typeof AmenityMergeOutputSchema>;
export type AmenityBulkOperationInput = z.infer<typeof AmenityBulkOperationInputSchema>;
export type AmenityBulkOperationOutput = z.infer<typeof AmenityBulkOperationOutputSchema>;
export type AmenityCategoryUpdateInput = z.infer<typeof AmenityCategoryUpdateInputSchema>;
export type AmenityCategoryUpdateOutput = z.infer<typeof AmenityCategoryUpdateOutputSchema>;
export type AmenityIconUpdateInput = z.infer<typeof AmenityIconUpdateInputSchema>;
export type AmenityIconUpdateOutput = z.infer<typeof AmenityIconUpdateOutputSchema>;
export type AmenityAddToAccommodationInput = z.infer<typeof AmenityAddToAccommodationInputSchema>;
export type AmenityRemoveFromAccommodationInput = z.infer<
    typeof AmenityRemoveFromAccommodationInputSchema
>;
export type AmenityAccommodationRelationOutput = z.infer<
    typeof AmenityAccommodationRelationOutputSchema
>;
