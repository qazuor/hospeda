import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { DestinationIdSchema, PointOfInterestIdSchema } from '../../common/id.schema.js';
import { PointOfInterestDestinationRelationEnumSchema } from '../../enums/point-of-interest-destination-relation.schema.js';
import {
    PointOfInterestMiniSchema,
    PointOfInterestSummarySchema
} from './point-of-interest.schema.js';

/**
 * Relation Schemas for Point Of Interest entities
 * Handles relationships between points of interest and destinations
 * (many-to-many, HOS-113 OQ-1 — a POI may belong to several destinations).
 */

/**
 * Destination-PointOfInterest Relation Schema
 * Represents a single row of the many-to-many relationship between
 * destinations and points of interest.
 */
export const DestinationPointOfInterestRelationSchema = z.object({
    destinationId: DestinationIdSchema,
    pointOfInterestId: PointOfInterestIdSchema,
    ...BaseAuditFields,

    // Relation kind (HOS-140): PRIMARY (POI is physically in this
    // destination) or NEARBY (cross-referenced from a different
    // destination's page). Required — every row read back has a concrete
    // value (defaulted at the DB/write-path level, never absent).
    relation: PointOfInterestDestinationRelationEnumSchema,

    // Optional metadata for the relation
    order: z
        .number()
        .int({ message: 'zodError.pointOfInterest.relation.order.int' })
        .min(0, { message: 'zodError.pointOfInterest.relation.order.min' })
        .optional(),

    isHighlighted: z.boolean().default(false),

    notes: z
        .string()
        .max(500, { message: 'zodError.pointOfInterest.relation.notes.max' })
        .optional()
});

/**
 * Point Of Interest with Destinations Info Schema
 *
 * Used when displaying a point of interest with the destinations it belongs
 * to. Unlike attraction's `AttractionWithDestinationSchema` (a single
 * `destination` object), this is a plural `destinations` array — a direct
 * consequence of the many-to-many cardinality (HOS-113 OQ-1): a POI can
 * legitimately surface from more than one destination (e.g. a regional or
 * border landmark).
 */
export const PointOfInterestWithDestinationsSchema = PointOfInterestSummarySchema.extend({
    destinations: z
        .array(
            z.object({
                id: DestinationIdSchema,
                slug: z.string()
            })
        )
        .optional(),

    // Relation metadata
    isHighlighted: z.boolean().default(false)
});

/**
 * Destination with Point Of Interest List Schema
 * Used when displaying destinations with their associated points of
 * interest (from the point-of-interest context).
 */
export const DestinationWithPointsOfInterestListSchema = z.object({
    id: DestinationIdSchema,
    slug: z.string(),
    pointsOfInterest: z.array(PointOfInterestMiniSchema)
});

/**
 * Point Of Interest List Item with Relations Schema
 * Extended version of point of interest for list displays that includes
 * relation counts.
 */
export const PointOfInterestListItemWithRelationsSchema = PointOfInterestSummarySchema.extend({
    destinationCount: z
        .number()
        .int({ message: 'zodError.pointOfInterest.listItem.destinationCount.int' })
        .min(0, { message: 'zodError.pointOfInterest.listItem.destinationCount.min' })
        .optional(),

    // Preview of related destinations (limited to first few)
    destinationPreviews: z
        .array(
            z.object({
                id: DestinationIdSchema,
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
 * Schema for bulk adding points of interest to a destination
 */
export const BulkAddPointsOfInterestToDestinationInputSchema = z.object({
    destinationId: DestinationIdSchema,
    pointOfInterestIds: z
        .array(PointOfInterestIdSchema)
        .min(1, {
            message: 'zodError.pointOfInterest.bulkAdd.pointOfInterestIds.min'
        })
        .max(50, {
            message: 'zodError.pointOfInterest.bulkAdd.pointOfInterestIds.max'
        })
});

/**
 * Schema for bulk removing points of interest from a destination
 */
export const BulkRemovePointsOfInterestFromDestinationInputSchema = z.object({
    destinationId: DestinationIdSchema,
    pointOfInterestIds: z
        .array(PointOfInterestIdSchema)
        .min(1, {
            message: 'zodError.pointOfInterest.bulkRemove.pointOfInterestIds.min'
        })
        .max(50, {
            message: 'zodError.pointOfInterest.bulkRemove.pointOfInterestIds.max'
        })
});

/**
 * Schema for updating point-of-interest order within a destination
 */
export const UpdatePointOfInterestOrderInputSchema = z.object({
    destinationId: DestinationIdSchema,
    pointOfInterestOrders: z
        .array(
            z.object({
                pointOfInterestId: PointOfInterestIdSchema,
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
export const PointOfInterestBulkRelationOperationOutputSchema = z.object({
    success: z.boolean().default(true),
    processed: z.number().int().min(0),
    failed: z.number().int().min(0),
    errors: z
        .array(
            z.object({
                pointOfInterestId: PointOfInterestIdSchema,
                error: z.string()
            })
        )
        .optional()
});

/**
 * Schema for point-of-interest-destination relation with full details
 */
export const PointOfInterestDestinationRelationDetailSchema =
    DestinationPointOfInterestRelationSchema.extend({
        pointOfInterest: PointOfInterestMiniSchema.optional(),
        destination: z
            .object({
                id: DestinationIdSchema,
                slug: z.string()
            })
            .optional()
    });

/**
 * Type exports for relation operations
 */
export type DestinationPointOfInterestRelation = z.infer<
    typeof DestinationPointOfInterestRelationSchema
>;
export type PointOfInterestWithDestinations = z.infer<typeof PointOfInterestWithDestinationsSchema>;
export type DestinationWithPointsOfInterestList = z.infer<
    typeof DestinationWithPointsOfInterestListSchema
>;
export type PointOfInterestListItemWithRelations = z.infer<
    typeof PointOfInterestListItemWithRelationsSchema
>;

export type BulkAddPointsOfInterestToDestinationInput = z.infer<
    typeof BulkAddPointsOfInterestToDestinationInputSchema
>;
export type BulkRemovePointsOfInterestFromDestinationInput = z.infer<
    typeof BulkRemovePointsOfInterestFromDestinationInputSchema
>;
export type UpdatePointOfInterestOrderInput = z.infer<typeof UpdatePointOfInterestOrderInputSchema>;

export type PointOfInterestBulkRelationOperationOutput = z.infer<
    typeof PointOfInterestBulkRelationOperationOutputSchema
>;
export type PointOfInterestDestinationRelationDetail = z.infer<
    typeof PointOfInterestDestinationRelationDetailSchema
>;
