/**
 * Venue relation-selector lookup schema (SPEC-239).
 *
 * Venue extends the shared `{ id, label, slug }` option item with `type`
 * and `destination` — matching the accommodation options pattern — so the
 * venue selector can disambiguate listings in relation pickers.
 */
import { z } from 'zod';
import { EntityOptionsItemSchema } from '../../common/entity-options.schema.js';
import { VenueTypeEnumSchema } from '../../enums/index.js';

/**
 * Minimal destination descriptor embedded in a venue option item.
 */
export const VenueOptionsDestinationSchema = z.object({
    /** Destination id (UUID). */
    id: z.string().describe('Destination id'),
    /** Destination display name. */
    name: z.string().describe('Destination name'),
    /** Destination slug. */
    slug: z.string().describe('Destination slug')
});

/**
 * Venue option item: base `{ id, label, slug }` plus `type` and `destination`.
 */
export const VenueOptionsItemSchema = EntityOptionsItemSchema.extend({
    /** Venue sub-type (RESTAURANT, BAR, CAFE, etc.). */
    type: VenueTypeEnumSchema.describe('venue type'),
    /** The venue listing's destination, or null when unresolved. */
    destination: VenueOptionsDestinationSchema.nullable().describe(
        'Destination summary (id, name, slug)'
    )
});

/**
 * Type inferred from {@link VenueOptionsItemSchema}.
 */
export type VenueOptionsItem = z.infer<typeof VenueOptionsItemSchema>;

/**
 * Wrapper schema for the venue `/options` response payload.
 */
export const VenueOptionsListSchema = z.object({
    items: z.array(VenueOptionsItemSchema).describe('Matching venue options')
});

/**
 * Type inferred from {@link VenueOptionsListSchema}.
 */
export type VenueOptionsList = z.infer<typeof VenueOptionsListSchema>;
