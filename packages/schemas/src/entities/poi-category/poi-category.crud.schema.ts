import { z } from 'zod';
import { PoiCategoryIdSchema } from '../../common/id.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';
import { PoiCategorySchema } from './poi-category.schema.js';

/**
 * CRUD Input Schemas for POI Category operations
 */

/**
 * Schema for creating a new POI category
 * Omits auto-generated fields like id and audit fields
 */
export const PoiCategoryCreateInputSchema = PoiCategorySchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/**
 * Schema for updating a POI category
 * All fields are optional for partial updates, except id is not allowed
 */
// Zod 4 .partial() keeps .default(); strip them so absent keys = no change (SPEC-217).
export const PoiCategoryUpdateInputSchema = z
    .object(stripShapeDefaults(PoiCategoryCreateInputSchema.shape))
    .partial();

/**
 * Schema for deleting a POI category (soft delete)
 * Only requires the POI category ID
 */
export const PoiCategoryDeleteInputSchema = z.object({
    id: PoiCategoryIdSchema
});

/**
 * Schema for restoring a soft-deleted POI category
 * Only requires the POI category ID
 */
export const PoiCategoryRestoreInputSchema = z.object({
    id: PoiCategoryIdSchema
});

/**
 * CRUD Output Schemas for POI Category operations
 */

/**
 * Schema for POI category creation response
 * Returns the created POI category
 */
export const PoiCategoryCreateOutputSchema = z.object({
    poiCategory: PoiCategorySchema
});

/**
 * Schema for POI category update response
 * Returns the updated POI category
 */
export const PoiCategoryUpdateOutputSchema = z.object({
    poiCategory: PoiCategorySchema
});

/**
 * Schema for POI category deletion response
 * Returns the deleted POI category
 */
export const PoiCategoryDeleteOutputSchema = z.object({
    poiCategory: PoiCategorySchema
});

/**
 * Schema for POI category restoration response
 * Returns the restored POI category
 */
export const PoiCategoryRestoreOutputSchema = z.object({
    poiCategory: PoiCategorySchema
});

/**
 * Schema for POI category view response
 * Returns a single POI category by ID or slug
 */
export const PoiCategoryViewOutputSchema = z.object({
    poiCategory: PoiCategorySchema.nullable()
});

/**
 * Type exports for CRUD operations
 */
export type PoiCategoryCreateInput = z.infer<typeof PoiCategoryCreateInputSchema>;
export type PoiCategoryUpdateInput = z.infer<typeof PoiCategoryUpdateInputSchema>;
export type PoiCategoryDeleteInput = z.infer<typeof PoiCategoryDeleteInputSchema>;
export type PoiCategoryRestoreInput = z.infer<typeof PoiCategoryRestoreInputSchema>;

export type PoiCategoryCreateOutput = z.infer<typeof PoiCategoryCreateOutputSchema>;
export type PoiCategoryUpdateOutput = z.infer<typeof PoiCategoryUpdateOutputSchema>;
export type PoiCategoryDeleteOutput = z.infer<typeof PoiCategoryDeleteOutputSchema>;
export type PoiCategoryRestoreOutput = z.infer<typeof PoiCategoryRestoreOutputSchema>;
export type PoiCategoryViewOutput = z.infer<typeof PoiCategoryViewOutputSchema>;
