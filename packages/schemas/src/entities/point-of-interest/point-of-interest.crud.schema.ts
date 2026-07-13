import { z } from 'zod';
import { DestinationIdSchema, PointOfInterestIdSchema } from '../../common/id.schema.js';
import { PointOfInterestDestinationRelationEnum } from '../../enums/point-of-interest-destination-relation.enum.js';
import { PointOfInterestDestinationRelationEnumSchema } from '../../enums/point-of-interest-destination-relation.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';
import { PointOfInterestSchema } from './point-of-interest.schema.js';

/**
 * CRUD Input Schemas for Point Of Interest operations
 */

/**
 * Schema for creating a new point of interest.
 * Omits auto-generated fields like id and audit fields. Unlike attraction,
 * `slug` is required on create (it's the i18n key, never auto-generated
 * from a `name` — HOS-113 OQ-2).
 */
export const PointOfInterestCreateInputSchema = PointOfInterestSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/**
 * Schema for updating a point of interest
 * All fields are optional for partial updates, except id is not allowed
 */
// Zod 4 .partial() keeps .default(); strip them so absent keys = no change (SPEC-217).
export const PointOfInterestUpdateInputSchema = z
    .object(stripShapeDefaults(PointOfInterestCreateInputSchema.shape))
    .partial();

/**
 * Schema for deleting a point of interest (soft delete)
 * Only requires the point of interest ID
 */
export const PointOfInterestDeleteInputSchema = z.object({
    id: PointOfInterestIdSchema
});

/**
 * Schema for restoring a soft-deleted point of interest
 * Only requires the point of interest ID
 */
export const PointOfInterestRestoreInputSchema = z.object({
    id: PointOfInterestIdSchema
});

/**
 * CRUD Output Schemas for Point Of Interest operations
 */

/**
 * Schema for point of interest creation response
 * Returns the created point of interest
 */
export const PointOfInterestCreateOutputSchema = z.object({
    pointOfInterest: PointOfInterestSchema
});

/**
 * Schema for point of interest update response
 * Returns the updated point of interest
 */
export const PointOfInterestUpdateOutputSchema = z.object({
    pointOfInterest: PointOfInterestSchema
});

/**
 * Schema for point of interest deletion response
 * Returns the deleted point of interest
 */
export const PointOfInterestDeleteOutputSchema = z.object({
    pointOfInterest: PointOfInterestSchema
});

/**
 * Schema for point of interest restoration response
 * Returns the restored point of interest
 */
export const PointOfInterestRestoreOutputSchema = z.object({
    pointOfInterest: PointOfInterestSchema
});

/**
 * Schema for point of interest view response
 * Returns a single point of interest by ID or slug
 */
export const PointOfInterestViewOutputSchema = z.object({
    pointOfInterest: PointOfInterestSchema.nullable()
});

/**
 * Relation Management Schemas
 *
 * Needed even though admin write routes are deferred in Phase 1 (NG-5):
 * the seed factory and the destination-relationship seed step (T-026)
 * both call these create/relation methods programmatically.
 */

/**
 * Schema for adding a point of interest to a destination (many-to-many, HOS-113 OQ-1).
 *
 * `relation` (HOS-140) is optional and defaults to `PRIMARY`, preserving the
 * behavior of every call site written before this field existed — an
 * omitted value creates a row identical to pre-HOS-140 behavior.
 */
export const PointOfInterestAddToDestinationInputSchema = z.object({
    destinationId: DestinationIdSchema,
    pointOfInterestId: PointOfInterestIdSchema,
    relation: PointOfInterestDestinationRelationEnumSchema.default(
        PointOfInterestDestinationRelationEnum.PRIMARY
    )
});

/**
 * Schema for removing a point of interest from a destination
 */
export const PointOfInterestRemoveFromDestinationInputSchema = z.object({
    destinationId: DestinationIdSchema,
    pointOfInterestId: PointOfInterestIdSchema
});

/**
 * Schema for point-of-interest-destination relation response
 * Returns success status and the relation data
 */
export const PointOfInterestDestinationRelationOutputSchema = z.object({
    success: z.boolean().default(true),
    relation: z.object({
        destinationId: DestinationIdSchema,
        pointOfInterestId: PointOfInterestIdSchema,
        createdAt: z.date().optional(),
        updatedAt: z.date().optional()
    })
});

/**
 * Type exports for CRUD operations
 */
export type PointOfInterestCreateInput = z.infer<typeof PointOfInterestCreateInputSchema>;
export type PointOfInterestUpdateInput = z.infer<typeof PointOfInterestUpdateInputSchema>;
export type PointOfInterestDeleteInput = z.infer<typeof PointOfInterestDeleteInputSchema>;
export type PointOfInterestRestoreInput = z.infer<typeof PointOfInterestRestoreInputSchema>;

export type PointOfInterestCreateOutput = z.infer<typeof PointOfInterestCreateOutputSchema>;
export type PointOfInterestUpdateOutput = z.infer<typeof PointOfInterestUpdateOutputSchema>;
export type PointOfInterestDeleteOutput = z.infer<typeof PointOfInterestDeleteOutputSchema>;
export type PointOfInterestRestoreOutput = z.infer<typeof PointOfInterestRestoreOutputSchema>;
export type PointOfInterestViewOutput = z.infer<typeof PointOfInterestViewOutputSchema>;

export type PointOfInterestAddToDestinationInput = z.infer<
    typeof PointOfInterestAddToDestinationInputSchema
>;
export type PointOfInterestRemoveFromDestinationInput = z.infer<
    typeof PointOfInterestRemoveFromDestinationInputSchema
>;
export type PointOfInterestDestinationRelationOutput = z.infer<
    typeof PointOfInterestDestinationRelationOutputSchema
>;
