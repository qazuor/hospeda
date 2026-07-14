import { z } from 'zod';
import { DestinationIdSchema, PointOfInterestIdSchema } from '../../common/id.schema.js';
import { PointOfInterestDestinationRelationEnumSchema } from '../../enums/point-of-interest-destination-relation.schema.js';

/**
 * Destination-relation admin schemas for point of interest (HOS-143 T-003).
 *
 * Complements the add/remove relation schemas in `point-of-interest.crud.schema.ts`
 * with an update (change the `relation` kind, HOS-140) input, and a flat list
 * item shape for the admin destination-relations table (denormalized
 * `destinationName`/`destinationSlug` for display, avoiding a nested join
 * shape in list responses).
 */

/**
 * Schema for updating the `relation` kind (PRIMARY | NEARBY, HOS-140) of an
 * existing point-of-interest-destination link, without removing and
 * re-adding the row.
 */
export const PointOfInterestUpdateDestinationRelationInputSchema = z.object({
    destinationId: DestinationIdSchema,
    pointOfInterestId: PointOfInterestIdSchema,
    relation: PointOfInterestDestinationRelationEnumSchema
});

/**
 * Flat list-item schema for a point-of-interest's destination relations, as
 * displayed in the admin panel (destination name/slug denormalized for
 * display, avoiding a nested `destination` object per row).
 */
export const PointOfInterestDestinationListItemSchema = z.object({
    destinationId: DestinationIdSchema,
    destinationName: z.string(),
    destinationSlug: z.string(),
    relation: PointOfInterestDestinationRelationEnumSchema
});

/**
 * Type exports
 */
export type PointOfInterestUpdateDestinationRelationInput = z.infer<
    typeof PointOfInterestUpdateDestinationRelationInputSchema
>;
export type PointOfInterestDestinationListItem = z.infer<
    typeof PointOfInterestDestinationListItemSchema
>;
