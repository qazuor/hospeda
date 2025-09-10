import { z } from 'zod';
import { AttractionIdSchema, DestinationIdSchema } from '../../common/id.schema.js';
import { AttractionSchema } from './attraction.schema.js';

/**
 * CRUD Input Schemas for Attraction operations
 */

/**
 * Schema for creating a new attraction
 * Omits auto-generated fields like id and audit fields
 */
export const AttractionCreateInputSchema = AttractionSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/**
 * Schema for updating an attraction
 * All fields are optional for partial updates, except id is not allowed
 */
export const AttractionUpdateInputSchema = AttractionCreateInputSchema.partial();

/**
 * Schema for deleting an attraction (soft delete)
 * Only requires the attraction ID
 */
export const AttractionDeleteInputSchema = z.object({
    id: AttractionIdSchema
});

/**
 * Schema for restoring a soft-deleted attraction
 * Only requires the attraction ID
 */
export const AttractionRestoreInputSchema = z.object({
    id: AttractionIdSchema
});

/**
 * CRUD Output Schemas for Attraction operations
 */

/**
 * Schema for attraction creation response
 * Returns the created attraction
 */
export const AttractionCreateOutputSchema = z.object({
    attraction: AttractionSchema
});

/**
 * Schema for attraction update response
 * Returns the updated attraction
 */
export const AttractionUpdateOutputSchema = z.object({
    attraction: AttractionSchema
});

/**
 * Schema for attraction deletion response
 * Returns the deleted attraction
 */
export const AttractionDeleteOutputSchema = z.object({
    attraction: AttractionSchema
});

/**
 * Schema for attraction restoration response
 * Returns the restored attraction
 */
export const AttractionRestoreOutputSchema = z.object({
    attraction: AttractionSchema
});

/**
 * Schema for attraction view response
 * Returns a single attraction by ID or slug
 */
export const AttractionViewOutputSchema = z.object({
    attraction: AttractionSchema.nullable()
});

/**
 * Relation Management Schemas
 */

/**
 * Schema for adding an attraction to a destination
 */
export const AttractionAddToDestinationInputSchema = z.object({
    destinationId: DestinationIdSchema,
    attractionId: AttractionIdSchema
});

/**
 * Schema for removing an attraction from a destination
 */
export const AttractionRemoveFromDestinationInputSchema = z.object({
    destinationId: DestinationIdSchema,
    attractionId: AttractionIdSchema
});

/**
 * Schema for attraction-destination relation response
 * Returns success status and the relation data
 */
export const AttractionDestinationRelationOutputSchema = z.object({
    success: z.boolean().default(true),
    relation: z.object({
        destinationId: DestinationIdSchema,
        attractionId: AttractionIdSchema,
        createdAt: z.date().optional(),
        updatedAt: z.date().optional()
    })
});

/**
 * Type exports for CRUD operations
 */
export type AttractionCreateInput = z.infer<typeof AttractionCreateInputSchema>;
export type AttractionUpdateInput = z.infer<typeof AttractionUpdateInputSchema>;
export type AttractionDeleteInput = z.infer<typeof AttractionDeleteInputSchema>;
export type AttractionRestoreInput = z.infer<typeof AttractionRestoreInputSchema>;

export type AttractionCreateOutput = z.infer<typeof AttractionCreateOutputSchema>;
export type AttractionUpdateOutput = z.infer<typeof AttractionUpdateOutputSchema>;
export type AttractionDeleteOutput = z.infer<typeof AttractionDeleteOutputSchema>;
export type AttractionRestoreOutput = z.infer<typeof AttractionRestoreOutputSchema>;
export type AttractionViewOutput = z.infer<typeof AttractionViewOutputSchema>;

export type AttractionAddToDestinationInput = z.infer<typeof AttractionAddToDestinationInputSchema>;
export type AttractionRemoveFromDestinationInput = z.infer<
    typeof AttractionRemoveFromDestinationInputSchema
>;
export type AttractionDestinationRelationOutput = z.infer<
    typeof AttractionDestinationRelationOutputSchema
>;
