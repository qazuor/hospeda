import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { AttractionIdSchema, DestinationIdSchema } from '../../common/id.schema.js';
import { AttractionMiniSchema, AttractionSummarySchema } from './attraction.schema.js';

/**
 * Relation Schemas for Attraction entities
 * Handles relationships between attractions and other entities
 */

/**
 * Destination-Attraction Relation Schema
 * Represents the many-to-many relationship between destinations and attractions
 */
export const DestinationAttractionRelationSchema = z.object({
    destinationId: DestinationIdSchema,
    attractionId: AttractionIdSchema,
    ...BaseAuditFields,

    // Optional metadata for the relation
    order: z
        .number()
        .int({ message: 'zodError.attraction.relation.order.int' })
        .min(0, { message: 'zodError.attraction.relation.order.min' })
        .optional(),

    isHighlighted: z.boolean().default(false),

    notes: z.string().max(500, { message: 'zodError.attraction.relation.notes.max' }).optional()
});

/**
 * Attraction with Destination Info Schema
 * Used when displaying attractions with their associated destination information
 */
export const AttractionWithDestinationSchema = AttractionSummarySchema.extend({
    destination: z
        .object({
            id: DestinationIdSchema,
            name: z.string(),
            slug: z.string()
        })
        .optional(),

    // Relation metadata
    relationOrder: z.number().int().min(0).optional(),
    isHighlighted: z.boolean().default(false)
});

/**
 * Destination with Attraction List Schema
 * Used when displaying destinations with their associated attractions (from attraction context)
 */
export const DestinationWithAttractionListSchema = z.object({
    id: DestinationIdSchema,
    name: z.string(),
    slug: z.string(),
    attractions: z.array(AttractionMiniSchema)
});

/**
 * Attraction List Item with Relations Schema
 * Extended version of attraction for list displays that includes relation counts
 */
export const AttractionListItemWithRelationsSchema = AttractionSummarySchema.extend({
    destinationCount: z
        .number()
        .int({ message: 'zodError.attraction.listItem.destinationCount.int' })
        .min(0, { message: 'zodError.attraction.listItem.destinationCount.min' })
        .optional(),

    // Preview of related destinations (limited to first few)
    destinationPreviews: z
        .array(
            z.object({
                id: DestinationIdSchema,
                name: z.string(),
                slug: z.string()
            })
        )
        .max(3)
        .optional()
});

/**
 * Bulk Relation Operations Schemas
 */

/**
 * Schema for bulk adding attractions to a destination
 */
export const BulkAddAttractionsToDestinationInputSchema = z.object({
    destinationId: DestinationIdSchema,
    attractionIds: z
        .array(AttractionIdSchema)
        .min(1, {
            message: 'zodError.attraction.bulkAdd.attractionIds.min'
        })
        .max(50, {
            message: 'zodError.attraction.bulkAdd.attractionIds.max'
        })
});

/**
 * Schema for bulk removing attractions from a destination
 */
export const BulkRemoveAttractionsFromDestinationInputSchema = z.object({
    destinationId: DestinationIdSchema,
    attractionIds: z
        .array(AttractionIdSchema)
        .min(1, {
            message: 'zodError.attraction.bulkRemove.attractionIds.min'
        })
        .max(50, {
            message: 'zodError.attraction.bulkRemove.attractionIds.max'
        })
});

/**
 * Schema for updating attraction order in a destination
 */
export const UpdateAttractionOrderInputSchema = z.object({
    destinationId: DestinationIdSchema,
    attractionOrders: z
        .array(
            z.object({
                attractionId: AttractionIdSchema,
                order: z.number().int().min(0)
            })
        )
        .min(1)
});

/**
 * Output Schemas for Relation Operations
 */

/**
 * Schema for bulk relation operation results
 */
export const BulkRelationOperationOutputSchema = z.object({
    success: z.boolean().default(true),
    processed: z.number().int().min(0),
    failed: z.number().int().min(0),
    errors: z
        .array(
            z.object({
                attractionId: AttractionIdSchema,
                error: z.string()
            })
        )
        .optional()
});

/**
 * Schema for attraction-destination relation with full details
 */
export const AttractionDestinationRelationDetailSchema = DestinationAttractionRelationSchema.extend(
    {
        attraction: AttractionMiniSchema.optional(),
        destination: z
            .object({
                id: DestinationIdSchema,
                name: z.string(),
                slug: z.string()
            })
            .optional()
    }
);

/**
 * Type exports for relation operations
 */
export type DestinationAttractionRelation = z.infer<typeof DestinationAttractionRelationSchema>;
export type AttractionWithDestination = z.infer<typeof AttractionWithDestinationSchema>;
export type DestinationWithAttractionList = z.infer<typeof DestinationWithAttractionListSchema>;
export type AttractionListItemWithRelations = z.infer<typeof AttractionListItemWithRelationsSchema>;

export type BulkAddAttractionsToDestinationInput = z.infer<
    typeof BulkAddAttractionsToDestinationInputSchema
>;
export type BulkRemoveAttractionsFromDestinationInput = z.infer<
    typeof BulkRemoveAttractionsFromDestinationInputSchema
>;
export type UpdateAttractionOrderInput = z.infer<typeof UpdateAttractionOrderInputSchema>;

export type BulkRelationOperationOutput = z.infer<typeof BulkRelationOperationOutputSchema>;
export type AttractionDestinationRelationDetail = z.infer<
    typeof AttractionDestinationRelationDetailSchema
>;
