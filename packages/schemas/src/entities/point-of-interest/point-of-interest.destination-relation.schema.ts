import { z } from 'zod';
import { DestinationIdSchema, PointOfInterestIdSchema } from '../../common/id.schema.js';
import { PointOfInterestDestinationRelationEnumSchema } from '../../enums/point-of-interest-destination-relation.schema.js';
import { PointOfInterestSummarySchema } from './point-of-interest.schema.js';

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
 * Point-of-interest summary extended with the destination-relation kind
 * (HOS-146). `relation` (PRIMARY | NEARBY, HOS-140) lives on the
 * `r_destination_point_of_interest` join row, NOT on the POI entity itself —
 * it is intentionally kept OUT of `PointOfInterestSummarySchema` (that would
 * leak join-table state into the POI's own type for every consumer, not just
 * the destination relation).
 *
 * This derived schema is the shape used exclusively by
 * `Destination.pointsOfInterest` (HOS-113 Phase 4 relation array): it lets
 * `relation` survive `stripWithSchema` on public/protected destination
 * responses instead of being silently dropped as an undeclared key (the
 * response strip only keeps keys the declared response schema knows about).
 *
 * `relation` is `.optional()` — deliberately, not by omission. Declaring it is
 * what makes `stripWithSchema` KEEP the key when present; requiring it would be
 * a "tighten a rule" breaking change under the additive-only Schema
 * Compatibility Policy (packages/schemas/CLAUDE.md), since
 * `PointOfInterestSummarySchema` shipped without it. Optional gets the full
 * benefit (the key survives the strip) with none of the risk: any already-stored
 * or cached POI summary lacking `relation` still parses instead of failing the
 * whole destination response. Consumers default a missing value to `'PRIMARY'`
 * (see `toDestinationPointOfInterestListProps` in apps/web).
 */
export const DestinationPointOfInterestSummarySchema = PointOfInterestSummarySchema.extend({
    relation: PointOfInterestDestinationRelationEnumSchema.optional()
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
export type DestinationPointOfInterestSummary = z.infer<
    typeof DestinationPointOfInterestSummarySchema
>;
