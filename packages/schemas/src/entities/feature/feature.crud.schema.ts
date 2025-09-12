import { z } from 'zod';
import { FeatureIdSchema } from '../../common/id.schema.js';
import { FeatureSchema } from './feature.schema.js';

/**
 * Feature CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for features:
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
 * Schema for creating a new feature
 * Omits auto-generated fields like id and audit fields
 */
export const FeatureCreateInputSchema = FeatureSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).strict();

/**
 * Schema for feature creation response
 * Returns the complete feature object
 */
export const FeatureCreateOutputSchema = FeatureSchema;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating a feature (PUT - complete replacement)
 * Omits auto-generated fields and makes all fields partial
 */
export const FeatureUpdateInputSchema = FeatureSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
})
    .partial()
    .strict();

/**
 * Schema for partial feature updates (PATCH)
 * Same as update but explicitly named for clarity
 */
export const FeaturePatchInputSchema = FeatureUpdateInputSchema;

/**
 * Schema for feature update response
 * Returns the complete updated feature object
 */
export const FeatureUpdateOutputSchema = FeatureSchema;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for feature deletion input
 * Requires ID and optional force flag for hard delete
 */
export const FeatureDeleteInputSchema = z.object({
    id: FeatureIdSchema,
    force: z
        .boolean({
            message: 'zodError.feature.delete.force.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for feature deletion response
 * Returns success status and deletion timestamp
 */
export const FeatureDeleteOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.feature.delete.success.required'
        })
        .default(true),
    deletedAt: z
        .date({
            message: 'zodError.feature.delete.deletedAt.invalidType'
        })
        .optional()
});

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for feature restoration input
 * Requires only the feature ID
 */
export const FeatureRestoreInputSchema = z.object({
    id: FeatureIdSchema
});

/**
 * Schema for feature restoration response
 * Returns the complete restored feature object
 */
export const FeatureRestoreOutputSchema = FeatureSchema;

// ============================================================================
// MERGE SCHEMAS
// ============================================================================

/**
 * Schema for feature merge input
 * Requires source feature ID and target feature ID
 */
export const FeatureMergeInputSchema = z.object({
    sourceFeatureId: FeatureIdSchema,
    targetFeatureId: FeatureIdSchema,
    deleteSourceFeature: z
        .boolean({
            message: 'zodError.feature.merge.deleteSourceFeature.invalidType'
        })
        .optional()
        .default(true)
});

/**
 * Schema for feature merge response
 * Returns the target feature and merge statistics
 */
export const FeatureMergeOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.feature.merge.success.required'
        })
        .default(true),
    targetFeature: FeatureSchema,
    mergeStats: z.object({
        accommodationsMoved: z.number().int().min(0),
        relationshipsMoved: z.number().int().min(0)
    })
});

// ============================================================================
// BULK OPERATIONS SCHEMAS
// ============================================================================

/**
 * Schema for bulk feature operations input
 * Requires array of feature IDs and operation type
 */
export const FeatureBulkOperationInputSchema = z.object({
    ids: z
        .array(FeatureIdSchema, {
            message: 'zodError.feature.bulkOperation.ids.required'
        })
        .min(1, { message: 'zodError.feature.bulkOperation.ids.min' })
        .max(100, { message: 'zodError.feature.bulkOperation.ids.max' }),
    operation: z.enum(['delete', 'restore'], {
        message: 'zodError.feature.bulkOperation.operation.enum'
    }),
    force: z
        .boolean({
            message: 'zodError.feature.bulkOperation.force.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for bulk feature operations response
 * Returns operation results for each feature
 */
export const FeatureBulkOperationOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.feature.bulkOperation.success.required'
        })
        .default(true),
    results: z.array(
        z.object({
            id: FeatureIdSchema,
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
 * Schema for feature category update input
 * Allows updating category for multiple features
 */
export const FeatureCategoryUpdateInputSchema = z.object({
    featureIds: z
        .array(FeatureIdSchema, {
            message: 'zodError.feature.categoryUpdate.featureIds.required'
        })
        .min(1, { message: 'zodError.feature.categoryUpdate.featureIds.min' })
        .max(50, { message: 'zodError.feature.categoryUpdate.featureIds.max' }),
    newCategory: z
        .string({
            message: 'zodError.feature.categoryUpdate.newCategory.required'
        })
        .min(1, { message: 'zodError.feature.categoryUpdate.newCategory.min' })
        .max(100, { message: 'zodError.feature.categoryUpdate.newCategory.max' })
});

/**
 * Schema for feature category update response
 * Returns update statistics
 */
export const FeatureCategoryUpdateOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.feature.categoryUpdate.success.required'
        })
        .default(true),
    updatedCount: z.number().int().min(0),
    failedCount: z.number().int().min(0),
    newCategory: z.string(),
    updatedFeatures: z.array(FeatureSchema).optional()
});

// ============================================================================
// ICON MANAGEMENT SCHEMAS
// ============================================================================

/**
 * Schema for feature icon update input
 * Allows updating icons for multiple features
 */
export const FeatureIconUpdateInputSchema = z.object({
    featureIds: z
        .array(FeatureIdSchema, {
            message: 'zodError.feature.iconUpdate.featureIds.required'
        })
        .min(1, { message: 'zodError.feature.iconUpdate.featureIds.min' })
        .max(50, { message: 'zodError.feature.iconUpdate.featureIds.max' }),
    newIcon: z
        .string({
            message: 'zodError.feature.iconUpdate.newIcon.required'
        })
        .min(1, { message: 'zodError.feature.iconUpdate.newIcon.min' })
        .max(100, { message: 'zodError.feature.iconUpdate.newIcon.max' })
});

/**
 * Schema for feature icon update response
 * Returns update statistics
 */
export const FeatureIconUpdateOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.feature.iconUpdate.success.required'
        })
        .default(true),
    updatedCount: z.number().int().min(0),
    failedCount: z.number().int().min(0),
    newIcon: z.string(),
    updatedFeatures: z.array(FeatureSchema).optional()
});

// ============================================================================
// AVAILABILITY MANAGEMENT SCHEMAS
// ============================================================================

/**
 * Schema for feature availability update input
 * Allows updating availability status for multiple features
 */
export const FeatureAvailabilityUpdateInputSchema = z.object({
    featureIds: z
        .array(FeatureIdSchema, {
            message: 'zodError.feature.availabilityUpdate.featureIds.required'
        })
        .min(1, { message: 'zodError.feature.availabilityUpdate.featureIds.min' })
        .max(50, { message: 'zodError.feature.availabilityUpdate.featureIds.max' }),
    isAvailable: z.boolean({
        message: 'zodError.feature.availabilityUpdate.isAvailable.required'
    }),
    reason: z
        .string({
            message: 'zodError.feature.availabilityUpdate.reason.invalidType'
        })
        .min(1, { message: 'zodError.feature.availabilityUpdate.reason.min' })
        .max(500, { message: 'zodError.feature.availabilityUpdate.reason.max' })
        .optional()
});

/**
 * Schema for feature availability update response
 * Returns update statistics
 */
export const FeatureAvailabilityUpdateOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.feature.availabilityUpdate.success.required'
        })
        .default(true),
    updatedCount: z.number().int().min(0),
    failedCount: z.number().int().min(0),
    newAvailabilityStatus: z.boolean(),
    updatedFeatures: z.array(FeatureSchema).optional()
});

// ============================================================================
// PRIORITY MANAGEMENT SCHEMAS
// ============================================================================

/**
 * Schema for feature priority update input
 * Allows updating priority for multiple features
 */
export const FeaturePriorityUpdateInputSchema = z.object({
    featureIds: z
        .array(FeatureIdSchema, {
            message: 'zodError.feature.priorityUpdate.featureIds.required'
        })
        .min(1, { message: 'zodError.feature.priorityUpdate.featureIds.min' })
        .max(50, { message: 'zodError.feature.priorityUpdate.featureIds.max' }),
    newPriority: z
        .number({
            message: 'zodError.feature.priorityUpdate.newPriority.required'
        })
        .int({ message: 'zodError.feature.priorityUpdate.newPriority.int' })
        .min(0, { message: 'zodError.feature.priorityUpdate.newPriority.min' })
        .max(100, { message: 'zodError.feature.priorityUpdate.newPriority.max' })
});

/**
 * Schema for feature priority update response
 * Returns update statistics
 */
export const FeaturePriorityUpdateOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.feature.priorityUpdate.success.required'
        })
        .default(true),
    updatedCount: z.number().int().min(0),
    failedCount: z.number().int().min(0),
    newPriority: z.number().int().min(0).max(100),
    updatedFeatures: z.array(FeatureSchema).optional()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type FeatureCreateInput = z.infer<typeof FeatureCreateInputSchema>;
export type FeatureCreateOutput = z.infer<typeof FeatureCreateOutputSchema>;
export type FeatureUpdateInput = z.infer<typeof FeatureUpdateInputSchema>;
export type FeaturePatchInput = z.infer<typeof FeaturePatchInputSchema>;
export type FeatureUpdateOutput = z.infer<typeof FeatureUpdateOutputSchema>;
export type FeatureDeleteInput = z.infer<typeof FeatureDeleteInputSchema>;
export type FeatureDeleteOutput = z.infer<typeof FeatureDeleteOutputSchema>;
export type FeatureRestoreInput = z.infer<typeof FeatureRestoreInputSchema>;
export type FeatureRestoreOutput = z.infer<typeof FeatureRestoreOutputSchema>;
export type FeatureMergeInput = z.infer<typeof FeatureMergeInputSchema>;
export type FeatureMergeOutput = z.infer<typeof FeatureMergeOutputSchema>;
export type FeatureBulkOperationInput = z.infer<typeof FeatureBulkOperationInputSchema>;
export type FeatureBulkOperationOutput = z.infer<typeof FeatureBulkOperationOutputSchema>;
export type FeatureCategoryUpdateInput = z.infer<typeof FeatureCategoryUpdateInputSchema>;
export type FeatureCategoryUpdateOutput = z.infer<typeof FeatureCategoryUpdateOutputSchema>;
export type FeatureIconUpdateInput = z.infer<typeof FeatureIconUpdateInputSchema>;
export type FeatureIconUpdateOutput = z.infer<typeof FeatureIconUpdateOutputSchema>;
export type FeatureAvailabilityUpdateInput = z.infer<typeof FeatureAvailabilityUpdateInputSchema>;
export type FeatureAvailabilityUpdateOutput = z.infer<typeof FeatureAvailabilityUpdateOutputSchema>;
export type FeaturePriorityUpdateInput = z.infer<typeof FeaturePriorityUpdateInputSchema>;
export type FeaturePriorityUpdateOutput = z.infer<typeof FeaturePriorityUpdateOutputSchema>;
